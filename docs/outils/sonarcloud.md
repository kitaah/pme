# SonarCloud

## Fiche d'identité

| Information | Détail |
|---|---|
| **Rôle** | Mesure la qualité du code : bugs, failles, doublons et couverture des tests |
| **Version** | Service en ligne, avec l'analyseur SonarScanner CLI 11 dans la pipeline |
| **Adresse en local** | aucune : <https://sonarcloud.io/project/overview?id=kitaah_pme> |

## Description

SonarCloud est un service en ligne d'analyse de code, édité par SonarSource. Un analyseur lit le code source, applique
des centaines de règles et envoie le résultat au service. SonarCloud affiche alors des mesures, la liste des défauts
repérés et un verdict, la porte qualité. Il lit aussi les rapports de couverture produits par les tests. Le projet est
analysé en TypeScript, pour l'API, la modération et l'interface.

**Définitions**

- **Porte qualité (Quality Gate)** : conditions que le code doit respecter. Le verdict est « réussi » ou « échoué ».
- **Nouveau code** : code ajouté ou modifié depuis une date de référence.
- **Anomalie (issue)** : défaut repéré dans le code : bug, faille ou mauvaise pratique.
- **Point sensible de sécurité** : portion de code à relire à la main pour juger du risque.
- **Couverture** : part du code exécutée par les tests.
- **Duplication** : portion de code copiée à plusieurs endroits.

## Rôle dans le projet

- Il note la fiabilité, la sécurité et la maintenabilité du code, avec un historique.
- Il détecte aussi les secrets oubliés dans les fichiers.
- Il rassemble la couverture des trois modules dans une seule mesure.
- Il rend un verdict clair sur chaque analyse, que l'équipe lit dans le tableau de bord.
- Sans lui, l'état global de la qualité du code ne serait pas mesuré.

## Fichiers et dossiers principaux

| Fichier ou dossier | Description |
|---|---|
| `sonar-project.properties` | Configure l'organisation, les sources, les tests, les exclusions et les rapports de couverture. |
| `.gitlab-ci.yml` | Définit le job `sonar` qui lance l'analyse. |
| `api/coverage/lcov.info` | Rapport de couverture de l'API, lu par l'analyseur. |
| `moderation-service/coverage/lcov.info` | Rapport de couverture de la modération. |
| `frontend/coverage/lcov.info` | Rapport de couverture de l'interface. |

## Commandes essentielles

À lancer dans un terminal, depuis le dossier du projet. La pipeline fait déjà ce travail à chaque changement du code.

| Commande | Description |
|---|---|
| `make coverage` | Produit les rapports de couverture des trois modules. |
| `make sonar` | Envoie l'analyse à SonarCloud depuis le poste. |

!!! warning "Attention"
    L'offre gratuite de SonarCloud ne donne accès qu'à la branche principale. L'analyse ne se lance donc que sur cette
    branche.

!!! tip "Astuce"
    Le jeton se définit dans les réglages CI/CD de GitLab, avec les variables `SONAR_TOKEN` et `SONAR_HOST_URL`. Le
    jeton est masqué. Ne jamais l'écrire dans un fichier du dépôt.

!!! note "À savoir"
    Le projet utilise la porte qualité par défaut, « Sonar way ». Elle impose 80 % de couverture et 3 % de doublons au
    plus sur le nouveau code. Voir la page [Analyse SonarCloud](../pipeline/analyse-sonarcloud.md).

## Pour aller plus loin

- [Site de SonarQube Cloud](https://www.sonarsource.com/products/sonarcloud/)
- [Documentation officielle](https://docs.sonarsource.com/sonarqube-cloud/)
- [Analyse depuis GitLab CI/CD](https://docs.sonarsource.com/sonarqube-cloud/advanced-setup/ci-based-analysis/gitlab-ci/)
