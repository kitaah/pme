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

Ensuite, **tous les jobs se lancent à chaque pipeline**, quels que soient les fichiers modifiés. Aucun job n'est manuel :
une pipeline donne donc toujours le tableau complet des contrôles, ce qui rend le résultat lisible d'un coup d'œil et
simple à présenter.

Ce choix a un coût : chaque pipeline consomme le temps de tous les jobs. Il est compensé par la rapidité de chaque job
(voir les optimisations ci-dessous) et par l'annulation automatique d'une pipeline devenue obsolète.

!!! tip "Astuce"
    Ajouter `[skip ci]` dans le message d'un commit empêche toute pipeline pour ce commit. À éviter sur la fusion
    finale dans la branche principale, sinon les contrôles ne se lancent pas.

## Optimisations

| Technique | Effet |
|---|---|
| **Jobs indépendants** | Les jobs démarrent ensemble. La durée est celle du job le plus long. |
| **Cache des paquets npm** | Un cache partagé par le module commun, l'API et la modération (un seul `npm ci` à la racine), un autre pour l'interface. Ils sont renouvelés quand `package-lock.json` change. |
| **Lint en parallèle** | Le lint du code tourne en 4 jobs (un par module) et le lint YAML en 1 job, tous indépendants. Les 4 jobs du lint du code partagent un cache npm. |
| **Clonage minimal** | Seul le dernier commit est récupéré. Sonar récupère tout l'historique. |
| **Artefacts légers** | Seul le fichier de couverture utile est conservé, pas le rapport HTML. |
| **Compression rapide** | Les archives de cache et d'artefacts se compressent vite plutôt que petit. |
| **Un seul Docker pour l'intégration** | L'API et la modération partagent un démarrage de Docker-in-Docker. |
| **Miroir d'images** | PostgreSQL et NATS sont téléchargés depuis le miroir de Google. |
| **Construction parallèle** | Les trois images sont construites en même temps avec BuildKit. |
| **Cache de construction** | Les couches des images (notamment `npm ci`) sont conservées dans le registre GitLab, dans les dépôts `cache/`. Une couche n'est reconstruite que si ses fichiers changent. |
| **Images de base épinglées** | Les Dockerfile désignent `node` et `nginx` par leur empreinte (`@sha256:…`) et non par leur seule étiquette. Une mise à jour de l'image sur Docker Hub ne vide donc pas le cache de construction. |
| **Dépendances de production à part** | Dans les Dockerfile de l'API et de la modération, les dépendances de production sont installées dans une étape dédiée, mise en cache tant que `package-lock.json` ne change pas. |
| **Outils installés en parallèle** | container-structure-test et Trivy sont téléchargés en même temps, et la base de Trivy pendant la construction des images. |
| **Analyses parallèles** | Les trois images sont contrôlées ensemble : structure puis vulnérabilités. |
| **Annulation automatique** | Un nouveau commit annule la pipeline devenue inutile. |

## Fiabilité

- Un job s'arrête après 5 minutes, ce qui protège le quota contre un blocage. `image-tests`, qui construit et publie trois images, dispose de 6 minutes.
- Un job n'est relancé qu'en cas de panne du runner ou de l'API de GitLab, jamais après un test échoué.
- Les versions de Trivy, container-structure-test et k6 sont fixées. Chaque téléchargement est vérifié par sa somme de contrôle.
- Les mots de passe de test de la pipeline sont jetables : leurs services disparaissent à la fin du job.

## Quota

La durée d'une pipeline est celle de son job le plus long. Le quota, lui, compte la **somme** des durées de tous les
jobs, car chaque job est facturé pour son temps d'exécution. Comme tous les jobs tournent à chaque pipeline, il vaut mieux
grouper les modifications en peu de commits plutôt que d'en pousser de nombreux petits. Les 4 jobs `lint:code` font
chacun un `npm ci` : ils ajoutent quelques minutes de calcul par pipeline, sans allonger sa durée.

!!! warning "Attention"
    Le job `image-tests` est le plus long. Cache de construction vide ou périmé (premier passage, `package-lock.json`
    modifié, empreinte d'image de base changée), il dépasse sa limite de 6 minutes. Cache rempli, il dure 2 à 3 minutes.
    Si le job échoue sur le délai, relancer **ce seul job** (`Retry`) : le cache est alors rempli. Avant une démonstration,
    vérifier qu'un pipeline complet est passé en moins de 6 minutes.

    Pour mettre à jour une image de base : `docker buildx imagetools inspect node:24-alpine` (ligne `Digest`), puis
    remplacer l'empreinte dans les Dockerfile de l'API, de la modération et de l'interface. Le premier pipeline suivant
    reconstruit tout (cache vide), le second est rapide.

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
| **Avertissement (orange)** | Un job toléré a échoué. Aucun job n'est toléré aujourd'hui : tous les contrôles sont bloquants. |
| **Échoué (rouge)** | Un contrôle obligatoire a échoué. |
| **Manuel (gris)** | Le job attend un clic pour se lancer. Aucun job du projet n'est manuel aujourd'hui. |

## Dépannage

| Symptôme | Cause probable et action |
|---|---|
| **Aucune pipeline après un push** | Branche autre que la principale, ou `[skip ci]` dans le message. |
| **`sonar` refuse la branche** | L'offre gratuite n'analyse que la branche principale. |
| **`image-tests` vert, mais rien dans le registre** | Le log s'arrête après les tests de structure : un bloc du script se terminait par `exit`, ce qui arrête tout le script avec succès. Ne jamais utiliser `exit` dans le script d'un job, mais `test "$status" -eq 0`. |
| **`image-tests` échoue sur Trivy** | Une faille grave est corrigeable : mettre à jour la dépendance, sinon l'excuser dans `.trivyignore`. |
| **`lint:code` échoue sur une complexité** | Une fonction dépasse 10 (cyclomatique) ou 15 (cognitive) : la découper. Voir [Lint du code](lint-code.md). |
| **`lint:yaml` échoue sur `new-line-at-end-of-file`** | Un fichier YAML ne se termine pas par un retour à la ligne : en ajouter un. Voir [Lint YAML](lint-yaml.md). |
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
