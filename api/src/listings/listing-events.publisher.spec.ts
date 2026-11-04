import { ClientProxy } from '@nestjs/microservices';
import { of, throwError } from 'rxjs';
import { ListingCondition, ListingStatus } from './listing.enums';
import { Listing } from './listing.entity';
import { LISTING_SUBMITTED } from './listing-events';
import { ListingEventsPublisher } from './listing-events.publisher';

describe('ListingEventsPublisher', () => {
  const listing = {
    id: '33333333-3333-4333-8333-333333333333',
    ownerId: '11111111-1111-4111-8111-111111111111',
    ownerUsername: 'membre',
    title: 'Figurine',
    description: 'Edition 2019',
    condition: ListingCondition.GOOD,
    status: ListingStatus.PENDING_MODERATION,
    createdAt: new Date('2026-11-04T10:00:00Z'),
  } as Listing;

  it("publie l'evenement listing.submitted avec le contrat attendu par le service de moderation", async () => {
    const emit = jest.fn().mockReturnValue(of(true));
    const publisher = new ListingEventsPublisher({ emit } as unknown as ClientProxy);

    await publisher.publishSubmitted(listing);

    expect(emit).toHaveBeenCalledWith(LISTING_SUBMITTED, {
      listingId: listing.id,
      ownerId: listing.ownerId,
      ownerUsername: 'membre',
      title: 'Figurine',
      description: 'Edition 2019',
      condition: 'GOOD',
      submittedAt: '2026-11-04T10:00:00.000Z',
    });
  });

  it("reessaie deux fois puis propage l'erreur si le broker reste injoignable", async () => {
    const emit = jest.fn().mockReturnValue(throwError(() => new Error('broker injoignable')));
    const publisher = new ListingEventsPublisher({ emit } as unknown as ClientProxy);

    await expect(publisher.publishSubmitted(listing)).rejects.toThrow('broker injoignable');
    expect(emit).toHaveBeenCalledTimes(1); // le flux est re-souscrit : 1 appel a emit(), 3 souscriptions
  });
});
