// Fonctions communes aux scenarios k6.
import http from 'k6/http';
import { check, fail } from 'k6';

export const APP_URL = __ENV.APP_URL || 'https://pme.localhost';
export const KEYCLOAK_URL = __ENV.KEYCLOAK_URL || 'https://keycloak.localhost';

/** Jeton Keycloak via le client de test pme-cli (le mot de passe de demonstration vaut le nom d'utilisateur). */
export function login(username) {
  const res = http.post(
    `${KEYCLOAK_URL}/realms/pme/protocol/openid-connect/token`,
    { grant_type: 'password', client_id: 'pme-cli', username, password: __ENV.KC_PASSWORD || username },
    { tags: { name: 'login' } },
  );
  if (!check(res, { 'connexion Keycloak (200)': (r) => r.status === 200 })) {
    fail(`Connexion impossible pour ${username} : HTTP ${res.status}`);
  }
  return res.json('access_token');
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
