import { ServiceUnavailableException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { AuthenticatedUser } from '../auth/authenticated-user';
import { CreateListingDto } from './create-listing.dto';
import { ListingCondition, ListingStatus } from './listing.enums';
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
    service = new ListingsService(
      repository as unknown as Repository<Listing>,
      publisher as unknown as ListingEventsPublisher,
      database,
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

    it("retire l'annonce et repond 503 quand la publication echoue (compensation)", async () => {
      // Given : NATS injoignable
      publisher.publishSubmitted.mockRejectedValue(new Error('connexion refusee'));

      // When / Then
      await expect(service.submit(user, dto)).rejects.toBeInstanceOf(ServiceUnavailableException);
      expect(repository.delete).toHaveBeenCalledWith('listing-1');
    });
  });

  describe('base de donnees indisponible', () => {
    it("repond 503 sans solliciter la base quand le disjoncteur est ouvert", async () => {
      // Given : la base tombe, des appels successifs echouent et ouvrent le circuit
      repository.find.mockRejectedValue(new Error('connect ECONNREFUSED'));
      for (let i = 0; i < 5; i++) {
        await expect(service.findByOwner(user)).rejects.toThrow('ECONNREFUSED');
      }
      repository.find.mockClear();

      // When / Then : l'appel suivant echoue vite, en 503, sans atteindre la base
      await expect(service.findByOwner(user)).rejects.toBeInstanceOf(ServiceUnavailableException);
      expect(repository.find).not.toHaveBeenCalled();
    });
  });

  describe('findByOwner', () => {
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
