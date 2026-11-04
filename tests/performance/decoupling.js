// Preuve du decouplage : le temps de reponse du depot ne depend pas de la disponibilite du service de moderation.
// Ce scenario est lance deux fois par scripts/perf-decoupling.sh (PHASE=up puis PHASE=down, service de
// moderation arrete entre les deux) avec exactement les memes seuils.
import { check, sleep } from 'k6';
import { createListing, login } from './common.js';

export const options = {
  vus: 5,
  duration: '30s',
  thresholds: {
    http_req_failed: ['rate<0.01'],
    'http_req_duration{name:create_listing}': ['p(95)<500'],
    checks: ['rate>0.99'],
  },
};

export function setup() {
  return { token: login('membre') };
}

export default function (data) {
  const res = createListing(data.token);
  check(res, { 'depot : 201': (r) => r.status === 201 });
  sleep(0.5);
}
