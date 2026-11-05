# Adminer

## Fiche d'identité

| Information | Détail |
|---|---|
| **Rôle** | Permet de consulter les bases PostgreSQL depuis un navigateur |
| **Version** | Adminer 4.8.1 |
| **Adresse en local** | <http://adminer.localhost> |

## Description

Adminer est un outil libre d'administration de bases de données. Il s'utilise dans un navigateur web. Il affiche les
tables, leurs colonnes et leurs lignes. Il permet aussi d'exécuter des requêtes SQL. Il ne stocke aucun compte : il se
connecte à la base avec l'identifiant et le mot de passe saisis sur la page de connexion.

**Définitions**

- **Requête SQL** : instruction écrite en langage SQL pour lire ou modifier des données.
- **Table** : tableau de données. Chaque ligne est un enregistrement, chaque colonne est une information.

## Rôle dans le projet

- Il permet de vérifier le contenu des bases sans ligne de commande.
- Il sert à contrôler qu'une annonce créée dans l'interface est bien enregistrée.
- Il est réservé au développement et aux démonstrations.
- Sans lui, les bases restent consultables avec les commandes `make db-listings` et `make db-moderation`.

## Fichiers et dossiers principaux

| Fichier ou dossier | Description |
|---|---|
| `k8s/07-adminer.yaml` | Déploie Adminer dans Minikube. |
| `Makefile` | Contient la commande qui ouvre Adminer dans le navigateur. |
| `.env` | Contient l'identifiant et le mot de passe à saisir sur la page de connexion. |

## Commandes essentielles

À lancer dans un terminal, depuis le dossier du projet, Minikube démarré.

| Commande | Description |
|---|---|
| `make deploy` | Installe Adminer avec le reste de la plateforme. |
| `make adminer` | Ouvre Adminer dans le navigateur. |
| `make pods` | Indique si Adminer est prêt. |

!!! tip "Astuce"
Sur la page de connexion, choisir le système « PostgreSQL ». Le champ « Serveur » est déjà rempli. Saisir
l'identifiant et le mot de passe du fichier `.env`, puis le nom de la base : `pme`, `moderation`, `keycloak` ou
`grafana`.

!!! warning "Attention"
Adminer n'a pas d'authentification propre. Il ne doit jamais être exposé hors de l'ordinateur de l'équipe.

## Pour aller plus loin

- [Site officiel d'Adminer](https://www.adminer.org/)