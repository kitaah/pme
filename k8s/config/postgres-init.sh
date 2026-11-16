#!/bin/sh
# Execute une seule fois, a la premiere initialisation du volume PostgreSQL.
# Une base par composant, et UN COMPTE PAR BASE : `pme` (API), `moderation` (service de moderation), `keycloak` et
# `grafana` (etat interne de Grafana). Chaque compte est proprietaire de sa seule base : il ne peut ni s'y connecter
# a une autre, ni lire ses tables. Le superutilisateur (POSTGRES_USER) ne sert plus qu'a l'administration (Adminer, psql).
# Les mots de passe viennent du Secret `pme-secrets` (variables DB_*_PASSWORD de k8s/03-postgres.yaml). Les regles
# reseau qui completent ces droits sont dans postgres-hba.conf.
set -e
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" \
  -v api_pw="$DB_API_PASSWORD" -v moderation_pw="$DB_MODERATION_PASSWORD" \
  -v keycloak_pw="$DB_KEYCLOAK_PASSWORD" -v grafana_pw="$DB_GRAFANA_PASSWORD" <<'SQL'
-- Groupe sans connexion : sert a nommer tous les comptes de service dans postgres-hba.conf (+pme_services).
CREATE ROLE pme_services NOLOGIN;
CREATE ROLE pme_api        LOGIN PASSWORD :'api_pw'        IN ROLE pme_services;
CREATE ROLE pme_moderation LOGIN PASSWORD :'moderation_pw' IN ROLE pme_services;
CREATE ROLE pme_keycloak   LOGIN PASSWORD :'keycloak_pw'   IN ROLE pme_services;
CREATE ROLE pme_grafana    LOGIN PASSWORD :'grafana_pw'    IN ROLE pme_services;

-- `pme` est creee par l'image (POSTGRES_DB) : elle passe au compte de l'API.
ALTER DATABASE pme OWNER TO pme_api;
CREATE DATABASE moderation OWNER pme_moderation;
CREATE DATABASE keycloak   OWNER pme_keycloak;
CREATE DATABASE grafana    OWNER pme_grafana;

-- Par defaut, tout compte peut se connecter a toute base : on retire ce droit. Le proprietaire garde le sien.
REVOKE CONNECT ON DATABASE pme, moderation, keycloak, grafana FROM PUBLIC;
SQL
