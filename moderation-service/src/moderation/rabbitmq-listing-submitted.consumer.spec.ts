import { RabbitMqListingSubmittedConsumer } from './rabbitmq-listing-submitted.consumer';

const valid = {
  listingId: '3f2504e0-4f89-41d3-9a0c-0305e82c3301',
  ownerId: '3f2504e0-4f89-41d3-9a0c-0305e82c3302',
  ownerUsername: 'membre',
  title: 'Masque',
  description: 'Un masque',
  condition: 'GOOD',
  category: 'MASKS',
  kind: 'EXCHANGE',
  handoverPlace: 'TO_AGREE',
  submittedAt: '2026-11-04T10:00:00.000Z',
};
const message = (body: string) => ({ content: Buffer.from(body) }) as never;

describe('RabbitMqListingSubmittedConsumer (acquittement et rejet)', () => {
  const channel = { ack: jest.fn(), nack: jest.fn() };
  const enqueue = jest.fn();
  const consumer = new RabbitMqListingSubmittedConsumer({} as never, { enqueue } as never);

  beforeEach(() => jest.clearAllMocks());

  it('acquitte un message valide', async () => {
    enqueue.mockResolvedValue(true);
    const received = message(JSON.stringify(valid));

    await consumer.handle(channel as never, received);

    expect(channel.ack).toHaveBeenCalledWith(received);
    expect(channel.nack).not.toHaveBeenCalled();
  });

  it('envoie un JSON illisible dans la file des echecs (nack sans remise)', async () => {
    const received = message('{pas du json');

    await consumer.handle(channel as never, received);

    expect(channel.nack).toHaveBeenCalledWith(received, false, false);
    expect(channel.ack).not.toHaveBeenCalled();
  });

  it('envoie un message invalide dans la file des echecs', async () => {
    const received = message(JSON.stringify({ ...valid, listingId: 'pas-un-uuid' }));

    await consumer.handle(channel as never, received);

    expect(channel.nack).toHaveBeenCalledWith(received, false, false);
  });

  it('remet le message en file si la base est indisponible', async () => {
    jest.useFakeTimers();
    enqueue.mockRejectedValue(new Error('base indisponible'));
    const received = message(JSON.stringify(valid));

    const done = consumer.handle(channel as never, received);
    await jest.advanceTimersByTimeAsync(3100);
    await done;

    expect(channel.nack).toHaveBeenCalledWith(received, false, true);
    jest.useRealTimers();
  });
});
