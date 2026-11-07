# GitLab CI

## Fiche d'identité

| Information | Détail |
|---|---|
| **Rôle** | Lance automatiquement les contrôles de qualité à chaque modification de la branche principale |
| **Version** | Service GitLab.com, offre gratuite (400 minutes de calcul par mois) |
| **Adresse en local** | aucune : <https://gitlab.com/kitaah/pme> |

## Description

GitLab CI/CD est la fonction d'intégration continue de GitLab. Elle lit le fichier `.gitlab-ci.yml` du dépôt. Ce fichier
décrit les jobs à lancer et leurs conditions. GitLab exécute chaque job dans un conteneur neuf, sur une machine partagée
appelée runner. Les runners de l'offre gratuite sont de petites machines Linux à deux processeurs.

**Définitions**

- **Intégration continue (CI)** : pratique qui consiste à tester le code automatiquement à chaque modification.
- **Pipeline** : ensemble des jobs lancés pour un commit.
- **Job** : tâche de la pipeline, par exemple « lancer les tests de l'API ».
- **Runner** : machine qui exécute les jobs.
- **Service** : conteneur auxiliaire démarré pendant un job, comme PostgreSQL ou NATS.
- **Artefact** : fichier produit par un job et conservé, comme un rapport de tests.
- **Cache** : dossier conservé d'un job à l'autre pour gagner du temps.

## Rôle dans le projet

- Il exécute les 8 jobs de la pipeline : tests unitaires, analyse Sonar, analyse des dépendances, tests d'intégration, d'images et de performance.
- Il ne se lance que sur la branche principale, et seulement pour les jobs dont les fichiers ont changé.
- Il publie les images vérifiées dans le registre de conteneurs du projet.
- Il publie les rapports de tests et de couverture dans l'interface de GitLab.
- Il garde les résultats de chaque pipeline, ce qui prouve le contrôle de chaque modification.
- Sans lui, les contrôles dépendraient de la mémoire de chaque développeur.

## Fichiers et dossiers principaux

| Fichier ou dossier | Description |
|---|---|
| `.gitlab-ci.yml` | Décrit les étapes, les jobs, leurs conditions et leurs rapports. |
| `sonar-project.properties` | Configure l'analyse SonarCloud lancée par un job. |
| `docker-bake.hcl` | Décrit la construction des trois images par le job d'images. |
| `.trivyignore` | Liste les failles acceptées temporairement. |
| `scripts/perf-ci.sh` | Orchestre le test de performance du job k6. |
| `tests/` | Contient les contrôles d'images et les scénarios de performance. |

## Commandes essentielles

Les jobs ont des équivalents sur le poste de travail, à lancer depuis le dossier du projet.

| Commande | Description |
|---|---|
| `make test` | Lance les tests unitaires, comme les jobs `unit-tests`. |
| `make coverage` | Lance les tests avec la couverture et les seuils. |
| `make test-integration` | Lance les tests d'intégration, Docker démarré. |
| `make image-test` | Contrôle les images, comme le job `image-tests`. |
| `make perf` | Lance les tests de performance sur le cluster. |
| `make quality` | Lance les contrôles statiques prévus pour la pipeline. |

!!! tip "Astuce"
    Dans GitLab, le menu **Build**, puis **Pipelines**, liste les pipelines. Le menu **Build**, puis **Jobs**, donne le
    journal de chaque job.

!!! note "À savoir"
    L'offre gratuite donne 400 minutes par mois. Le projet les économise avec des règles de déclenchement et des jobs
    sobres. Voir la page [Fonctionnement](../pipeline/fonctionnement.md).

!!! note "À savoir"
    Les variables sensibles, comme le jeton de SonarCloud, sont définies dans les réglages CI/CD du projet. Elles ne
    sont jamais écrites dans le dépôt.

## Pour aller plus loin

- [Vue d'ensemble de la pipeline du projet](../pipeline/index.md)
- [Documentation de GitLab CI/CD](https://docs.gitlab.com/ci/)
- [Référence du fichier .gitlab-ci.yml](https://docs.gitlab.com/ci/yaml/)
