import { RmqContext } from '@nestjs/microservices';
import { ListingSubmittedConsumer } from './listing-submitted.consumer';
import { ModerationService } from './moderation.service';

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
  let consumer: ListingSubmittedConsumer;
  let channel: { ack: jest.Mock; nack: jest.Mock };
  let message: object;
  let context: RmqContext;

  beforeEach(() => {
    moderation = { enqueue: jest.fn().mockResolvedValue(true) };
    consumer = new ListingSubmittedConsumer(moderation as unknown as ModerationService);
    channel = { ack: jest.fn(), nack: jest.fn() };
    message = { content: Buffer.from('{}') };
    context = { getChannelRef: () => channel, getMessage: () => message } as unknown as RmqContext;
  });

  it("place l'annonce dans la file puis acquitte le message", async () => {
    await consumer.onListingSubmitted(validEvent, context);

    expect(moderation.enqueue).toHaveBeenCalledWith(expect.objectContaining({ listingId: validEvent.listingId }));
    expect(channel.ack).toHaveBeenCalledWith(message);
    expect(channel.nack).not.toHaveBeenCalled();
  });

  it('acquitte sans erreur un message deja traite (doublon)', async () => {
    moderation.enqueue.mockResolvedValue(false);

    await consumer.onListingSubmitted(validEvent, context);

    expect(channel.ack).toHaveBeenCalledWith(message);
    expect(channel.nack).not.toHaveBeenCalled();
  });

  it('rejette sans remise en file un message mal forme, sans rien enregistrer', async () => {
    await consumer.onListingSubmitted({ listingId: 'pas-un-uuid' }, context);

    expect(moderation.enqueue).not.toHaveBeenCalled();
    expect(channel.nack).toHaveBeenCalledWith(message, false, false);
    expect(channel.ack).not.toHaveBeenCalled();
  });

  it("remet le message dans la file quand la panne est passagere : l'annonce n'est pas perdue", async () => {
    // Given : la base est momentanement injoignable (redemarrage du pod PostgreSQL)
    moderation.enqueue.mockRejectedValue(new Error('base indisponible'));

    await consumer.onListingSubmitted(validEvent, context);

    // Then : remise en file (3e argument a true) et non envoi en file d'echec,
    // pour que le message soit retraite une fois la base revenue
    expect(channel.nack).toHaveBeenCalledWith(message, false, true);
    expect(channel.ack).not.toHaveBeenCalled();
  });

  it("n'eteint pas le service si l'acquittement negatif echoue a son tour", async () => {
    // Given : la base est tombee ET le canal AMQP est deja ferme
    moderation.enqueue.mockRejectedValue(new Error('base indisponible'));
    channel.nack.mockImplementation(() => {
      throw new Error('canal ferme');
    });

    // Then : l'erreur secondaire est tracee, pas propagee (sinon rejet de promesse non gere)
    await expect(consumer.onListingSubmitted(validEvent, context)).resolves.toBeUndefined();
  });
});
