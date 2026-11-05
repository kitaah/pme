import { JsMsg } from 'nats';
import { LISTING_SUBMITTED_DLQ_SUBJECT } from './listing-submitted.event';
import { ListingSubmittedConsumer } from './listing-submitted.consumer';
import { ModerationService } from './moderation.service';
import { NatsClient } from './nats.client';

describe('ListingSubmittedConsumer', () => {
  const validEvent = {
    listingId: '33333333-3333-4333-8333-333333333333',
    ownerId: '11111111-1111-4111-8111-111111111111',
    ownerUsername: 'membre',
    title: 'Figurine Pyramid Head',
    description: 'Edition 2019',
    condition: 'GOOD',
    submittedAt: '2026-11-04T10:00:00.000Z',
  };

  let moderation: { enqueue: jest.Mock };
  let publish: jest.Mock;
  let consumer: ListingSubmittedConsumer;

  /** Faux message JetStream : ack / nak / term sont observables sans broker. */
  function fakeMessage(payload: unknown): JsMsg {
    const raw = JSON.stringify(payload);
    return {
      data: new TextEncoder().encode(raw),
      json: () => JSON.parse(raw) as unknown,
      string: () => raw,
      ack: jest.fn(),
      nak: jest.fn(),
      term: jest.fn(),
      working: jest.fn(),
    } as unknown as JsMsg;
  }

  beforeEach(() => {
    moderation = { enqueue: jest.fn().mockResolvedValue(true) };
    publish = jest.fn().mockResolvedValue({ seq: 1 });
    const nats = { jetstream: jest.fn().mockResolvedValue({ publish }) } as unknown as NatsClient;
    consumer = new ListingSubmittedConsumer(nats, moderation as unknown as ModerationService);
  });

  it("place l'annonce dans la file puis acquitte le message", async () => {
    const message = fakeMessage(validEvent);

    await consumer.handle(message);

    expect(moderation.enqueue).toHaveBeenCalledWith(expect.objectContaining({ listingId: validEvent.listingId }));
    expect(message.ack).toHaveBeenCalled();
    expect(message.nak).not.toHaveBeenCalled();
    expect(message.term).not.toHaveBeenCalled();
  });

  it('acquitte sans erreur un message deja traite (doublon)', async () => {
    moderation.enqueue.mockResolvedValue(false);
    const message = fakeMessage(validEvent);

    await consumer.handle(message);

    expect(message.ack).toHaveBeenCalled();
    expect(message.nak).not.toHaveBeenCalled();
  });

  it("copie un message mal forme dans le flux d'echec et arrete ses remises, sans rien enregistrer", async () => {
    const message = fakeMessage({ listingId: 'pas-un-uuid' });

    await consumer.handle(message);

    expect(moderation.enqueue).not.toHaveBeenCalled();
    expect(publish).toHaveBeenCalledWith(LISTING_SUBMITTED_DLQ_SUBJECT, message.data, expect.anything());
    expect(message.term).toHaveBeenCalled();
    expect(message.ack).not.toHaveBeenCalled();
    expect(message.nak).not.toHaveBeenCalled();
  });

  it("remet le message dans la file quand la panne est passagere : l'annonce n'est pas perdue", async () => {
    // Given : la base est momentanement injoignable (redemarrage du pod PostgreSQL)
    moderation.enqueue.mockRejectedValue(new Error('base indisponible'));
    const message = fakeMessage(validEvent);

    await consumer.handle(message);

    // Then : nouvelle remise demandee, et non envoi dans le flux d'echec,
    // pour que le message soit retraite une fois la base revenue
    expect(message.nak).toHaveBeenCalled();
    expect(message.term).not.toHaveBeenCalled();
    expect(message.ack).not.toHaveBeenCalled();
    expect(publish).not.toHaveBeenCalled();
  });

  it("n'arrete pas les remises si la copie dans le flux d'echec echoue", async () => {
    // Given : message invalide ET broker indisponible pour la copie
    publish.mockRejectedValue(new Error('broker injoignable'));
    const message = fakeMessage({ listingId: 'pas-un-uuid' });

    await consumer.handle(message);

    // Then : pas de term() -> JetStream remettra le message, il n'est pas perdu silencieusement
    expect(message.term).not.toHaveBeenCalled();
    expect(message.ack).not.toHaveBeenCalled();
  });

  it("n'eteint pas le service si le rejet echoue a son tour", async () => {
    // Given : la base est tombee ET la connexion NATS est deja fermee
    moderation.enqueue.mockRejectedValue(new Error('base indisponible'));
    const message = fakeMessage(validEvent);
    (message.nak as unknown as jest.Mock).mockImplementation(() => {
      throw new Error('connexion fermee');
    });

    // Then : l'erreur secondaire est tracee, pas propagee (sinon rejet de promesse non gere)
    await expect(consumer.handle(message)).resolves.toBeUndefined();
  });
});
