import { ServiceUnavailableException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { AuthenticatedUser } from '../auth/authenticated-user';
import { CreateListingDto } from './create-listing.dto';
import { ListingCondition, ListingStatus } from './listing.enums';
import { Listing } from './listing.entity';
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
  let service: ListingsService;

  beforeEach(() => {
    repository = {
      create: jest.fn((entity: Partial<Listing>) => entity),
      save: jest.fn(async (entity: Partial<Listing>) => ({ ...entity, id: 'listing-1', createdAt: new Date() })),
      delete: jest.fn(),
      find: jest.fn(),
    };
    publisher = { publishSubmitted: jest.fn().mockResolvedValue(undefined) };
    service = new ListingsService(
      repository as unknown as Repository<Listing>,
      publisher as unknown as ListingEventsPublisher,
    );
  });

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
