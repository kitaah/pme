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

La pipeline lance **66 tests unitaires** répartis en 3 jobs, un par module. Les trois jobs tournent en parallèle.

| Module | Outil | Tests |
|---|---|---|
| **API** | Jest 30 et ts-jest | 14 |
| **Service de modération** | Jest 30 et ts-jest | 17 |
| **Interface** | Vitest 5, Testing Library et jsdom | 35 |

### API (14 tests)

| Fichier | Tests | Ce qui est vérifié |
|---|---|---|
| `api/src/auth/roles.guard.spec.ts` | 3 | Le contrôle des rôles laisse passer le bon rôle et refuse les autres (403). |
| `api/src/listings/listings.service.spec.ts` | 3 | Dépôt d'une annonce, retrait avec erreur 503 si la publication échoue, lecture des annonces du membre. |
| `api/src/listings/listing-events.publisher.spec.ts` | 3 | Contrat de l'événement publié, deux nouvelles tentatives si le broker est injoignable. |
| `api/src/metrics/metrics.spec.ts` | 5 | Mesures au format Prometheus, routes de santé et de mesures ignorées. |

### Service de modération (17 tests)

| Fichier | Tests | Ce qui est vérifié |
|---|---|---|
| `moderation-service/src/auth/roles.guard.spec.ts` | 3 | Le contrôle des rôles laisse passer le bon rôle et refuse les autres (403). |
| `moderation-service/src/moderation/listing-submitted.consumer.spec.ts` | 6 | Message acquitté, doublon, message mal formé, panne passagère, échec de la copie ou du rejet. |
| `moderation-service/src/moderation/moderation.service.spec.ts` | 3 | Ajout à la file, rejeu sans doublon, erreurs de base transmises. |
| `moderation-service/src/metrics/metrics.spec.ts` | 5 | Mesures au format Prometheus, routes de santé et de mesures ignorées. |

### Interface (35 tests)

| Fichier | Tests | Ce qui est vérifié |
|---|---|---|
| `frontend/src/theme.test.ts` | 26 | Contrastes de la palette selon le RGAA : texte à 4,5:1, composants à 3:1, texte courant à 7:1. |
| `frontend/src/components/Header.test.tsx` | 2 | Nom et rôle affichés, déconnexion au clic. |
| `frontend/src/components/ListingForm.test.tsx` | 2 | Erreurs de l'API affichées, dépôt confirmé et formulaire vidé. |
| `frontend/src/components/MyListings.test.tsx` | 2 | Libellé de chaque statut, erreur affichée si l'API ne répond pas. |
| `frontend/src/components/ui/button.test.tsx` | 3 | Variantes du bouton et rendu en lien. |

### Seuils de couverture

| Module | Seuil de lignes | Seuil de branches | Couverture mesurée |
|---|---|---|---|
| **API** | 40 % | 20 % | 50,2 % des lignes, 23,4 % des branches |
| **Service de modération** | 40 % | 20 % | 47,7 % des lignes, 29,1 % des branches |
| **Interface** | 50 % | 35 % | 56,3 % des lignes, 44,7 % des branches |

!!! note "À savoir"
    Ces seuils sont un garde-fou : ils empêchent la couverture de baisser. Ils seront relevés quand de nouveaux tests
    seront ajoutés. La couverture mesurée est celle de la version actuelle du dépôt.

## Quand il se lance

- Sur la branche principale, quand le code d'un des trois modules change.
- Aussi quand `.gitlab-ci.yml` ou `sonar-project.properties` change.
- Les trois modules sont toujours testés ensemble : SonarCloud a besoin des trois couvertures.

## Où voir le résultat

- **Onglet « Tests » de la pipeline** : chaque test, son statut et sa durée. Les rapports JUnit l'alimentent.
- **Journal du job** : la ligne « Lines » donne la couverture, reprise dans la liste des jobs.
- **Demande de fusion** : les lignes couvertes sont colorées dans la vue des changements.
- **Artefacts du job** : le fichier `lcov.info`, lu ensuite par SonarCloud. Il est conservé une semaine.

## Fichiers et dossiers principaux

| Fichier ou dossier | Description |
|---|---|
| `api/jest.config.js` | Règle les tests de l'API : projet « unit », rapports et seuils. |
| `moderation-service/jest.config.js` | Règle les tests de la modération, sur le même modèle. |
| `frontend/vite.config.ts` | Règle Vitest : environnement, rapports et seuils. |
| `api/src/` | Contient le code de l'API et ses tests `.spec.ts`. |
| `moderation-service/src/` | Contient le code de la modération et ses tests `.spec.ts`. |
| `frontend/src/` | Contient l'interface et ses tests `.test.ts` et `.test.tsx`. |
| `.gitlab-ci.yml` | Définit les trois jobs `unit-tests`. |

## Commandes essentielles

À lancer dans un terminal, depuis le dossier du projet.

| Commande | Description |
|---|---|
| `make test` | Lance les tests unitaires des trois modules. |
| `make coverage` | Lance les tests avec la couverture et les seuils. |
| `cd api && npm test` | Lance seulement les tests unitaires de l'API. |
| `cd frontend && npm run test:watch` | Relance les tests de l'interface à chaque enregistrement. |

!!! tip "Astuce"
    Les tests unitaires n'ont pas besoin de Docker. Ils se lancent donc sur n'importe quel poste, en quelques secondes.

## Pour aller plus loin

- [Documentation de Jest](https://jestjs.io/fr/)
- [Documentation de Vitest](https://vitest.dev/)
- [Documentation de Testing Library](https://testing-library.com/docs/react-testing-library/intro/)
- [Rapports de tests dans GitLab](https://docs.gitlab.com/ci/testing/unit_test_reports/)
