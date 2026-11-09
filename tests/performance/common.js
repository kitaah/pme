// Fonctions communes aux scenarios k6.
import http from 'k6/http';
import { fail } from 'k6';

export const APP_URL = __ENV.APP_URL || 'https://pme.localhost';

/**
 * Jeton d'acces fourni par l'environnement de test (variable ACCESS_TOKEN, voir scripts/perf-ci.sh).
 */
export function login() {
  if (!__ENV.ACCESS_TOKEN) {
    fail('ACCESS_TOKEN manquant : lancer le test via scripts/perf-ci.sh');
  }
  return __ENV.ACCESS_TOKEN;
}

function headers(token) {
  return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
}

export function createListing(token) {
  const body = JSON.stringify({
    title: `Figurine k6 ${__VU}-${__ITER}`,
    description: 'Annonce creee par un test de charge k6.',
    condition: 'GOOD',
  });
  return http.post(`${APP_URL}/api/v1/listings`, body, { headers: headers(token), tags: { name: 'create_listing' } });
}

export function myListings(token) {
  return http.get(`${APP_URL}/api/v1/listings/mine?limit=20`, {
    headers: headers(token),
    tags: { name: 'my_listings' },
  });
}
