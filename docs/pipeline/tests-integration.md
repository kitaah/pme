# Tests d'intégration

## Fiche d'identité

| Information | Détail |
|---|---|
| **Rôle** | Vérifie que les briques fonctionnent ensemble, avec une vraie base PostgreSQL et un vrai broker NATS |
| **Job** | `integration-tests` |
| **Outils** | Jest et Testcontainers, sur un service Docker-in-Docker |
| **Déclencheur** | Chaque pipeline, sur la branche principale |
| **Nombre de tests** | 35 : 25 pour l'API et 10 pour le service de modération |

## Description

Les tests d'intégration vérifient que les briques fonctionnent ensemble, avec une vraie base PostgreSQL et un vrai broker NATS. Les tests unitaires utilisent des doublures. Ces tests-ci prouvent que les vrais composants s'entendent.

**Le problème qu'ils résolvent.**
Un test unitaire remplace la base et le broker par des doublures : il ne peut pas voir un désaccord entre le code et les vrais composants, comme une contrainte de la base ou le comportement réel du flux NATS.

**Comment ils fonctionnent.**
Testcontainers démarre un vrai PostgreSQL et un vrai NATS dans des conteneurs jetables, fournis par un Docker-in-Docker propre au job. Un faux Keycloak signe les jetons de test. Les conteneurs sont supprimés à la fin.

**Définitions**

| Terme | Définition |
|---|---|
| **Déduplication** | refus par NATS d'un message déjà reçu récemment. |
| **Docker-in-Docker** | service qui fournit un Docker au job de la pipeline, détruit à la fin du job. |
| **Faux Keycloak** | petit serveur local qui signe des jetons de test. L'API vérifie leur signature pour de vrai. |
| **Test d'intégration** | test qui fait travailler plusieurs composants réels ensemble. |
| **Testcontainers** | bibliothèque qui démarre des conteneurs Docker jetables pendant les tests, puis les supprime. |

## Ce qui est vérifié

La pipeline lance **35 tests d'intégration** dans un seul job : 25 pour l'API et 10 pour le service de modération.

| Élément réel | Version | Rôle dans les tests |
|---|---|---|
| **PostgreSQL** | 18 (image Alpine) | Stocke les annonces et la file de modération. |
| **NATS avec JetStream** | 2.14 (image Alpine) | Transmet les événements entre l'API et la modération. |
| **Faux Keycloak** | Serveur local | Signe les jetons, ce qui évite de démarrer le vrai Keycloak. |

### API (25 tests)

| Fichier | Tests | Ce qui est vérifié |
|---|---|---|
| **`api/test/integration/`**<br>**`listings.integration-spec.ts`** | 22 | Authentification, dépôt d'annonce, catégories, lieux de remise, validation, lecture des annonces, sondes de santé. |
| **`api/test/integration/`**<br>**`listings-broker.integration-spec.ts`** | 3 | Publication dans le vrai flux NATS, rejeu ignoré, erreur 503 si NATS tombe |

Dans le premier fichier, NATS est remplacé par une doublure pour tester l'API seule. Le second fichier utilise le vrai NATS.

Ces tests envoient le dépôt en JSON, sans photo : le stockage des photos n'est pas démarré. L'envoi multipart, le ré-encodage et
l'enregistrement dans [Garage](../outils/garage.md) sont couverts par les [tests unitaires](tests-unitaires.md).

Détail des 22 tests du premier fichier :

- Une requête sans jeton est refusée (401).
- Un jeton d'un autre émetteur est refusé (401).
- Un jeton d'un autre client est refusé (401).
- Un jeton expiré est refusé (401).
- Un utilisateur sans le rôle membre est refusé (403).
- Un dépôt valide est enregistré en attente de validation, et l'événement est publié (201).
- Une annonce est rangée dans la catégorie choisie (clé étrangère vérifiée en base) ; sans catégorie elle prend « Autres », et un code inconnu est refusé (400) sans rien enregistrer.
- Une annonce est rangée dans le lieu de remise choisi, renvoyé avec son libellé ; un lieu inconnu est refusé (400), et sans lieu l'annonce prend « à convenir ».
- `GET /api/v1/categories` renvoie les huit catégories de départ dans l'ordre d'affichage, et `GET /api/v1/handover-places` les cinq lieux ; chacune est refusée sans jeton (401).
- Cinq annonces invalides sont refusées (400) : titre vide, titre trop court, description trop longue, état inconnu, champ inattendu.
- Si NATS est injoignable, l'annonce est retirée et l'API répond 503.
- Un membre ne voit que ses propres annonces.
- Les sondes de santé répondent sans jeton.

### Service de modération (10 tests)

| Fichier | Tests | Ce qui est vérifié |
|---|---|---|
| **`moderation-service/test/integration/`**<br>**`moderation.integration-spec.ts`** | 6 | Consommation de l'événement, rejeu sans doublon, message mal formé, accès à la file selon le rôle. |
| **`moderation-service/test/integration/`**<br>**`moderation-broker.integration-spec.ts`** | 4 | Messages conservés pendant un arrêt, flux des messages en échec, consommateur durable. |

Ce que ces tests prouvent d'important :

- Un message déposé pendant l'arrêt du service de modération est traité au redémarrage. Aucune annonce n'est perdue.
- Un message déjà traité est acquitté sans créer de doublon.
- Un message mal formé part dans un flux à part et n'est pas enregistré.
- La file de modération refuse un membre (403) et une requête sans jeton (401). Elle répond (200) à un modérateur.

## Quand il se lance

- Sur la branche principale, à chaque pipeline.

## Où voir le résultat

- **Onglet « Tests » de la pipeline** : les rapports JUnit des deux modules y sont réunis.
- **Log du job** : il montre chaque module à la suite. Les deux sont testés même si le premier échoue.
- **Artefacts du job** : les fichiers `junit-integration.xml` sont conservés une semaine.

## Fichiers et dossiers principaux

| Fichier ou dossier | Description |
|---|---|
| **`api/test/integration/`** | Contient les tests d'intégration de l'API. |
| **`moderation-service/test/integration/`** | Contient les tests d'intégration de la modération. |
| **`api/test/support/infrastructure.ts`** | Démarre PostgreSQL et NATS dans des conteneurs jetables. |
| **`api/test/support/jwt-helper.ts`** | Fournit le faux Keycloak et ses jetons de test. |
| **`moderation-service/test/support/`** | Les mêmes fichiers d'appui pour la modération. |
| **`api/test/support/jest-setup.ts`** | Fixe un délai large pour le téléchargement des images. |
| **`api/jest.config.js`** | Déclare le projet « integration » de Jest (même fichier pour la modération). |
| **`.gitlab-ci.yml`** | Définit le job `integration-tests` et son service Docker. |

## Commandes essentielles

À lancer dans un terminal, depuis le dossier du projet, Docker démarré.

| Commande | Description |
|---|---|
| **`make test-integration`** | Lance les tests d'intégration de l'API et de la modération. |
| **`cd api && npm run test:integration`** | Lance seulement ceux de l'API. |

!!! note "À savoir"
    Dans la pipeline, un seul job exécute les deux modules. Le démarrage de Docker-in-Docker, environ 40 secondes, n'est
    ainsi payé qu'une fois.

!!! note "À savoir"
    Les images de PostgreSQL et de NATS sont téléchargées par le miroir de Google. C'est plus rapide et sans limite de
    débit.

!!! warning "Attention"
    NATS retient les messages déjà reçus pendant 2 minutes. Chaque test utilise donc un identifiant d'annonce unique,
    sans quoi un rejeu serait ignoré par erreur.

!!! tip "Astuce"
    Pour un seul module, `cd api && npm run test:integration` évite de démarrer les conteneurs de la modération. Docker
    doit être démarré dans tous les cas.

## Pour aller plus loin

- [Documentation de Testcontainers](https://node.testcontainers.org/)
- [Documentation de Supertest](https://github.com/ladjs/supertest)
- [Docker-in-Docker avec GitLab CI](https://docs.gitlab.com/ci/docker/using_docker_build/)
