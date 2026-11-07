#!/usr/bin/env bash
# Demonstration du disjoncteur PostgreSQL, sur le cluster deploye : couper la base, observer l'etat, la remettre.
# Usage : make demo-breaker   (ou NS=pme APP_URL=... KEYCLOAK_URL=... ./scripts/demo-breaker.sh)
set -uo pipefail

NS="${NS:-pme}"
APP_URL="${APP_URL:-https://pme.localhost}"
KEYCLOAK_URL="${KEYCLOAK_URL:-https://keycloak.localhost}"
DIR="$(cd "$(dirname "$0")" && pwd)"
CA_FILE="${CA_FILE:-pme-ca.crt}"
if [ -f "$CA_FILE" ]; then CURL_TLS=(--cacert "$CA_FILE"); else CURL_TLS=(-k); fi

# Etat du disjoncteur lu dans les metriques de l'API : 0 = ferme, 1 = semi-ouvert, 2 = ouvert.
breaker_state() {
  case "$(kubectl -n "$NS" exec deploy/pme-api -- wget -qO- http://127.0.0.1:3000/api/metrics 2>/dev/null \
    | awk '/^circuit_breaker_state\{name="postgresql"\}/ {print $2}')" in
    0) echo "ferme" ;; 1) echo "semi-ouvert" ;; 2) echo "OUVERT" ;; *) echo "inconnu" ;;
  esac
}
# Un appel authentifie a l'API : affiche le code HTTP et la duree.
call_api() { # call_api <numero>
  curl -s "${CURL_TLS[@]}" -o /dev/null -w "  appel $1 : HTTP %{http_code} en %{time_total}s" \
    -H "Authorization: Bearer $TOKEN" "$APP_URL/api/v1/listings/mine"
  echo "   | disjoncteur : $(breaker_state)"
}
# La base est toujours remise en service, meme si le script est interrompu.
restore_db() { kubectl -n "$NS" scale deployment postgres --replicas=1 >/dev/null 2>&1; }
trap restore_db EXIT

TOKEN=$(KEYCLOAK_URL="$KEYCLOAK_URL" "$DIR/token.sh" membre) || { echo "Impossible d'obtenir un jeton"; exit 1; }

echo "1. Base en service"
call_api 1

echo "2. Coupure de la base : les premiers appels sont lents, puis le circuit s'ouvre et le 503 devient immediat"
kubectl -n "$NS" scale deployment postgres --replicas=0 >/dev/null
kubectl -n "$NS" wait --for=delete pod -l app.kubernetes.io/name=postgres --timeout=60s >/dev/null 2>&1
for i in $(seq 1 12); do call_api "$i"; sleep 1; done

echo "3. Remise en service : le circuit se referme apres un appel d'essai reussi"
kubectl -n "$NS" scale deployment postgres --replicas=1 >/dev/null
kubectl -n "$NS" rollout status deployment/postgres --timeout=120s >/dev/null
for i in $(seq 1 15); do call_api "$i"; sleep 2; done