import { generateKeyPairSync, KeyObject } from 'crypto';
import { createServer, Server } from 'http';
import { AddressInfo } from 'net';
import { sign } from 'jsonwebtoken';

/**
 * Faux Keycloak pour les tests : une paire de cles RSA, un serveur JWKS local et un generateur
 * de jetons. La validation de signature, de l'emetteur et du client est donc testee pour de vrai.
 */
export class FakeKeycloak {
  static readonly ISSUER = 'https://keycloak.test/realms/pme';
  private readonly privateKey: KeyObject;
  private readonly jwk: Record<string, unknown>;
  private server?: Server;
  jwksUri = '';

  constructor() {
    const { publicKey, privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
    this.privateKey = privateKey;
    this.jwk = { ...publicKey.export({ format: 'jwk' }), kid: 'test-key', alg: 'RS256', use: 'sig' };
  }

  async start(): Promise<void> {
    this.server = createServer((_req, res) => {
      res.setHeader('content-type', 'application/json');
      res.end(JSON.stringify({ keys: [this.jwk] }));
    });
    await new Promise<void>((resolve) => this.server!.listen(0, '127.0.0.1', resolve));
    const { port } = this.server.address() as AddressInfo;
    this.jwksUri = `http://127.0.0.1:${port}/certs`;
  }

  async stop(): Promise<void> {
    const server = this.server;
    if (!server) return; // start() a echoue : rien a fermer, et surtout ne pas attendre indefiniment
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }

  token(
    options: {
      sub?: string;
      username?: string;
      roles?: string[];
      azp?: string;
      issuer?: string;
      expiresIn?: number;
    } = {},
  ): string {
    return sign(
      {
        sub: options.sub ?? '11111111-1111-4111-8111-111111111111',
        preferred_username: options.username ?? 'membre',
        azp: options.azp ?? 'pme-web',
        realm_access: { roles: options.roles ?? ['membre'] },
      },
      this.privateKey,
      {
        algorithm: 'RS256',
        keyid: 'test-key',
        issuer: options.issuer ?? FakeKeycloak.ISSUER,
        expiresIn: options.expiresIn ?? 300,
      },
    );
  }
}
