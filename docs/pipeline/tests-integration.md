# Tests d'intégration

## Objectif

Vérifier que les briques fonctionnent ensemble, avec une vraie base PostgreSQL et un vrai broker NATS. Les tests
unitaires utilisent des doublures. Ces tests-ci prouvent que les vrais composants s'entendent.

**Définitions**

- **Test d'intégration** : test qui fait travailler plusieurs composants réels ensemble.
- **Testcontainers** : bibliothèque qui démarre des conteneurs Docker jetables pendant les tests, puis les supprime.
- **Docker-in-Docker** : service qui fournit un Docker au job de la pipeline, détruit à la fin du job.
- **Faux Keycloak** : petit serveur local qui signe des jetons de test. L'API vérifie leur signature pour de vrai.
- **Déduplication** : refus par NATS d'un message déjà reçu récemment.

## Ce qui est vérifié

La pipeline lance **27 tests d'intégration** dans un seul job : 17 pour l'API et 10 pour le service de modération.

| Élément réel | Version | Rôle dans les tests |
|---|---|---|
| **PostgreSQL** | 18 (image Alpine) | Stocke les annonces et la file de modération. |
| **NATS avec JetStream** | 2.14 (image Alpine) | Transmet les événements entre l'API et la modération. |
| **Faux Keycloak** | Serveur local | Signe les jetons, ce qui évite de démarrer le vrai Keycloak. |

### API (17 tests)

| Fichier | Tests | Ce qui est vérifié |
|---|---|---|
| **`api/test/integration/`**<br>**`listings.integration-spec.ts`** | 14 | Authentification, dépôt d'annonce, validation, lecture des annonces, sondes de santé. |
| **`api/test/integration/`**<br>**`listings-broker.integration-spec.ts`** | 3 | Publication dans le vrai flux NATS, rejeu ignoré, erreur 503 si NATS tombe. |

Dans le premier fichier, NATS est remplacé par une doublure pour tester l'API seule. Le second fichier utilise le vrai NATS.

Détail des 14 tests du premier fichier :

- Une requête sans jeton est refusée (401).
- Un jeton d'un autre émetteur est refusé (401).
- Un jeton d'un autre client est refusé (401).
- Un jeton expiré est refusé (401).
- Un utilisateur sans le rôle membre est refusé (403).
- Un dépôt valide est enregistré en attente de modération, et l'événement est publié (201).
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

- Sur la branche principale, quand `.gitlab-ci.yml`, l'API ou la modération change.
- Un changement de l'interface seule ne le lance pas.

## Où voir le résultat

- **Onglet « Tests » de la pipeline** : les rapports JUnit des deux modules y sont réunis.
- **Journal du job** : il montre chaque module à la suite. Les deux sont testés même si le premier échoue.
- **Artefacts du job** : les fichiers `junit-integration.xml` sont conservés une semaine.

## Fichiers et dossiers principaux

| Fichier ou dossier | Description |
|---|---|
| **`api/test/integration/`** | Contient les tests d'intégration de l'API. |
| **`moderation-service/test/integration/`** | Contient les tests d'intégration de la modération. |
| **`api/test/support/infrastructure.ts`** | Démarre PostgreSQL et NATS dans des conteneurs jetables. |
| **`api/test/support/jwt-helper.ts`** | Fournit le faux Keycloak et ses jetons de test. |
| **`api/test/support/jest-setup.ts`** | Fixe un délai large pour le téléchargement des images. |
| **`api/jest.config.js`** | Déclare le projet « integration » de Jest. |
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

## Pour aller plus loin

- [Documentation de Testcontainers](https://node.testcontainers.org/)
- [Documentation de Supertest](https://github.com/ladjs/supertest)
- [Docker-in-Docker avec GitLab CI](https://docs.gitlab.com/ci/docker/using_docker_build/)
