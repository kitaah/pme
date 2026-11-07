'use strict';
/**
 * Environnement des tests de performance en CI : un faux fournisseur d'identite et le flux NATS.
 *
 * - Faux Keycloak : une paire de cles RSA, un serveur JWKS local et un jeton signe, ecrit dans TOKEN_FILE.
 *   L'API verifie donc pour de vrai la signature, l'emetteur et le client, sans demarrer Keycloak.
 *   (Keycloak est un produit tiers : sa charge se mesure sur l'environnement de recette, pas dans la CI.)
 * - Flux NATS : declare comme le fait le service de moderation, dont l'API depend pour publier.
 *
 * Le processus reste en vie pour servir le JWKS ; scripts/perf-ci.sh l'arrete a la fin.
 * Variables : API_DIR, TOKEN_FILE, NATS_HOST, NATS_PORT, NATS_USER, NATS_PASSWORD, KEYCLOAK_ISSUER, IDP_PORT.
 */
const { generateKeyPairSync, sign } = require('node:crypto');
const { createServer } = require('node:http');
const { writeFileSync } = require('node:fs');
const path = require('node:path');
const { connect, RetentionPolicy, StorageType } = require('nats');

const env = process.env;
const apiDir = env.API_DIR || path.resolve(__dirname, '../../../api');
const { LISTINGS_STREAM, LISTING_SUBMITTED_SUBJECT } = require(path.join(apiDir, 'dist/listings/listing-events.js'));

const issuer = env.KEYCLOAK_ISSUER || 'https://keycloak.test/realms/pme';
const idpPort = Number(env.IDP_PORT || 9000);
const tokenFile = env.TOKEN_FILE || 'perf-results/token.txt';

const base64url = (value) => Buffer.from(value).toString('base64url');

function createToken(privateKey) {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: 'RS256', typ: 'JWT', kid: 'perf-key' };
  const payload = {
    sub: '11111111-1111-4111-8111-111111111111',
    preferred_username: 'membre',
    azp: 'pme-web',
    realm_access: { roles: ['membre'] },
    iss: issuer,
    iat: now,
    exp: now + 15 * 60,
  };
  const unsigned = `${base64url(JSON.stringify(header))}.${base64url(JSON.stringify(payload))}`;
  return `${unsigned}.${sign('RSA-SHA256', Buffer.from(unsigned), privateKey).toString('base64url')}`;
}

async function declareStream() {
  const options = {
    servers: `${env.NATS_HOST || 'localhost'}:${env.NATS_PORT || 4222}`,
    user: env.NATS_USER,
    pass: env.NATS_PASSWORD,
    timeout: 3000,
  };
  // NATS demarre en meme temps que le job : on reessaie pendant 30 s.
  for (let attempt = 1; ; attempt++) {
    try {
      const connection = await connect(options);
      const jsm = await connection.jetstreamManager();
      await jsm.streams.add({
        name: LISTINGS_STREAM,
        subjects: [LISTING_SUBMITTED_SUBJECT],
        retention: RetentionPolicy.Workqueue,
        storage: StorageType.File,
      });
      await connection.close();
      return;
    } catch (error) {
      if (attempt >= 15) throw error;
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }
  }
}

async function main() {
  const { publicKey, privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
  const jwk = { ...publicKey.export({ format: 'jwk' }), kid: 'perf-key', alg: 'RS256', use: 'sig' };
  const server = createServer((_req, res) => {
    res.setHeader('content-type', 'application/json');
    res.end(JSON.stringify({ keys: [jwk] }));
  });
  await new Promise((resolve) => server.listen(idpPort, '127.0.0.1', resolve));

  await declareStream();
  writeFileSync(tokenFile, createToken(privateKey));
  console.log(`Faux Keycloak sur le port ${idpPort}, flux ${LISTINGS_STREAM} declare, jeton ecrit dans ${tokenFile}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
