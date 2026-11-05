# NestJS

## Fiche d'identité

| Information | Détail |
|---|---|
| **Rôle** | Construit le back-end de la plateforme : il reçoit les demandes de l'interface et applique les règles étier |
| **Version** | NestJS 11.2.8 |
| **Adresse en local** | <http://pme.localhost/api> |

## Description

NestJS est un framework libre qui sert à construire le back-end d'une application web. Il est écrit en TypeScript. Il
organise le code en modules, chacun chargé d'un sujet précis, comme les annonces ou la connexion. NestJS expose une API
REST : il reçoit les demandes de l'interface, applique les règles métier, puis renvoie la réponse.

**Définitions**

- **Module** : ensemble de fichiers regroupés autour d'un même sujet.

## Rôle dans le projet

- Il constitue le back-end de la nouvelle plateforme, exposé en API REST.
- Il est découplé du front-end : les deux parties communiquent uniquement par l'API.
- Il applique les règles métiers et vérifie les droits de chaque utilisateur, grâce au jeton délivré par Keycloak.
- Il publie des événements dans NATS pour les autres services, sans attendre leur traitement.

## Fichiers et dossiers principaux

| Fichier ou dossier | Description |
|---|---|
| `api/src/main.ts` | Point d'entrée : démarre l'API et règle sa sécurité. |
| `api/src/app.module.ts` | Module principal, qui assemble tous les autres. |
| `api/src/listings/` | Module des annonces : réception, contrôle et enregistrement. |
| `api/src/auth/` | Module de connexion : vérifie le jeton et le rôle de l'utilisateur. |
| `api/src/config/` | Lit la configuration de l'API. |
| `api/package.json` | Liste les dépendances et les commandes de l'API. |
| `api/Dockerfile` | Fabrique l'image Docker de l'API. |

## Commandes essentielles

À lancer dans un terminal, depuis le dossier du projet. `Ctrl+C` arrête une commande en cours.

| Commande | Description |
|---|---|
| `make install` | Installe les dépendances. |
| `make api` | Démarre l'API et la redémarre à chaque modification du code. |
| `make test` | Lance les tests automatiques. |
| `make test-integration` | Teste l'API avec de vraies bases de données, Docker démarré. |
| `make image-api` | Fabrique l'image Docker de l'API dans Minikube. |
| `make logs-api` | Affiche le journal de l'API, mis à jour en direct. |

!!! note "À savoir"
`make api` a besoin de la base de données, de NATS et de Keycloak : lancer d'abord `make port-forward`.

## Pour aller plus loin

- [Site officiel de NestJS](https://nestjs.com/)
- [Documentation officielle](https://docs.nestjs.com/)