#!/bin/sh
# Test de performance en integration continue : l'API reelle, PostgreSQL et NATS, mesures par k6.
#
# Prerequis (fournis par le job CI) : PostgreSQL et NATS (JetStream) joignables, node, curl et k6 dans le PATH.
# Aucun Keycloak : un faux fournisseur d'identite signe le jeton (tests/performance/support/ci-environment.cjs).
# Les resultats (resume k6, journaux) sont ecrits dans perf-results/.
set -eu

ROOT=$(cd "$(dirname "$0")/.." && pwd)
OUT="$ROOT/perf-results"
mkdir -p "$OUT"

# Configuration de l'API, surchargeable de l'exterieur.
export DB_HOST="${DB_HOST:-localhost}" DB_PORT="${DB_PORT:-5432}" DB_NAME="${DB_NAME:-pme}"
export DB_USER="${DB_USER:-pme}" DB_PASSWORD="${DB_PASSWORD:-ci}"
export NATS_HOST="${NATS_HOST:-localhost}" NATS_PORT="${NATS_PORT:-4222}"
export NATS_USER="${NATS_USER:-pme}" NATS_PASSWORD="${NATS_PASSWORD:-ci}"
export KEYCLOAK_ISSUER="${KEYCLOAK_ISSUER:-https://keycloak.test/realms/pme}"
export KEYCLOAK_JWKS_URI="${KEYCLOAK_JWKS_URI:-http://127.0.0.1:9000/certs}"
export PORT="${PORT:-3000}"
# k6 envoie tout depuis une seule adresse IP : on leve la limitation de debit de l'API pour la duree du test.
export THROTTLE_LIMIT="${THROTTLE_LIMIT:-1000000}"

PIDS=""
cleanup() {
  status=$?
  for pid in $PIDS; do kill "$pid" 2>/dev/null || true; done
  if [ "$status" -ne 0 ] && [ -f "$OUT/api.log" ]; then
    echo "---- Fin du journal de l'API ----"
    tail -n 30 "$OUT/api.log"
  fi
  exit "$status"
}
trap cleanup EXIT INT TERM

wait_for() { # wait_for <description> <commande...> : reessaie pendant 30 s
  description=$1
  shift
  for _ in $(seq 1 30); do
    if "$@" >/dev/null 2>&1; then return 0; fi
    sleep 1
  done
  echo "Delai depasse : $description" >&2
  return 1
}

tcp_open() {
  node -e "require('net').connect(Number(process.argv[2]), process.argv[1]).on('connect', () => process.exit(0)).on('error', () => process.exit(1))" "$1" "$2"
}

echo "== Construction de l'API"
# api et libs/common sont des workspaces npm : installation a la racine, le module commun est compile avant l'API.
(cd "$ROOT" && npm ci --prefer-offline --workspace=api --workspace=libs/common && npm run build --workspace=libs/common && npm run build --workspace=api)

echo "== Attente de PostgreSQL"
wait_for "PostgreSQL ($DB_HOST:$DB_PORT)" tcp_open "$DB_HOST" "$DB_PORT"

echo "== Faux Keycloak et flux NATS"
rm -f "$OUT/token.txt"
API_DIR="$ROOT/api" TOKEN_FILE="$OUT/token.txt" NODE_PATH="$ROOT/node_modules" \
  node "$ROOT/tests/performance/support/ci-environment.cjs" >"$OUT/environment.log" 2>&1 &
PIDS="$PIDS $!"
wait_for "jeton de test" test -s "$OUT/token.txt"

echo "== Demarrage de l'API"
(cd "$ROOT/api" && NODE_ENV=production exec node dist/main.js) >"$OUT/api.log" 2>&1 &
PIDS="$PIDS $!"
wait_for "API prete" curl -fsS "http://127.0.0.1:$PORT/api/health/readiness"

echo "== Test de charge k6"
ACCESS_TOKEN=$(cat "$OUT/token.txt") \
  k6 run --quiet -e APP_URL="http://127.0.0.1:$PORT" -e PROFILE=ci \
  --summary-export="$OUT/summary.json" "$ROOT/tests/performance/load.js"
