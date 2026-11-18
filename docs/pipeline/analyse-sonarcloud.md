# Analyse SonarCloud

## Fiche d'identité

| Information | Détail |
|---|---|
| **Rôle** | Mesure la qualité générale du code (bugs, failles, secrets oubliés, duplication, couverture des tests) et rend un verdict |
| **Job** | `sonar` |
| **Outil** | SonarCloud, avec SonarScanner CLI 11 |
| **Déclencheur** | Chaque pipeline, sur la branche principale, après les quatre jobs de tests unitaires |
| **Verdict** | Quality Gate « Sonar way » : si elle est échouée, la pipeline échoue |

## Description

L'analyse SonarCloud mesure la qualité générale du code : bugs, failles de sécurité, secrets oubliés, code dupliqué et couverture des tests. SonarCloud compare ces mesures à une Quality Gate et rend un verdict. C'est le tableau de bord de la maintenabilité du projet.

**Le problème qu'elle résout.**
Les tests disent si le code se comporte comme prévu, pas s'il est lisible, sûr et sans copies inutiles. Sans mesure globale, ces défauts s'accumulent sans que personne les voie, et chaque modification devient plus coûteuse.

**Comment elle fonctionne.**
Le job lit le code des quatre modules et les rapports de couverture des tests unitaires, envoie le tout à SonarCloud, puis attend le verdict de la Quality Gate.

**Définitions**

| Terme | Définition |
|---|---|
| **Anomalie (issue)** | défaut repéré dans le code : bug, faille ou mauvaise pratique. |
| **Duplication** | portion de code copiée à plusieurs endroits. |
| **Nouveau code** | code ajouté ou modifié depuis une date de référence. Les conditions s'appliquent surtout à lui. |
| **Quality Gate** | ensemble de conditions que le code doit respecter. Le verdict est « réussi » ou « échoué ». |
| **SonarCloud** | service en ligne d'analyse de code, édité par SonarSource. |

## Ce qui est vérifié

L'analyse lit le code des quatre modules et les rapports de couverture des tests unitaires.

| Ce qui est mesuré | Détail |
|---|---|
| **Fiabilité** | Bugs probables dans le code TypeScript. |
| **Sécurité** | Failles du code et secrets oubliés dans les fichiers analysés. |
| **Maintenabilité** | Mauvaises pratiques, complexité, code dupliqué. |
| **Couverture** | Part du code exécutée par les tests unitaires, pour les quatre modules. |

**Complément : le lint du code**

Sonar mesure la complexité et les mauvaises pratiques sur l'ensemble du code, mais son verdict est global. Le job
[`lint:code`](lint-code.md) s'y ajoute avec des seuils écrits dans le dépôt : une fonction dont la complexité
cyclomatique dépasse 10, ou la complexité cognitive 15, fait échouer le job, avec la ligne en cause.

**Périmètre**

- Les sources analysées sont `libs/common/src`, `api/src`, `moderation-service/src` et `frontend/src`.
- Les fichiers de tests sont reconnus comme tels et ne sont pas comptés dans le code.
- Les fichiers de démarrage, de configuration, les modules NestJS et les objets de transfert sont exclus de la couverture.
- Seules les migrations sont exclues des doublons : chaque service a son schéma. Le code commun aux deux services vit dans `libs/common`, il n'est donc plus dupliqué.

**Quality Gate**

Le projet utilise la Quality Gate par défaut de SonarCloud, « Sonar way ». Elle impose notamment, sur le nouveau code :

| Condition | Seuil |
|---|---|
| **Couverture** | Au moins 80 %. |
| **Lignes dupliquées** | Au plus 3 %. |

## Résultat de la dernière analyse

Mesures relevées le 11 novembre 2026, sur la branche principale (1,7 millier de lignes de code).

| Mesure | Résultat | Seuil |
|---|---|---|
| **Quality Gate** | Réussie, toutes les conditions sont respectées. | Réussie |
| **Couverture de l'ensemble du code** | 100 % | 80 % au moins sur le nouveau code |
| **Duplications** | 0,0 % | 3 % au plus sur le nouveau code |
| **Anomalies** | 0 (fiabilité, sécurité et maintenabilité). | Aucun seuil |
| **Points sensibles de sécurité** | 0 | Aucun seuil |
| **Notes** | A en sécurité, en fiabilité et en maintenabilité. | A |

!!! note "À savoir"
    Le 7 novembre, la Quality Gate était échouée : 58,97 % de couverture sur le nouveau code et 11,32 % de duplications.
    Les corrections faites depuis (code commun mutualisé dans `libs/common`, tests complétés jusqu'à 100 % de couverture,
    anomalies corrigées) l'ont fait passer au vert. Le job `sonar` est désormais bloquant : si la Quality Gate
    redevient échouée, la pipeline échoue.

## Quand il se lance

- Sur la branche principale uniquement, à chaque pipeline.
- Après les quatre jobs de tests unitaires, dont il lit les rapports de couverture.

!!! warning "Attention"
    L'offre gratuite de SonarCloud ne donne accès qu'à la branche principale. Sur une autre branche, le verdict est refusé
    avec le message « Organization is not allowed to access data from non main branches ». L'analyse ne se lance donc
    que sur la branche principale.

## Où voir le résultat

- **Logs du job** : le verdict de la Quality Gate et le lien vers le détail.
- **Tableau de bord SonarCloud** : l'onglet « Summary » donne les conditions, l'onglet « Issues » les anomalies, et la mention « Last analysis » l'heure de la dernière analyse.
- **Statut de la pipeline** : le job `sonar` est bloquant. Il échoue, et la pipeline avec lui, si la Quality Gate est échouée.

## Fichiers et dossiers principaux

| Fichier ou dossier | Description |
|---|---|
| **`sonar-project.properties`** | Configure l'analyse : sources, tests, exclusions et rapports de couverture. |
| **`.gitlab-ci.yml`** | Définit le job `sonar`. |
| **`libs/common/coverage/lcov.info`** | Rapport de couverture du module commun. |
| **`api/coverage/lcov.info`** | Rapport de couverture de l'API, produit par les tests unitaires. |
| **`moderation-service/coverage/lcov.info`** | Rapport de couverture de la modération. |
| **`frontend/coverage/lcov.info`** | Rapport de couverture de l'interface. |

## Commandes essentielles

À lancer dans un terminal, depuis le dossier du projet. La pipeline fait déjà ce travail à chaque changement du code.

| Commande | Description |
|---|---|
| **`make coverage`** | Produit les rapports de couverture des quatre modules. |
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
- [Quality Gate de SonarQube Cloud](https://docs.sonarsource.com/sonarqube-cloud/improving/quality-gates/)
