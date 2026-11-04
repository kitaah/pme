#!/usr/bin/env bash
# Affiche un jeton d'acces Keycloak pour un utilisateur de demonstration (client pme-cli, mot de passe direct).
# Usage : KEYCLOAK_URL=http://localhost:8081 ./scripts/token.sh membre
set -euo pipefail

KEYCLOAK_URL="${KEYCLOAK_URL:-http://localhost:8081}"
USERNAME="${1:-membre}"

# Les mots de passe de demonstration sont identiques aux noms d'utilisateur (voir k8s/config/realm-pme.json)
response=$(curl -s -X POST "$KEYCLOAK_URL/realms/pme/protocol/openid-connect/token" \
  -d grant_type=password -d client_id=pme-cli -d "username=$USERNAME" -d "password=$USERNAME")

python3 -c '
import json, sys
data = json.loads(sys.argv[1])
if "access_token" not in data:
    sys.exit("Echec d authentification : " + str(data))
print(data["access_token"])
' "$response"
