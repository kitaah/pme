#!/usr/bin/env bash
# Scenario de bout en bout en ligne de commande, sur le cluster deploye : les memes etapes que la demonstration.
# Usage : make smoke   (ou APP_URL=... KEYCLOAK_URL=... ./scripts/smoke.sh)
set -uo pipefail

APP_URL="${APP_URL:-https://pme.localhost}"
KEYCLOAK_URL="${KEYCLOAK_URL:-https://keycloak.localhost}"
DIR="$(cd "$(dirname "$0")" && pwd)"
# Le certificat de l'ingress est signe par l'autorite locale du POC : curl lui fait confiance si pme-ca.crt existe
# (make ca-cert), sinon la verification est desactivee (-k), acceptable pour un cluster local uniquement.
CA_FILE="${CA_FILE:-pme-ca.crt}"
if [ -f "$CA_FILE" ]; then CURL_TLS=(--cacert "$CA_FILE"); else CURL_TLS=(-k); fi
failures=0

check() { # check <description> <attendu> <obtenu>
  if [ "$2" = "$3" ]; then echo "  OK   $1"; else echo "  ECHEC $1 (attendu $2, obtenu $3)"; failures=$((failures + 1)); fi
}
http_code() { curl -s "${CURL_TLS[@]}" -o /dev/null -w '%{http_code}' "$@"; }

echo "1. Connexion Keycloak"
MEMBER_TOKEN=$(KEYCLOAK_URL="$KEYCLOAK_URL" "$DIR/token.sh" membre) || { echo "  ECHEC impossible d'obtenir un jeton membre"; exit 1; }
MODERATOR_TOKEN=$(KEYCLOAK_URL="$KEYCLOAK_URL" "$DIR/token.sh" moderateur) || { echo "  ECHEC impossible d'obtenir un jeton moderateur"; exit 1; }
echo "  OK   jetons obtenus (membre, moderateur)"

TITLE="Figurine smoke $(date +%H%M%S)"

echo "2. Depot d'une annonce"
check "sans jeton -> 401" 401 "$(http_code -X POST "$APP_URL/api/v1/listings" -H 'Content-Type: application/json' -d '{}')"
check "annonce invalide (titre vide) -> 400" 400 "$(http_code -X POST "$APP_URL/api/v1/listings" \
  -H "Authorization: Bearer $MEMBER_TOKEN" -H 'Content-Type: application/json' \
  -d '{"title":"","description":"x","condition":"GOOD"}')"
check "annonce valide -> 201" 201 "$(http_code -X POST "$APP_URL/api/v1/listings" \
  -H "Authorization: Bearer $MEMBER_TOKEN" -H 'Content-Type: application/json' \
  -d "{\"title\":\"$TITLE\",\"description\":\"Annonce creee par le test de fumee\",\"condition\":\"GOOD\"}")"
check "l'annonce est en attente de moderation" 1 "$(curl -s "${CURL_TLS[@]}" "$APP_URL/api/v1/listings/mine" -H "Authorization: Bearer $MEMBER_TOKEN" \
  | grep -c "\"title\":\"$TITLE\".*PENDING_MODERATION\|PENDING_MODERATION.*\"title\":\"$TITLE\"")"

echo "3. File de moderation"
check "un membre n'y a pas acces -> 403" 403 "$(http_code "$APP_URL/api/v1/moderation/queue" -H "Authorization: Bearer $MEMBER_TOKEN")"
found=0
for _ in 1 2 3 4 5 6 7 8 9 10; do
  if curl -s "${CURL_TLS[@]}" "$APP_URL/api/v1/moderation/queue" -H "Authorization: Bearer $MODERATOR_TOKEN" | grep -q "$TITLE"; then found=1; break; fi
  sleep 1
done
check "le moderateur voit l'annonce dans la file (via NATS)" 1 "$found"

echo
if [ "$failures" -eq 0 ]; then echo "Test de fumee reussi."; else echo "$failures verification(s) en echec."; exit 1; fi