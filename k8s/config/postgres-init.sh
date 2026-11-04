#!/bin/sh
# Execute une seule fois, a la premiere initialisation du volume PostgreSQL.
# Une base par composant : `pme` (API, creee par POSTGRES_DB), `moderation` (service de moderation)
# et `keycloak`. Remplace la commande manuelle `make create-keycloak-db` du projet Spring.
set -e
for db in keycloak moderation; do
  psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" -c "CREATE DATABASE $db;"
done
