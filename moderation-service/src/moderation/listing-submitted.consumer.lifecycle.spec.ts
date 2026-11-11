import { Logger } from '@nestjs/common';
import { JsMsg } from 'nats';
import { LISTINGS_STREAM, MODERATION_CONSUMER } from './listing-submitted.event';
import { ListingSubmittedConsumer } from './listing-submitted.consumer';
import { ModerationService } from './moderation.service';
import { NatsClient } from '@pme/common';

describe('ListingSubmittedConsumer : cycle de vie', () => {
  const validEvent = {
    listingId: '33333333-3333-4333-8333-333333333333',
    ownerId: '11111111-1111-4111-8111-111111111111',
    ownerUsername: 'membre',
    title: 'Figurine Pyramid Head',
    description: 'Edition 2019',
    condition: 'GOOD',
    submittedAt: '2026-11-04T10:00:00.000Z',
  };

  function fakeMessage(payload: unknown): JsMsg {
    const raw = JSON.stringify(payload);
    return {
      data: new TextEncoder().encode(raw),
      json: () => JSON.parse(raw) as unknown,
      ack: jest.fn(),
      nak: jest.fn(),
      term: jest.fn(),
    } as unknown as JsMsg;
  }

  /** Flux de messages JetStream factice : rejoue les messages fournis puis se termine. */
  function fakeStream(messages: JsMsg[]) {
    return {
      close: jest.fn().mockResolvedValue(undefined),
      async *[Symbol.asyncIterator]() {
        for (const message of messages) yield message;
      },
    };
  }

  let moderation: { enqueue: jest.Mock };
  let get: jest.Mock;
  let consumer: ListingSubmittedConsumer;

  beforeEach(() => {
    jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    moderation = { enqueue: jest.fn().mockResolvedValue(true) };
    get = jest.fn();
    const nats = {
      jetstream: jest.fn().mockResolvedValue({ consumers: { get }, publish: jest.fn().mockResolvedValue({}) }),
    } as unknown as NatsClient;
    consumer = new ListingSubmittedConsumer(nats, moderation as unknown as ModerationService);
  });

  afterEach(() => jest.restoreAllMocks());

  it('demarre le consommateur durable et traite les messages recus', async () => {
    const first = fakeMessage(validEvent);
    const second = fakeMessage({ ...validEvent, listingId: '44444444-4444-4444-8444-444444444444' });
    const stream = fakeStream([first, second]);
    get.mockResolvedValue({ consume: jest.fn().mockResolvedValue(stream) });

    await consumer.start();
    await consumer.stop();

    expect(get).toHaveBeenCalledWith(LISTINGS_STREAM, MODERATION_CONSUMER);
    expect(moderation.enqueue).toHaveBeenCalledTimes(2);
    expect(first.ack).toHaveBeenCalled();
    expect(second.ack).toHaveBeenCalled();
    expect(stream.close).toHaveBeenCalledTimes(1);
  });

  it("n'echoue pas a l'arret quand la consommation n'a jamais demarre", async () => {
    await expect(consumer.stop()).resolves.toBeUndefined();
  });

  it("arrete la consommation a l'arret de l'application", async () => {
    const stream = fakeStream([]);
    get.mockResolvedValue({ consume: jest.fn().mockResolvedValue(stream) });
    await consumer.start();

    await consumer.onApplicationShutdown();

    expect(stream.close).toHaveBeenCalledTimes(1);
  });

  it("ferme le flux une seule fois meme si l'arret est demande deux fois", async () => {
    const stream = fakeStream([]);
    get.mockResolvedValue({ consume: jest.fn().mockResolvedValue(stream) });
    await consumer.start();

    await consumer.stop();
    await consumer.stop();

    expect(stream.close).toHaveBeenCalledTimes(1);
  });

  it("envoie un message illisible en flux d'echec au lieu de le rejouer", async () => {
    const message = {
      data: new TextEncoder().encode('{pas du json'),
      json: () => {
        throw new SyntaxError('Unexpected token');
      },
      ack: jest.fn(),
      nak: jest.fn(),
      term: jest.fn(),
    } as unknown as JsMsg;

    await consumer.handle(message);

    expect(moderation.enqueue).not.toHaveBeenCalled();
    expect(message.term).toHaveBeenCalledWith(expect.stringContaining('contenu illisible'));
  });

  it('ne journalise pas de nouvelle annonce pour un doublon', async () => {
    moderation.enqueue.mockResolvedValue(false);
    const message = fakeMessage(validEvent);

    await consumer.handle(message);

    expect(message.ack).toHaveBeenCalled();
    expect(Logger.prototype.log).not.toHaveBeenCalled();
  });

  it("n'echoue pas a l'arret quand la boucle de consommation s'est interrompue sur une erreur", async () => {
    // Le flux de messages se rompt (connexion perdue) au moment de la fermeture
    const breaks: Array<(error: Error) => void> = [];
    const broken = new Promise<never>((_resolve, reject) => breaks.push(reject));
    const stream = {
      close: jest.fn(async () => breaks[0](new Error('connexion perdue'))),
      async *[Symbol.asyncIterator]() {
        await broken;
        yield fakeMessage(validEvent);
      },
    };
    get.mockResolvedValue({ consume: jest.fn().mockResolvedValue(stream) });
    await consumer.start();

    await expect(consumer.stop()).resolves.toBeUndefined();

    expect(stream.close).toHaveBeenCalledTimes(1);
    expect(moderation.enqueue).not.toHaveBeenCalled();
  });
});
