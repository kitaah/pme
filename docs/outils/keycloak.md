# Keycloak

## Fiche d'identité

| Information | Détail |
|---|---|
| **Rôle** | Gère les comptes, la connexion et les rôles des utilisateurs |
| **Version** | Keycloak 26.8.1 |
| **Adresse en local** | <https://keycloak.localhost> |

## Description

Keycloak est un outil libre de gestion des identités. Il affiche la page de connexion, vérifie l'identifiant et le mot
de passe, puis délivre un jeton. Ce jeton prouve l'identité de la personne et indique son rôle. Les autres services le
lisent pour accepter ou refuser une demande, sans jamais voir le mot de passe.

**Définitions**

- **Jeton** : justificatif signé, délivré après la connexion, que l'interface envoie à chaque demande.
- **Realm** : espace qui regroupe les comptes, les rôles et les applications d'un même projet. Ici, le realm `pme`.
- **Rôle** : droit attribué à un compte, par exemple « membre » ou « modérateur ».
- **Client** : application autorisée à demander une connexion. Ici, `pme-web` pour le site et `pme-cli` pour les tests.
- **Compte administrateur temporaire** : compte créé au tout premier démarrage pour amorcer l'installation. Keycloak
  recommande de le remplacer par un compte permanent.

## Rôle dans le projet

- Il gère la connexion des membres et des modérateurs.
- Il délivre les jetons que l'API et le service de modération vérifient.
- Il charge le realm `pme` au démarrage : comptes de test, rôles et adresses de retour autorisées.
- Il enregistre ses données dans la base `keycloak` de PostgreSQL, par une connexion chiffrée et vérifiée.
- Un Job créé au déploiement remplace le compte temporaire par un compte administrateur permanent, puis supprime le
  compte temporaire.
- Sans lui, personne ne peut se connecter ni déposer d'annonce.

## Fichiers et dossiers principaux

| Fichier ou dossier | Description |
|---|---|
| `k8s/03-keycloak.yaml` | Déploie Keycloak dans Minikube et fixe son adresse publique. |
| `k8s/03-keycloak-admin-job.yaml` | Crée le compte administrateur permanent et supprime le compte temporaire. |
| `k8s/config/realm-pme.json` | Décrit le realm : comptes de test, rôles et clients. |
| `.env` | Contient l'identifiant et le mot de passe de l'administrateur. |
| `Makefile` | Contient les commandes pour ouvrir Keycloak, lire son journal et obtenir un jeton. |

## Commandes essentielles

À lancer dans un terminal, depuis le dossier du projet, Minikube démarré.

| Commande | Description |
|---|---|
| `make deploy` | Installe Keycloak avec le reste de la plateforme. |
| `make keycloak` | Ouvre Keycloak dans le navigateur. |
| `make token KC_USER=membre` | Affiche un jeton de test pour le compte indiqué. |
| `make logs-keycloak` | Affiche le journal de Keycloak, mis à jour en direct. |
| `make pods` | Indique si Keycloak est prêt. |

!!! tip "Astuce"
    Pour se connecter à la console d'administration, utiliser `KEYCLOAK_ADMIN` et `KEYCLOAK_ADMIN_PASSWORD` du fichier
    `.env`. Le compte `bootstrap` n'existe plus une fois le Job terminé.

!!! note "À savoir"
    Keycloak met environ 40 secondes à démarrer : il prépare sa configuration à chaque démarrage. Attendre que
    `make pods` affiche `1/1` avant d'ouvrir la page.

!!! note "À savoir"
    Le realm est importé au démarrage seulement s'il n'existe pas encore. Pour appliquer une modification du fichier
    `realm-pme.json`, il faut recréer la base `keycloak`.

!!! warning "Attention"
    Keycloak tourne ici en mode développement. En production, il faudra le démarrer en mode `start`, avec un compte
    administrateur protégé par une double authentification.

## Pour aller plus loin

- [Site officiel de Keycloak](https://www.keycloak.org/)
- [Documentation officielle](https://www.keycloak.org/documentation)
