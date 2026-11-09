// Test de charge : des utilisateurs virtuels deposent des annonces et consultent les leurs.
//
// Deux profils, meme scenario et memes seuils :
//   - complet (defaut) : 20 utilisateurs virtuels, 1 min 45.
//   - ci (PROFILE=ci) : 10 utilisateurs virtuels, 1 min, sur l'API demarree dans le pipeline (scripts/perf-ci.sh).
//
// Les seuils font echouer la commande (code de sortie 99) : le test est directement exploitable en CI.
import { check, sleep } from 'k6';
import { createListing, login, myListings } from './common.js';

const PROFILES = {
  complet: [
    { duration: '30s', target: 20 },
    { duration: '1m', target: 20 },
    { duration: '15s', target: 0 },
  ],
  ci: [
    { duration: '10s', target: 10 },
    { duration: '40s', target: 10 },
    { duration: '10s', target: 0 },
  ],
};

export const options = {
  stages: PROFILES[__ENV.PROFILE || 'complet'],
  thresholds: {
    http_req_failed: ['rate<0.01'], // moins de 1 % d'erreurs HTTP
    'http_req_duration{name:create_listing}': ['p(95)<500'], // 95 % des depots en moins de 500 ms
    'http_req_duration{name:my_listings}': ['p(95)<500'],
    checks: ['rate>0.99'],
  },
};

export function setup() {
  return { token: login() };
}

export default function (data) {
  const created = createListing(data.token);
  check(created, {
    'depot : 201': (r) => r.status === 201,
    'depot : statut en attente de moderation': (r) => r.status === 201 && r.json('status') === 'PENDING_MODERATION',
  });
  sleep(1);

  const mine = myListings(data.token);
  check(mine, { 'mes annonces : 200': (r) => r.status === 200 });
  sleep(1);
}
