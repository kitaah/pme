import { Logger, ServiceUnavailableException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { AuthenticatedUser } from '@pme/common';
import { CreateListingDto } from './create-listing.dto';
import { HandoverPlace, ListingCondition, ListingKind, ListingStatus } from './listing.enums';
import { PhotoStorageService } from '../storage/photo-storage.service';
import { Listing } from './listing.entity';
import { DatabaseCircuitBreaker } from '../common/database-circuit-breaker';
import { ListingEventsPublisher } from './listing-events.publisher';
import { ListingsService } from './listings.service';

describe('ListingsService', () => {
  const user: AuthenticatedUser = { id: '11111111-1111-4111-8111-111111111111', username: 'membre', roles: ['membre'] };
  const dto: CreateListingDto = {
    title: 'Figurine Pyramid Head',
    description: 'Edition 2019',
    condition: ListingCondition.GOOD,
  };

  let repository: { create: jest.Mock; save: jest.Mock; delete: jest.Mock; find: jest.Mock };
  let publisher: { publishSubmitted: jest.Mock };
  let photos: { store: jest.Mock; remove: jest.Mock; signedUrl: jest.Mock };
  let database: DatabaseCircuitBreaker;
  let service: ListingsService;

  beforeEach(() => {
    repository = {
      create: jest.fn((entity: Partial<Listing>) => entity),
      save: jest.fn(async (entity: Partial<Listing>) => ({ ...entity, id: 'listing-1', createdAt: new Date() })),
      delete: jest.fn().mockResolvedValue(undefined),
      find: jest.fn(),
    };
    database = new DatabaseCircuitBreaker();
    publisher = { publishSubmitted: jest.fn().mockResolvedValue(undefined) };
    photos = {
      store: jest.fn().mockResolvedValue({ key: 'pending/p1.webp', mime: 'image/webp' }),
      remove: jest.fn().mockResolvedValue(undefined),
      signedUrl: jest.fn().mockResolvedValue('https://garage.localhost/signed'),
    };
    service = new ListingsService(
      repository as unknown as Repository<Listing>,
      publisher as unknown as ListingEventsPublisher,
      database,
      photos as unknown as PhotoStorageService,
    );
  });

  afterEach(() => database.shutdown());

  describe('submit', () => {
    it("enregistre l'annonce en attente de moderation puis publie l'evenement", async () => {
      // Given : un membre authentifie et une annonce valide
      // When
      const listing = await service.submit(user, dto);

      // Then : le proprietaire vient du jeton (jamais du corps de la requete) et le statut est impose
      expect(repository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          ownerId: user.id,
          ownerUsername: 'membre',
          status: ListingStatus.PENDING_MODERATION,
        }),
      );
      expect(publisher.publishSubmitted).toHaveBeenCalledWith(expect.objectContaining({ id: 'listing-1' }));
      expect(listing.id).toBe('listing-1');
      expect(repository.delete).not.toHaveBeenCalled();
    });

    it('applique les valeurs par defaut : echange, lieu a convenir, pas de prix, pas de photo', async () => {
      await service.submit(user, dto);

      expect(repository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          kind: ListingKind.EXCHANGE,
          priceCents: null,
          wantedInExchange: null,
          handoverPlace: HandoverPlace.TO_AGREE,
          photoKey: null,
          photoMime: null,
        }),
      );
      expect(photos.store).not.toHaveBeenCalled();
    });

    it('retient le prix pour une vente seulement', async () => {
      await service.submit(user, { ...dto, kind: ListingKind.SALE, priceCents: 4500 });
      await service.submit(user, { ...dto, kind: ListingKind.SALE });
      await service.submit(user, { ...dto, kind: ListingKind.GIFT, priceCents: 4500 });
      await service.submit(user, { ...dto, kind: ListingKind.EXCHANGE, priceCents: 4500 });

      const prices = repository.create.mock.calls.map(([entity]) => (entity as Partial<Listing>).priceCents);
      expect(prices).toEqual([4500, null, null, null]);
    });

    it('conserve la contrepartie et le lieu de remise choisis', async () => {
      await service.submit(user, { ...dto, wantedInExchange: 'Un Blu-ray', handoverPlace: HandoverPlace.SHOP_LYON });

      expect(repository.create).toHaveBeenCalledWith(
        expect.objectContaining({ wantedInExchange: 'Un Blu-ray', handoverPlace: HandoverPlace.SHOP_LYON }),
      );
    });

    it('enregistre la photo AVANT l annonce et ne garde que son chemin, jamais son contenu', async () => {
      const buffer = Buffer.from('image');

      const view = await service.submit(user, dto, buffer);

      expect(photos.store).toHaveBeenCalledWith(buffer);
      expect(photos.store.mock.invocationCallOrder[0]).toBeLessThan(repository.save.mock.invocationCallOrder[0]);
      expect(repository.create).toHaveBeenCalledWith(
        expect.objectContaining({ photoKey: 'pending/p1.webp', photoMime: 'image/webp' }),
      );
      expect(view.photoUrl).toBe('https://garage.localhost/signed');
      expect(view).not.toHaveProperty('photoKey');
      expect(view).not.toHaveProperty('photoMime');
    });

    it('n ecrit rien en base quand le stockage refuse la photo', async () => {
      photos.store.mockRejectedValue(new ServiceUnavailableException('stockage'));

      await expect(service.submit(user, dto, Buffer.from('image'))).rejects.toBeInstanceOf(ServiceUnavailableException);

      expect(repository.save).not.toHaveBeenCalled();
      expect(publisher.publishSubmitted).not.toHaveBeenCalled();
    });

    it('supprime la photo deja enregistree quand l ecriture en base echoue (503 du disjoncteur)', async () => {
      repository.save.mockRejectedValue(new Error('base indisponible'));

      await expect(service.submit(user, dto, Buffer.from('image'))).rejects.toBeInstanceOf(ServiceUnavailableException);

      expect(photos.remove).toHaveBeenCalledWith('pending/p1.webp');
    });

    it('ne supprime aucune photo quand l ecriture sans photo echoue', async () => {
      repository.save.mockRejectedValue(new Error('base indisponible'));

      await expect(service.submit(user, dto)).rejects.toBeInstanceOf(ServiceUnavailableException);

      expect(photos.remove).not.toHaveBeenCalled();
    });

    it("retire l'annonce et la photo, et repond 503, quand la publication echoue (compensation)", async () => {
      // Given : NATS injoignable
      publisher.publishSubmitted.mockRejectedValue(new Error('connexion refusee'));

      // When / Then
      await expect(service.submit(user, dto, Buffer.from('image'))).rejects.toBeInstanceOf(ServiceUnavailableException);
      expect(repository.delete).toHaveBeenCalledWith('listing-1');
      expect(photos.remove).toHaveBeenCalledWith('pending/p1.webp');
    });

    it('ne supprime aucune photo a la compensation d une annonce sans photo', async () => {
      publisher.publishSubmitted.mockRejectedValue(new Error('connexion refusee'));

      await expect(service.submit(user, dto)).rejects.toBeInstanceOf(ServiceUnavailableException);

      expect(photos.remove).not.toHaveBeenCalled();
    });
  });

  describe('findByOwner', () => {
    it("repond quand meme 503 si le retrait de l'annonce echoue a son tour (base tombee)", async () => {
      jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
      publisher.publishSubmitted.mockRejectedValue(new Error('broker injoignable'));
      repository.delete.mockRejectedValue(new Error('base indisponible'));

      await expect(service.submit(user, dto)).rejects.toBeInstanceOf(ServiceUnavailableException);

      expect(repository.delete).toHaveBeenCalledWith('listing-1');
      expect(Logger.prototype.error).toHaveBeenCalledWith(expect.stringContaining('non retiree'));
      jest.restoreAllMocks();
    });

    it('renvoie des annonces dont le chemin de la photo ne sort pas, avec une URL signee ou null', async () => {
      const base = { ownerId: user.id, title: 'Figurine', createdAt: new Date() };
      repository.find.mockResolvedValue([
        { ...base, id: 'a', photoKey: 'pending/a.webp', photoMime: 'image/webp' },
        { ...base, id: 'b', photoKey: null, photoMime: null },
      ]);

      const views = await service.findByOwner(user, 10);

      expect(views.map((v) => [v.id, v.photoUrl])).toEqual([
        ['a', 'https://garage.localhost/signed'],
        ['b', null],
      ]);
      expect(photos.signedUrl).toHaveBeenCalledTimes(1);
      expect(photos.signedUrl).toHaveBeenCalledWith('pending/a.webp');
      views.forEach((v) => {
        expect(v).not.toHaveProperty('photoKey');
        expect(v).not.toHaveProperty('photoMime');
      });
      expect(repository.find).toHaveBeenCalledWith(expect.objectContaining({ take: 10 }));
    });

    it("ne cherche que les annonces du membre, les plus recentes d'abord, limitees a 50", async () => {
      repository.find.mockResolvedValue([]);

      await service.findByOwner(user);

      expect(repository.find).toHaveBeenCalledWith({
        where: { ownerId: user.id },
        order: { createdAt: 'DESC' },
        take: 50,
      });
    });
  });
});
