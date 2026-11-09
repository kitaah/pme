# Fonctionnement de la pipeline

## Objectif

Expliquer quand la pipeline se lance, comment elle reste rapide et économe, et comment lire ses résultats. Le quota
gratuit de GitLab est de 400 minutes par mois : chaque règle ci-dessous sert à ne pas le gaspiller.

**Définitions**

- **Règle de déclenchement** : condition qui décide si un job se lance.
- **Cache** : dossier conservé d'un job à l'autre, comme les paquets npm déjà téléchargés.
- **Job indépendant** : job qui ne dépend d'aucun autre et démarre tout de suite.
- **Quota** : nombre de minutes de calcul offertes chaque mois par GitLab.
- **Job interruptible** : job qu'un nouveau commit peut annuler.

## Déclenchement

La pipeline ne se lance que sur la branche principale. Un commit sur une autre branche ne déclenche rien.

Ensuite, chaque job surveille ses propres fichiers :

| Job | Fichiers surveillés |
|---|---|
| **`unit-tests:*`**<br>**`sonar`** | Les trois modules, `.gitlab-ci.yml` et `sonar-project.properties`. |
| **`integration-tests`** | L'API, la modération et `.gitlab-ci.yml`. |
| **`image-tests`** | Les Dockerfile, les dépendances, nginx, les tests d'image, `.trivyignore` et `.gitlab-ci.yml`. |
| **`performance-tests`** | L'API, les scénarios k6, `scripts/perf-ci.sh` et `.gitlab-ci.yml`. |

Si aucun fichier surveillé n'a changé, le job ne se lance pas. Pour `image-tests`, il reste disponible en lancement manuel.

!!! tip "Astuce"
    Ajouter `[skip ci]` dans le message d'un commit empêche toute pipeline pour ce commit. À éviter sur la fusion
    finale dans la branche principale, sinon les contrôles ne se lancent pas.

## Optimisations

| Technique | Effet |
|---|---|
| **Jobs indépendants** | Les jobs démarrent ensemble. La durée est celle du job le plus long. |
| **Cache des paquets npm** | Un cache par module, renouvelé quand `package-lock.json` change. |
| **Clonage minimal** | Seul le dernier commit est récupéré. Sonar récupère tout l'historique. |
| **Artefacts légers** | Seul le fichier de couverture utile est conservé, pas le rapport HTML. |
| **Compression rapide** | Les archives de cache et d'artefacts se compressent vite plutôt que petit. |
| **Un seul Docker pour l'intégration** | L'API et la modération partagent un démarrage de Docker-in-Docker. |
| **Miroir d'images** | PostgreSQL et NATS sont téléchargés depuis le miroir de Google. |
| **Construction parallèle** | Les trois images sont construites en même temps avec BuildKit. |
| **Analyses parallèles** | La base de Trivy est téléchargée une fois, puis les trois images sont analysées ensemble. |
| **Annulation automatique** | Un nouveau commit annule la pipeline devenue inutile. |

## Fiabilité

- Un job s'arrête après 5 minutes, ce qui protège le quota contre un blocage.
- Un job n'est relancé qu'en cas de panne du runner ou de l'API de GitLab, jamais après un test échoué.
- Les versions de Trivy, container-structure-test et k6 sont fixées. Chaque téléchargement est vérifié par sa somme de contrôle.
- Les mots de passe de test de la pipeline sont jetables : leurs services disparaissent à la fin du job.

## Quota

La durée d'une pipeline est celle de son job le plus long. Le quota, lui, compte la **somme** des durées de tous les
jobs, car chaque job est facturé pour son temps d'exécution. Les règles de déclenchement servent donc à économiser le
quota : un job qui ne tourne pas ne coûte rien.

!!! warning "Attention"
    Le job `image-tests` est le plus coûteux. Il se lance seul uniquement quand une image change. Éviter de le relancer
    à la main sans raison. Il publie aussi les images dans le registre : l'envoi allonge sa durée de quelques secondes.

## Lire un résultat

1. Dans GitLab, ouvrir **Build**, puis **Pipelines**.
2. Cliquer sur la pipeline du commit. Chaque job y apparaît avec son statut.
3. Cliquer sur un job pour lire ses logs.
4. Ouvrir l'onglet **Tests** de la pipeline pour voir chaque test unitaire et d'intégration.
5. Télécharger les artefacts d'un job depuis le panneau de droite : rapports k6, rapports Trivy, couverture.
6. Ouvrir le lien SonarCloud des logs du job `sonar` pour le détail de la qualité.

| Statut | Signification |
|---|---|
| **Réussi (vert)** | Tous les contrôles sont passés. |
| **Avertissement (orange)** | Un job toléré a échoué. Aujourd'hui, c'est la Quality Gate de Sonar. |
| **Échoué (rouge)** | Un contrôle obligatoire a échoué. |
| **Manuel (gris)** | Le job attend un clic pour se lancer. |

## Dépannage

| Symptôme | Cause probable et action |
|---|---|
| **Aucune pipeline après un push** | Branche autre que la principale, `[skip ci]` dans le message, ou aucun fichier surveillé modifié. |
| **`sonar` refuse la branche** | L'offre gratuite n'analyse que la branche principale. |
| **`image-tests` échoue sur Trivy** | Une faille grave est corrigeable : mettre à jour la dépendance, sinon l'excuser dans `.trivyignore`. |
| **`integration-tests` dépasse le délai** | Le téléchargement des images est lent : relancer le job. |
| **`performance-tests` sort avec le code 99** | Un seuil k6 est dépassé : lire le résumé et `api.log`. |
| **Un test passe en local mais échoue en pipeline** | Vérifier la version de Node (24) et que `npm ci` reproduit les dépendances. |

## Variables CI/CD

| Variable | Rôle |
|---|---|
| **`SONAR_TOKEN`** | Jeton d'accès à SonarCloud. Elle est masquée dans les logs. |
| **`SONAR_HOST_URL`** | Adresse de SonarCloud : `https://sonarcloud.io`. |

## Pour aller plus loin

- [Fichier de la pipeline sur GitLab](https://gitlab.com/kitaah/pme/-/blob/main/.gitlab-ci.yml)
- [Règles de déclenchement dans GitLab CI/CD](https://docs.gitlab.com/ci/jobs/job_rules/)
- [Quota de minutes de calcul de GitLab](https://docs.gitlab.com/ci/pipelines/compute_minutes/)
