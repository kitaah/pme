import { Logger } from '@nestjs/common';
import { validate, ValidationError } from 'class-validator';
import { JsMsg } from 'nats';
import { ListingSubmittedConsumer } from './listing-submitted.consumer';
import { ModerationService } from './moderation.service';
import { NatsClient } from '@pme/common';

// class-validator est remplace par un double qui, par defaut, appelle le vrai validateur.
jest.mock('class-validator', () => {
  const actual = jest.requireActual<typeof import('class-validator')>('class-validator');
  return { ...actual, validate: jest.fn(actual.validate) };
});

describe('ListingSubmittedConsumer : erreurs de validation imbriquees', () => {
  it('rejette le message meme quand une erreur de validation ne porte aucune contrainte', async () => {
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    // Une erreur sans `constraints` (cas d'un objet imbrique invalide) : seul le detail des enfants existe.
    jest.mocked(validate).mockResolvedValueOnce([{ property: 'details', children: [] } as unknown as ValidationError]);
    const publish = jest.fn().mockResolvedValue({ seq: 1 });
    const nats = { jetstream: jest.fn().mockResolvedValue({ publish }) } as unknown as NatsClient;
    const consumer = new ListingSubmittedConsumer(nats, { enqueue: jest.fn() } as unknown as ModerationService);
    const message = {
      data: new TextEncoder().encode('{}'),
      json: () => ({}),
      ack: jest.fn(),
      nak: jest.fn(),
      term: jest.fn(),
    } as unknown as JsMsg;

    await consumer.handle(message);

    expect(message.term).toHaveBeenCalledWith(expect.stringContaining('message invalide'));
    expect(message.ack).not.toHaveBeenCalled();
    jest.restoreAllMocks();
  });
});
