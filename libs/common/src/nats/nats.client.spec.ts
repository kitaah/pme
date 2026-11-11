import { connect } from 'nats';
import { NatsClient } from './nats.client';

jest.mock('nats', () => ({ connect: jest.fn() }));

describe('NatsClient', () => {
  const options = { host: 'nats', port: 4222, user: 'api', password: 'secret' };
  const connectMock = connect as jest.Mock;
  let connection: { jetstream: jest.Mock; drain: jest.Mock };

  beforeEach(() => {
    connection = {
      jetstream: jest.fn().mockReturnValue({ publish: jest.fn() }),
      drain: jest.fn().mockResolvedValue(undefined),
    };
    connectMock.mockReset().mockResolvedValue(connection);
  });

  it("n'ouvre aucune connexion avant la premiere publication", () => {
    const client = new NatsClient(options, 'pme-test');

    expect(client).toBeInstanceOf(NatsClient);
    expect(connectMock).not.toHaveBeenCalled();
  });

  it('ouvre la connexion une seule fois et la reutilise', async () => {
    const client = new NatsClient(options, 'pme-test');

    const first = await client.jetstream();
    const second = await client.jetstream();

    expect(second).toBe(first);
    expect(connectMock).toHaveBeenCalledTimes(1);
    expect(connectMock).toHaveBeenCalledWith(
      expect.objectContaining({
        servers: 'nats:4222',
        user: 'api',
        pass: 'secret',
        name: 'pme-test',
        maxReconnectAttempts: -1,
      }),
    );
    expect(connectMock.mock.calls[0][0]).not.toHaveProperty('tls');
  });

  it('active le TLS quand l autorite de certification est fournie', async () => {
    const client = new NatsClient({ ...options, tlsCaFile: '/certs/ca.crt' }, 'pme-test');

    await client.jetstream();

    expect(connectMock).toHaveBeenCalledWith(expect.objectContaining({ tls: { caFile: '/certs/ca.crt' } }));
  });

  it("ne met pas en cache un echec de connexion : l'appel suivant retente", async () => {
    connectMock.mockRejectedValueOnce(new Error('broker absent'));
    const client = new NatsClient(options, 'pme-test');

    await expect(client.jetstream()).rejects.toThrow('broker absent');
    await expect(client.jetstream()).resolves.toBeDefined();

    expect(connectMock).toHaveBeenCalledTimes(2);
  });

  it("termine proprement les publications en cours a l'arret", async () => {
    const client = new NatsClient(options, 'pme-test');
    await client.jetstream();

    await client.onApplicationShutdown();

    expect(connection.drain).toHaveBeenCalledTimes(1);
  });

  it("ne fait rien a l'arret quand aucune connexion n'a ete ouverte", async () => {
    await new NatsClient(options, 'pme-test').onApplicationShutdown();

    expect(connection.drain).not.toHaveBeenCalled();
  });

  it("ne fait rien a l'arret quand la connexion a echoue", async () => {
    connectMock.mockRejectedValue(new Error('broker absent'));
    const client = new NatsClient(options, 'pme-test');
    await client.jetstream().catch(() => undefined);

    await expect(client.onApplicationShutdown()).resolves.toBeUndefined();
    expect(connection.drain).not.toHaveBeenCalled();
  });

  it("ignore l'echec d'une connexion encore en cours quand l'arret est demande", async () => {
    const rejections: Array<(error: Error) => void> = [];
    connectMock.mockReturnValue(new Promise((_resolve, reject) => rejections.push(reject)));
    const client = new NatsClient(options, 'pme-test');
    const opening = client.jetstream().catch(() => undefined);

    const shutdown = client.onApplicationShutdown();
    rejections[0](new Error('broker absent'));

    await opening;
    await expect(shutdown).resolves.toBeUndefined();
    expect(connection.drain).not.toHaveBeenCalled();
  });

  it("permet de rouvrir une connexion apres l'arret", async () => {
    const client = new NatsClient(options, 'pme-test');
    await client.jetstream();
    await client.onApplicationShutdown();

    await client.jetstream();

    expect(connectMock).toHaveBeenCalledTimes(2);
  });
});
