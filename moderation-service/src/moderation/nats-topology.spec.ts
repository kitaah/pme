import { Logger } from '@nestjs/common';
import { connect } from 'nats';
import { LISTINGS_DLQ_STREAM, LISTINGS_STREAM, MODERATION_CONSUMER } from './listing-submitted.event';
import { ensureStreams } from './nats-topology';

jest.mock('nats', () => ({
  ...jest.requireActual<typeof import('nats')>('nats'),
  connect: jest.fn(),
}));

describe('ensureStreams', () => {
  const options = { host: 'nats', port: 4222, user: 'moderation', password: 'secret' };
  const connectMock = connect as jest.Mock;
  let jsm: { streams: { add: jest.Mock; update: jest.Mock }; consumers: { add: jest.Mock } };
  let connection: { jetstreamManager: jest.Mock; close: jest.Mock };

  beforeEach(() => {
    jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    jsm = {
      streams: { add: jest.fn().mockResolvedValue({}), update: jest.fn().mockResolvedValue({}) },
      consumers: { add: jest.fn().mockResolvedValue({}) },
    };
    connection = { jetstreamManager: jest.fn().mockResolvedValue(jsm), close: jest.fn().mockResolvedValue(undefined) };
    connectMock.mockReset().mockResolvedValue(connection);
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it('declare les deux flux et le consommateur durable, puis ferme la connexion', async () => {
    await ensureStreams(options);

    expect(jsm.streams.add).toHaveBeenCalledTimes(2);
    expect(jsm.streams.add).toHaveBeenCalledWith(expect.objectContaining({ name: LISTINGS_STREAM }));
    expect(jsm.streams.add).toHaveBeenCalledWith(expect.objectContaining({ name: LISTINGS_DLQ_STREAM }));
    expect(jsm.consumers.add).toHaveBeenCalledWith(
      LISTINGS_STREAM,
      expect.objectContaining({ durable_name: MODERATION_CONSUMER, max_deliver: -1 }),
    );
    expect(connection.close).toHaveBeenCalledTimes(1);
    expect(connectMock.mock.calls[0][0]).not.toHaveProperty('tls');
  });

  it('active le TLS quand l autorite de certification est fournie', async () => {
    await ensureStreams({ ...options, tlsCaFile: '/certs/ca.crt' });

    expect(connectMock).toHaveBeenCalledWith(expect.objectContaining({ tls: { caFile: '/certs/ca.crt' } }));
  });

  it('met a jour un flux qui existe deja avec une autre configuration', async () => {
    jsm.streams.add.mockRejectedValue(new Error('stream name already in use'));

    await ensureStreams(options);

    expect(jsm.streams.update).toHaveBeenCalledTimes(2);
    expect(jsm.streams.update).toHaveBeenCalledWith(
      LISTINGS_STREAM,
      expect.objectContaining({ name: LISTINGS_STREAM }),
    );
  });

  it('ferme la connexion meme quand la declaration echoue', async () => {
    jsm.consumers.add.mockRejectedValue(new Error('consommateur refuse'));

    await expect(ensureStreams(options, 1)).rejects.toThrow('consommateur refuse');
    expect(connection.close).toHaveBeenCalledTimes(1);
  });

  it('abandonne apres le nombre maximal de tentatives', async () => {
    connectMock.mockRejectedValue(new Error('broker absent'));

    await expect(ensureStreams(options, 1)).rejects.toThrow('broker absent');
    expect(connectMock).toHaveBeenCalledTimes(1);
  });

  it('reessaie apres 3 secondes quand le broker n est pas encore joignable', async () => {
    jest.useFakeTimers();
    connectMock.mockRejectedValueOnce(new Error('broker absent'));

    const done = ensureStreams(options, 3);
    await jest.advanceTimersByTimeAsync(3000);
    await done;

    expect(connectMock).toHaveBeenCalledTimes(2);
    expect(Logger.prototype.warn).toHaveBeenCalledTimes(1);
    expect(jsm.consumers.add).toHaveBeenCalledTimes(1);
  });
});
