# Tests unitaires

## Objectif

Vérifier que chaque brique du code fonctionne seule, sans base de données ni broker. Ces tests sont les plus rapides de la
pipeline. Ils donnent le premier signal d'une régression, et leur couverture alimente l'analyse SonarCloud.

**Définitions**

- **Test unitaire** : test qui contrôle une petite partie du code, isolée du reste.
- **Doublure** : faux composant qui remplace un vrai service, comme la base de données ou le broker.
- **Couverture** : part des lignes du code exécutées par les tests.
- **Seuil de couverture** : couverture minimale. En dessous, le job échoue.

## Ce qui est vérifié

La pipeline lance **201 tests unitaires** répartis en 4 jobs, un par module. Les quatre jobs tournent en parallèle.

| Module | Outil | Tests |
|---|---|---|
| **Module commun** (`libs/common`) | Jest 30 et ts-jest | 60 |
| **API** | Jest 30 et ts-jest | 42 |
| **Service de modération** | Jest 30 et ts-jest | 37 |
| **Interface** | Vitest 5, Testing Library et jsdom | 62 |

Le module commun regroupe le code partagé par l'API et le service de modération : authentification Keycloak, erreurs
RFC 9457, mesures Prometheus, client NATS et lecture de la configuration. Il est testé une seule fois, ici, et non dans
chaque service.

### Module commun (60 tests)

| Fichier (dans `libs/common/src/`) | Tests | Ce qui est vérifié |
|---|---|---|
| **`auth/jwt.strategy.spec.ts`** | 5 | Utilisateur construit depuis le jeton, refus d'un jeton sans sujet, sans client émetteur ou émis pour un autre client. |
| **`auth/jwt-auth.guard.spec.ts`** | 2 | Une route publique passe sans jeton, toutes les autres exigent la vérification du jeton. |
| **`auth/roles.guard.spec.ts`** | 3 | Le contrôle des rôles laisse passer le bon rôle et refuse les autres (403). |
| **`auth/decorators.spec.ts`** | 3 | Les décorateurs `@Public()`, `@Roles()` et `@CurrentUser()`. |
| **`auth/authenticated-user.spec.ts`** | 1 | Les noms des rôles du realm Keycloak. |
| **`common/problem-details.filter.spec.ts`** | 7 | Erreurs au format RFC 9457, liste des erreurs de validation, détails masqués pour une erreur inattendue. |
| **`metrics/metrics.spec.ts`** | 4 | Mesures au format Prometheus, routes de santé et de mesures ignorées. |
| **`nats/nats.client.spec.ts`** | 11 | Connexion ouverte une seule fois, TLS, nouvelle tentative après un échec, arrêt propre ou fermeture forcée si le broker est injoignable. |
| **`config/env.spec.ts`** | 23 | Lecture des variables d'environnement (base, NATS, Keycloak) et refus de démarrer si l'une manque. |
| **`index.spec.ts`** | 1 | L'interface publique de `@pme/common` expose tout ce dont les services ont besoin. |

### API (42 tests)

| Fichier (dans `api/src/`) | Tests | Ce qui est vérifié |
|---|---|---|
| **`listings/listings.service.spec.ts`** | 4 | Dépôt d'une annonce, retrait avec erreur 503 si la publication échoue, lecture des annonces du membre. |
| **`listings/listings.controller.spec.ts`** | 10 | Dépôt au nom du membre connecté, paramètre `limit` accepté ou refusé (400). |
| **`listings/create-listing.dto.spec.ts`** | 7 | Règles de validation du dépôt : longueurs, états autorisés, espaces retirés. |
| **`listings/listing-events.publisher.spec.ts`** | 3 | Contrat de l'événement publié, deux nouvelles tentatives si le broker est injoignable. |
| **`common/database-circuit-breaker.spec.ts`** | 10 | Disjoncteur de la base : ouverture, demi-ouverture, fermeture, erreur 503, mesure publiée. |
| **`health/health.controller.spec.ts`** | 3 | Sondes de vivacité et de disponibilité, erreur 503 si la base est injoignable. |
| **`metrics/metrics.controller.spec.ts`** | 1 | Publication des mesures au format Prometheus. |
| **`config/configuration.spec.ts`** | 4 | Valeurs par défaut, lecture de l'environnement, refus de démarrer sans les variables obligatoires. |

### Service de modération (37 tests)

| Fichier (dans `moderation-service/src/`) | Tests | Ce qui est vérifié |
|---|---|---|
| **`moderation/listing-submitted.consumer.spec.ts`** | 6 | Message acquitté, doublon, message mal formé, panne passagère, échec de la copie ou du rejet. |
| **`moderation/listing-submitted.consumer.lifecycle.spec.ts`** | 7 | Démarrage et arrêt du consommateur durable, message illisible envoyé en flux d'échec. |
| **`moderation/listing-submitted.consumer.validation.spec.ts`** | 1 | Rejet d'un message dont la validation imbriquée échoue. |
| **`moderation/moderation.service.spec.ts`** | 3 | Ajout à la file, rejeu sans doublon, erreurs de base transmises. |
| **`moderation/moderation.service.pending.spec.ts`** | 2 | Lecture de la file, de la plus ancienne à la plus récente, avec une limite. |
| **`moderation/moderation.controller.spec.ts`** | 2 | File réservée aux modérateurs authentifiés et limitée en débit. |
| **`moderation/moderation-item.entity.spec.ts`** | 2 | Les trois statuts de modération. |
| **`moderation/nats-topology.spec.ts`** | 6 | Création des flux et du consommateur durable, TLS, nouvelles tentatives au démarrage. |
| **`health/health.controller.spec.ts`** | 3 | Sondes de vivacité et de disponibilité. |
| **`metrics/metrics.controller.spec.ts`** | 1 | Publication des mesures au format Prometheus. |
| **`config/configuration.spec.ts`** | 4 | Valeurs par défaut, lecture de l'environnement, refus de démarrer sans les variables obligatoires. |

### Interface (62 tests)

| Fichier (dans `frontend/src/`) | Tests | Ce qui est vérifié |
|---|---|---|
| **`theme.test.ts`** | 26 | Contrastes de la palette selon le RGAA : texte à 4,5:1, composants à 3:1, texte courant à 7:1. |
| **`auth.test.ts`** | 9 | Utilisateur déduit du jeton, renouvellement du jeton, déconnexion. |
| **`api.test.ts`** | 6 | Appels à l'API avec le jeton, erreurs RFC 9457 transformées en erreur d'interface, libellés des statuts. |
| **`App.test.tsx`** | 5 | Attente de la connexion, alerte si Keycloak est injoignable, rafraîchissement après un dépôt. |
| **`config.test.ts`** | 2 | Configuration de développement ou injectée au chargement de la page. |
| **`components/Header.test.tsx`** | 2 | Nom et rôle affichés, déconnexion au clic. |
| **`components/ListingForm.test.tsx`** | 5 | Erreurs de l'API affichées, dépôt confirmé et formulaire vidé, état choisi envoyé, message générique si le réseau est coupé. |
| **`components/MyListings.test.tsx`** | 4 | Libellé de chaque statut, liste vide, erreur si l'API ne répond pas, rechargement à la demande. |
| **`components/ui/button.test.tsx`** | 3 | Variantes du bouton et rendu en lien. |

### Seuils de couverture

| Module | Seuil de lignes, de branches, de fonctions et d'instructions | Couverture mesurée |
|---|---|---|
| **Module commun** | 100 % | 100 % |
| **API** | 100 % | 100 % |
| **Service de modération** | 100 % | 100 % |
| **Interface** | 100 % | 100 % |

!!! note "À savoir"
    Les seuils sont fixés à 100 % : le job échoue dès qu'une ligne ou une branche n'est plus exécutée par un test.
    Les fichiers sans logique sont exclus de la mesure : démarrage de l'application (`main.ts`, `main.tsx`), modules
    NestJS d'assemblage et migrations de la base. La couverture mesurée est celle de la version actuelle du dépôt.

## Quand il se lance

- Sur la branche principale, à chaque pipeline.
- Les quatre modules sont toujours testés ensemble : SonarCloud a besoin des quatre couvertures.

## Où voir le résultat

- **Onglet « Tests » de la pipeline** : chaque test, son statut et sa durée. Les rapports JUnit l'alimentent.
- **Journal du job** : la ligne « Lines » donne la couverture, reprise dans la liste des jobs.
- **Demande de fusion** : les lignes couvertes sont colorées dans la vue des changements.
- **Artefacts du job** : le fichier `lcov.info`, lu ensuite par SonarCloud. Il est conservé une semaine.

## Fichiers et dossiers principaux

| Fichier ou dossier | Description |
|---|---|
| **`libs/common/jest.config.js`** | Règle les tests du module commun : fichiers mesurés, rapports et seuils. |
| **`api/jest.config.js`** | Règle les tests de l'API : projet « unit », rapports et seuils. |
| **`moderation-service/jest.config.js`** | Règle les tests de la modération, sur le même modèle. |
| **`frontend/vite.config.ts`** | Règle Vitest : environnement, rapports et seuils. |
| **`scripts/jest.cjs`** | Lance Jest avec l'option que NestJS exige, depuis n'importe quel module. |
| **`libs/common/src/`** | Contient le code partagé et ses tests `.spec.ts`. |
| **`api/src/`** | Contient le code de l'API et ses tests `.spec.ts`. |
| **`moderation-service/src/`** | Contient le code de la modération et ses tests `.spec.ts`. |
| **`frontend/src/`** | Contient l'interface et ses tests `.test.ts` et `.test.tsx`. |
| **`.gitlab-ci.yml`** | Définit les quatre jobs `unit-tests`. |

## Commandes essentielles

À lancer dans un terminal, depuis le dossier du projet.

| Commande | Description |
|---|---|
| **`make test`** | Lance les tests unitaires des quatre modules. |
| **`make coverage`** | Lance les tests avec la couverture et les seuils. |
| **`cd api && npm test`** | Lance seulement les tests unitaires de l'API. Le module commun est compilé d'abord, automatiquement. |
| **`cd libs/common && npm test`** | Lance seulement les tests du module commun. |
| **`cd frontend && npm run test:watch`** | Relance les tests de l'interface à chaque enregistrement. |

!!! tip "Astuce"
    Les tests unitaires n'ont pas besoin de Docker. Ils se lancent donc sur n'importe quel poste, en quelques secondes.

## Pour aller plus loin

- [Documentation de Jest](https://jestjs.io/fr/)
- [Documentation de Vitest](https://vitest.dev/)
- [Documentation de Testing Library](https://testing-library.com/docs/react-testing-library/intro/)
- [Rapports de tests dans GitLab](https://docs.gitlab.com/ci/testing/unit_test_reports/)
