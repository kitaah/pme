#!/usr/bin/env bash
# Protocole de verification du disjoncteur PostgreSQL, sur le cluster deploye : couper la base, observer l'etat, la remettre.
# Usage : make breaker-test   (ou NS=pme APP_URL=... KEYCLOAK_URL=... ./scripts/verify-breaker.sh)
set -uo pipefail

NS="${NS:-pme}"
APP_URL="${APP_URL:-https://pme.localhost}"
KEYCLOAK_URL="${KEYCLOAK_URL:-https://keycloak.localhost}"
DIR="$(cd "$(dirname "$0")" && pwd)"
CA_FILE="${CA_FILE:-pme-ca.crt}"
if [ -f "$CA_FILE" ]; then CURL_TLS=(--cacert "$CA_FILE"); else CURL_TLS=(-k); fi
failures=0

check() { # check <description> <attendu> <obtenu>
  if [ "$2" = "$3" ]; then echo "  OK   $1"; else echo "  ECHEC $1 (attendu $2, obtenu $3)"; failures=$((failures + 1)); fi
}
# Etat du disjoncteur lu dans les metriques de l'API : 0 = ferme, 1 = semi-ouvert, 2 = ouvert.
breaker_state() {
  kubectl -n "$NS" exec deploy/pme-api -- wget -qO- http://127.0.0.1:3000/api/metrics 2>/dev/null \
    | awk '/^circuit_breaker_state\{name="postgresql"\}/ {print $2}'
}
# Appel authentifie : affiche "<code> <duree en ms>".
call_api() {
  curl -s "${CURL_TLS[@]}" -o /dev/null -w '%{http_code} %{time_total}\n' -H "Authorization: Bearer $TOKEN" "$APP_URL/api/v1/listings/mine" \
    | awk '{printf "%s %d\n", $1, $2 * 1000}'
}
# La base est toujours remise en service, meme si le script est interrompu.
restore_db() { kubectl -n "$NS" scale deployment postgres --replicas=1 >/dev/null 2>&1; }
trap restore_db EXIT

echo "1. Etat initial"
TOKEN=$(KEYCLOAK_URL="$KEYCLOAK_URL" "$DIR/token.sh" membre) || { echo "  ECHEC impossible d'obtenir un jeton"; exit 1; }
check "l'API repond 200" 200 "$(call_api | cut -d' ' -f1)"
check "disjoncteur ferme (0)" 0 "$(breaker_state)"

echo "2. Coupure de la base"
kubectl -n "$NS" scale deployment postgres --replicas=0 >/dev/null
kubectl -n "$NS" wait --for=delete pod -l app.kubernetes.io/name=postgres --timeout=60s >/dev/null 2>&1
state=""
for _ in $(seq 1 20); do
  call_api >/dev/null
  state=$(breaker_state)
  [ "$state" = "2" ] && break
  sleep 1
done
check "disjoncteur ouvert (2) apres des appels en echec" 2 "$state"
read -r code ms <<<"$(call_api)"
check "circuit ouvert : reponse 503" 503 "$code"
check "circuit ouvert : reponse en moins d'une seconde" yes "$([ "$ms" -lt 1000 ] && echo yes || echo no)"

echo "3. Remise en service"
kubectl -n "$NS" scale deployment postgres --replicas=1 >/dev/null
kubectl -n "$NS" rollout status deployment/postgres --timeout=120s >/dev/null
state=""
for _ in $(seq 1 40); do
  code=$(call_api | cut -d' ' -f1)
  state=$(breaker_state)
  [ "$code" = "200" ] && [ "$state" = "0" ] && break
  sleep 2
done
check "l'API repond de nouveau 200" 200 "$code"
check "disjoncteur referme (0)" 0 "$state"

echo
if [ "$failures" -eq 0 ]; then echo "Disjoncteur verifie."; else echo "$failures verification(s) en echec."; exit 1; fi