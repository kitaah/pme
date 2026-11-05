# Keycloak

## Fiche d'identité

| Information | Détail |
|---|---|
| **Rôle** | Gère les comptes et la connexion des utilisateurs, et délivre les jetons d'accès |
| **Version** | Keycloak 24.0.0 |
| **Adresse en local** | <http://localhost:8081> (après `make port-forward`) |

## Description

Keycloak est une solution libre de gestion des identités et des accès. Il authentifie les utilisateurs, centralise leurs
comptes et leurs rôles, puis délivre un jeton d'accès signé. Les applications se contentent de vérifier ce jeton : elles
ne stockent ni ne voient jamais les mots de passe.

## Rôle dans le projet

- Il est la solution d'identité et d'accès (CIAM) du nouveau SI.
- Il authentifie les visiteurs, les membres, les modérateurs, les gestionnaires, les rédacteurs et les administrateurs.
- Il centralise les comptes, les rôles et les habilitations : l'administrateur les gère à un seul endroit.
- Il permet au front-end et à l'API REST, découplés, de partager la même authentification.
- Il dispose de sa propre base de données, séparée de celle des applications.

## Fichiers et dossiers principaux

| Fichier ou dossier | Description |
|---|---|
| `k8s/03-keycloak.yaml` | Démarre Keycloak dans Minikube. |
| `k8s/config/realm-pme.json` | Décrit l'espace « pme » : rôles, applications autorisées, comptes de démonstration. |
| `k8s/config/postgres-init.sh` | Crée la base de données de Keycloak au premier démarrage. |
| `frontend/src/auth.ts` | Envoie le visiteur vers la page de connexion et récupère son jeton. |
| `api/src/auth/jwt.strategy.ts` | Vérifie le jeton reçu par l'API. |
| `scripts/token.sh` | Demande un jeton de test à Keycloak. |
| `.env` | Contient l'identifiant et le mot de passe de la console d'administration. |

## Commandes essentielles

À lancer dans un terminal, depuis le dossier du projet, Minikube démarré.

| Commande | Description |
|---|---|
| `make deploy` | Installe Keycloak avec le reste de la plateforme. |
| `make pods` | Indique si Keycloak est prêt. Il met environ une minute à démarrer. |
| `make port-forward` | Rend Keycloak accessible sur le poste. |
| `make open-keycloak` | Ouvre la console d'administration dans le navigateur. |
| `make token KC_USER=membre` | Affiche un jeton de test pour un utilisateur. |
| `make logs-keycloak` | Affiche les messages de Keycloak. |

!!! note "À savoir"
Un compte de démonstration existe : `membre`.

## Pour aller plus loin

- [Site officiel de Keycloak](https://www.keycloak.org/)
- [Documentation officielle](https://www.keycloak.org/documentation)