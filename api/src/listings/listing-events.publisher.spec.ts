import { ListingCondition, ListingStatus } from './listing.enums';
import { Listing } from './listing.entity';
import { LISTING_SUBMITTED_SUBJECT } from './listing-events';
import { ListingEventsPublisher } from './listing-events.publisher';
import { NatsClient } from '@pme/common';

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

  /** Faux client NATS : seule la publication JetStream est utilisee par le publieur. */
  function fakeNats(publish: jest.Mock) {
    return { jetstream: jest.fn().mockResolvedValue({ publish }) } as unknown as NatsClient;
  }

  it("publie l'evenement listing.submitted avec le contrat attendu par le service de moderation", async () => {
    const publish = jest.fn().mockResolvedValue({ seq: 1, duplicate: false });
    const publisher = new ListingEventsPublisher(fakeNats(publish));

    await publisher.publishSubmitted(listing);

    expect(publish).toHaveBeenCalledTimes(1);
    const [subject, payload, options] = publish.mock.calls[0];
    expect(subject).toBe(LISTING_SUBMITTED_SUBJECT);
    expect(JSON.parse(payload as string)).toEqual({
      listingId: listing.id,
      ownerId: listing.ownerId,
      ownerUsername: 'membre',
      title: 'Figurine',
      description: 'Edition 2019',
      condition: 'GOOD',
      submittedAt: '2026-11-04T10:00:00.000Z',
    });
    // msgID = identifiant de l'annonce : NATS ignore un rejeu dans la fenetre de deduplication du flux
    expect(options).toMatchObject({ msgID: listing.id });
  });

  it("reessaie deux fois puis propage l'erreur si le broker reste injoignable", async () => {
    const publish = jest.fn().mockRejectedValue(new Error('broker injoignable'));
    const publisher = new ListingEventsPublisher(fakeNats(publish));

    await expect(publisher.publishSubmitted(listing)).rejects.toThrow('broker injoignable');
    expect(publish).toHaveBeenCalledTimes(3); // 1 tentative + 2 nouvelles
  });

  it('reussit si une nouvelle tentative aboutit', async () => {
    const publish = jest
      .fn()
      .mockRejectedValueOnce(new Error('broker lent'))
      .mockResolvedValue({ seq: 1, duplicate: false });
    const publisher = new ListingEventsPublisher(fakeNats(publish));

    await expect(publisher.publishSubmitted(listing)).resolves.toBeUndefined();
    expect(publish).toHaveBeenCalledTimes(2);
  });
});
