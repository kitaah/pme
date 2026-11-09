# Analyse SonarCloud

## Objectif

Mesurer la qualité générale du code : bugs, failles de sécurité, secrets oubliés, code dupliqué et couverture des tests.
SonarCloud compare ces mesures à une porte qualité et rend un verdict. C'est le tableau de bord de la maintenabilité du
projet.

**Définitions**

- **SonarCloud** : service en ligne d'analyse de code, édité par SonarSource.
- **Porte qualité (Quality Gate)** : ensemble de conditions que le code doit respecter. Le verdict est « réussi » ou « échoué ».
- **Nouveau code** : code ajouté ou modifié depuis une date de référence. Les conditions s'appliquent surtout à lui.
- **Anomalie (issue)** : défaut repéré dans le code : bug, faille ou mauvaise pratique.
- **Duplication** : portion de code copiée à plusieurs endroits.

## Ce qui est vérifié

L'analyse lit le code des trois modules et les rapports de couverture des tests unitaires.

| Ce qui est mesuré | Détail |
|---|---|
| **Fiabilité** | Bugs probables dans le code TypeScript. |
| **Sécurité** | Failles du code et secrets oubliés dans les 75 fichiers analysés. |
| **Maintenabilité** | Mauvaises pratiques, complexité, code dupliqué. |
| **Couverture** | Part du code exécutée par les tests unitaires, pour les trois modules. |

**Périmètre**

- Les sources analysées sont `api/src`, `moderation-service/src` et `frontend/src`.
- Les fichiers de tests sont reconnus comme tels et ne sont pas comptés dans le code.
- Les fichiers de démarrage, de configuration, les modules NestJS et les objets de transfert sont exclus de la couverture.
- Les migrations et la configuration sont exclues des doublons : les deux services sont symétriques.

**Porte qualité**

Le projet utilise la porte par défaut de SonarCloud, « Sonar way ». Elle impose notamment, sur le nouveau code :

| Condition | Seuil |
|---|---|
| **Couverture** | Au moins 80 %. |
| **Lignes dupliquées** | Au plus 3 %. |

## Résultat de la dernière analyse

Mesures relevées le 7 novembre 2026, sur la branche principale (1,8 millier de lignes de code).

| Mesure | Résultat | Seuil |
|---|---|---|
| **Porte qualité** | Échouée, 2 conditions sur le nouveau code. | Réussie |
| **Couverture du nouveau code** | 58,97 % sur 167 lignes. | 80 % au moins |
| **Duplications du nouveau code** | 11,32 % sur 1,1 millier de lignes. | 3 % au plus |
| **Couverture de l'ensemble du code** | 49,3 % | Aucun seuil |
| **Anomalies** | 6 au total, dont 2 sur le nouveau code. | Aucun seuil |
| **Points sensibles de sécurité** | 0 sur le nouveau code. | Aucun seuil |

!!! note "À savoir"
    L'échec de la porte qualité est connu et assumé. Il montre ce qui reste à améliorer : plus de tests, moins de
    code dupliqué. Le job est toléré en échec le temps de relever ces mesures. Ensuite, il deviendra bloquant.

## Quand il se lance

- Sur la branche principale uniquement, quand le code d'un module, `.gitlab-ci.yml` ou `sonar-project.properties` change.
- Après les trois jobs de tests unitaires, dont il lit les rapports de couverture.

!!! warning "Attention"
    L'offre gratuite de SonarCloud ne donne accès qu'à la branche principale. Sur une autre branche, le verdict est refusé
    avec le message « Organization is not allowed to access data from non main branches ». L'analyse ne se lance donc
    que sur la branche principale.

## Où voir le résultat

- **Journal du job** : le verdict de la porte qualité et le lien vers le détail.
- **Tableau de bord SonarCloud** : l'onglet « Summary » donne les conditions, l'onglet « Issues » les anomalies, et la mention « Last analysis » l'heure de la dernière analyse.
- **Statut de la pipeline** : le job `sonar` passe en échec si la porte est échouée. La pipeline reste en avertissement, car ce job est toléré.

## Fichiers et dossiers principaux

| Fichier ou dossier | Description |
|---|---|
| **`sonar-project.properties`** | Configure l'analyse : sources, tests, exclusions et rapports de couverture. |
| **`.gitlab-ci.yml`** | Définit le job `sonar`. |
| **`api/coverage/lcov.info`** | Rapport de couverture de l'API, produit par les tests unitaires. |
| **`moderation-service/coverage/lcov.info`** | Rapport de couverture de la modération. |
| **`frontend/coverage/lcov.info`** | Rapport de couverture de l'interface. |

## Commandes essentielles

À lancer dans un terminal, depuis le dossier du projet. La pipeline fait déjà ce travail à chaque changement du code.

| Commande | Description |
|---|---|
| **`make coverage`** | Produit les rapports de couverture des trois modules. |
| **`make sonar`** | Lance l'analyse depuis le poste, avec `sonar-scanner`. |

!!! tip "Astuce"
    Les variables `SONAR_TOKEN` et `SONAR_HOST_URL` sont définies dans les réglages CI/CD de GitLab. La première est
    masquée. Elles ne sont jamais écrites dans le dépôt.

!!! note "À savoir"
    Les rapports de couverture nomment les fichiers depuis leur module. La pipeline ajoute le nom du module devant chaque
    chemin, pour que SonarCloud retrouve les fichiers à la racine du dépôt.

## Pour aller plus loin

- [Fiche SonarCloud du projet](../outils/sonarcloud.md)
- [Documentation de SonarQube Cloud](https://docs.sonarsource.com/sonarqube-cloud/)
- [Porte qualité de SonarQube Cloud](https://docs.sonarsource.com/sonarqube-cloud/improving/quality-gates/)
