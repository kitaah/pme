# PostgreSQL

## Fiche d'identité

| Information | Détail |
|---|---|
| **Rôle** | Stocke les données de la plateforme dans des bases relationnelles |
| **Version** | PostgreSQL 18 |
| **Adresse en local** | `localhost:5432` (après `make port-forward`) |

## Description

PostgreSQL est un système de gestion de bases de données libre. Il range les données dans des tables, composées de
lignes et de colonnes. Il se pilote avec le langage SQL. Il garantit que chaque modification est enregistrée en entier
ou pas du tout. Une même instance PostgreSQL peut héberger plusieurs bases indépendantes.

**Définitions**

- **Base de données** : espace qui regroupe les tables d'une même application.
- **Table** : tableau de données. Chaque ligne est un enregistrement, chaque colonne est une information.
- **SQL** : langage qui sert à lire et à modifier les données d'une base.
- **Instance** : programme PostgreSQL en fonctionnement. Il héberge une ou plusieurs bases.
- **Volume** : espace disque conservé quand le conteneur s'arrête ou redémarre.

## Rôle dans le projet

- Il stocke les annonces dans la base `pme`.
- Il stocke la file de modération dans la base `moderation`.
- Il stocke les comptes et les rôles de Keycloak dans la base `keycloak`.
- Il stocke les tableaux de bord de Grafana dans la base `grafana`.
- Sans lui, aucune donnée n'est conservée et les services ne démarrent plus.

## Fichiers et dossiers principaux

| Fichier ou dossier | Description |
|---|---|
| `k8s/01-postgres.yaml` | Déploie PostgreSQL dans Minikube, avec son volume de données. |
| `k8s/config/postgres-init.sh` | Crée les bases supplémentaires au premier démarrage. |
| `api/src/config/configuration.ts` | Lit les paramètres de connexion de l'API. |
| `moderation-service/src/config/configuration.ts` | Lit les paramètres de connexion du service de modération. |
| `api/src/migrations/` | Contient les scripts qui créent et font évoluer les tables de l'API. |
| `.env` | Contient l'identifiant et le mot de passe de la base. |

## Commandes essentielles

À lancer dans un terminal, depuis le dossier du projet, Minikube démarré.

| Commande | Description |
|---|---|
| `make deploy` | Installe PostgreSQL avec le reste de la plateforme. |
| `make pods` | Indique si PostgreSQL est prêt. |
| `make port-forward` | Rend PostgreSQL accessible sur l'ordinateur. |
| `make db-listings` | Affiche les annonces enregistrées. |
| `make db-moderation` | Affiche les annonces en attente de modération. |
| `make create-grafana-db` | Crée la base de Grafana sur un cluster déjà installé. |

!!! warning "Attention"
`make undeploy` supprime le volume : toutes les données sont perdues.

!!! note "À savoir"
Le script de création des bases ne s'exécute qu'au premier démarrage du volume. Sur un cluster existant, la base de
Grafana se crée avec `make create-grafana-db`.

## Pour aller plus loin

- [Site officiel de PostgreSQL](https://www.postgresql.org/)
- [Documentation officielle](https://www.postgresql.org/docs/18/)