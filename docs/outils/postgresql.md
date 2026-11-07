# PostgreSQL

## Fiche d'identité

| Information | Détail |
|---|---|
| **Rôle** | Stocke les données de la plateforme dans des bases relationnelles |
| **Chiffrement** | TLS 1.3 obligatoire pour les connexions venant du réseau |
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
- **TLS** : technique qui chiffre une connexion et prouve l'identité du serveur.
- **`pg_hba.conf`** : fichier qui décide qui peut se connecter, depuis où et comment.
- **`verify-full`** : réglage côté client qui exige le chiffrement et vérifie le nom du serveur.

## Rôle dans le projet

- Il stocke les annonces dans la base `pme`.
- Il stocke la file de modération dans la base `moderation`.
- Il stocke les comptes et les rôles de Keycloak dans la base `keycloak`.
- Il stocke les tableaux de bord de Grafana dans la base `grafana`.
- Sans lui, aucune donnée n'est conservée et les services ne démarrent plus.
- Il n'accepte du réseau que des connexions chiffrées, avec un certificat fourni par cert-manager.

## Fichiers et dossiers principaux

| Fichier ou dossier | Description |
|---|---|
| `k8s/01-postgres.yaml` | Déploie PostgreSQL dans Minikube, avec son volume de données. |
| `k8s/config/postgres-init.sh` | Crée les bases supplémentaires au premier démarrage. |
| `k8s/config/postgres-hba.conf` | Impose le chiffrement aux connexions venant du réseau. |
| `k8s/00-internal-tls.yaml` | Demande le certificat du serveur à cert-manager. |
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
| `make ca-configmap` | Copie l'autorité locale dans le namespace, pour que les services vérifient le certificat. |

!!! warning "Attention"
    `make undeploy` supprime le volume : toutes les données sont perdues.

!!! note "À savoir"
    Le script de création des bases ne s'exécute qu'au premier démarrage du volume. Sur un cluster existant, la base de
    Grafana se crée avec `make create-grafana-db`.

!!! note "Chiffrement des connexions"
    Les règles d'accès (`hostssl`) refusent toute connexion en clair venant du réseau : le chiffrement est imposé par le
    serveur, et non laissé au choix des clients. L'API, le service de modération, Keycloak et Grafana vérifient en plus
    le nom du serveur contre l'autorité locale (`verify-full`). Les sondes de Kubernetes, qui passent par l'adresse
    locale du pod, et les scripts lancés dans le pod, qui passent par la socket Unix, en sont dispensés.
    PostgreSQL ne relit son certificat qu'au redémarrage : après un renouvellement, lancer
    `kubectl -n pme rollout restart deploy/postgres`.

!!! note "Budget de connexions"
    PostgreSQL accepte 100 connexions au maximum. Chaque service a un plafond : 10 par pod pour l'API, 5 pour la
    modération, 10 au total pour Keycloak et 10 pour Grafana. Avec 4 pods maximum par service, le total atteint 80,
    ce qui laisse de la marge pour les déploiements et pour Adminer. Si l'autoscaler ou un plafond change, refaire le
    calcul (voir `k8s/01-postgres.yaml`).

## Pour aller plus loin

- [Site officiel de PostgreSQL](https://www.postgresql.org/)
- [Documentation officielle](https://www.postgresql.org/docs/18/)
