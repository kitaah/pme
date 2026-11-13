# GitHub Actions

## Fiche d'identité

| Information | Détail |
|---|---|
| **Rôle** | Rejoue sur GitHub les contrôles de la pipeline GitLab, à chaque modification de la branche principale |
| **Version** | Service GitHub Actions, workflow `ci.yml`, actions officielles en version majeure (`@v4`) |
| **Adresse en local** | Aucune : onglet **Actions** du dépôt GitHub |

## Description

GitHub Actions est la fonction d'**intégration continue** de GitHub. Elle lit les fichiers placés dans
`.github/workflows/` et lance, sur une machine fournie par GitHub, les contrôles qu'ils décrivent.

**Pourquoi une seconde pipeline ?**
Le dépôt de référence est sur GitLab, et GitLab CI y lance les contrôles. Une copie du dépôt existe aussi sur GitHub,
alimentée automatiquement par GitLab (miroir). GitHub ne lit pas le fichier `.gitlab-ci.yml` : sans workflow à lui, sa
copie ne serait contrôlée par personne. Le fichier `.github/workflows/ci.yml` joue le même rôle que `.gitlab-ci.yml`,
dans la syntaxe de GitHub.

**Les deux pipelines font la même chose.**
La logique n'est pas dans les fichiers de pipeline : elle est dans le projet (`npm run`, `scripts/perf-ci.sh`, fichiers
de règles comme `.yamllint.yml`). Chaque pipeline se contente de les appeler. Les mêmes dix contrôles tournent donc des
deux côtés : tests unitaires, analyse SonarCloud, lint du code, lint YAML, contrôle des Dockerfile, analyse des
dépendances, analyse des images d'Istio, tests d'intégration, tests des images et tests de performance. Un dernier job,
`ci-ok`, résume le verdict : c'est lui qu'on exige dans la protection de branche.

**Ce qui change d'une plateforme à l'autre.**
Seule la manière d'obtenir l'environnement diffère :

| Sujet | GitLab CI | GitHub Actions |
|---|---|---|
| **Docker pour les tests d'intégration et les images** | Service Docker-in-Docker | Docker déjà présent sur la machine |
| **PostgreSQL et NATS (performance)** | Deux services du job | PostgreSQL en service, NATS lancé par une étape (un service ne reçoit pas d'arguments) |
| **Registre des images** | Registre de GitLab | `ghcr.io`, avec le jeton fourni par GitHub |
| **Rapports de tests** | Onglet « Tests » des merge requests | Artefacts téléchargeables |
| **Annulation d'une exécution obsolète** | `interruptible` | `concurrency` |

**Les outils restent épinglés et vérifiés.**
Trivy, Hadolint, container-structure-test et k6 sont téléchargés dans une version précise, et leur somme de contrôle est
vérifiée avant usage, comme sur GitLab.

**Définitions**

| Terme | Définition |
|---|---|
| **Action** | Brique réutilisable d'un workflow, par exemple `actions/checkout` qui récupère le code. |
| **Artefact** | Fichier produit par un job et conservé, par exemple un rapport de tests. |
| **Intégration continue (CI)** | Pratique qui consiste à contrôler automatiquement le code à chaque modification. |
| **Job** | Tâche du workflow, par exemple « lancer les tests de l'API ». |
| **Miroir** | Copie d'un dépôt tenue à jour automatiquement à partir d'un autre. |
| **Runner** | Machine fournie par GitHub qui exécute les jobs. |
| **Secret** | Valeur sensible, comme un jeton, définie dans les réglages du dépôt et masquée dans les logs. |
| **Workflow** | Fichier YAML qui décrit les jobs et leurs conditions de déclenchement. |

## Rôle dans le projet

- Il exécute sur GitHub les dix contrôles de la pipeline, à chaque envoi sur la branche principale (`main`) ou à la demande.
- Il publie les images vérifiées dans le registre de conteneurs de GitHub (`ghcr.io`), avec le commit pour étiquette.
- Il annule l'exécution devenue obsolète quand un nouveau commit arrive.
- Il conserve les rapports de tests, de couverture et d'analyse sous forme d'artefacts, pendant sept jours.
- Sans lui, la copie GitHub du dépôt ne serait contrôlée par aucune pipeline.

## Fichiers et dossiers principaux

| Fichier ou dossier | Description |
|---|---|
| **`.github/workflows/ci.yml`** | Décrit les jobs, leurs conditions et leurs rapports. |
| **`.github/actions/setup-trivy/`** | Installe Trivy en version épinglée, avec vérification de sa somme de contrôle. |
| **`.github/actions/docker-mirror/`** | Déclare le miroir Docker Hub dans le démon Docker du runner. |
| **`.gitlab-ci.yml`** | La pipeline d'origine, inchangée. |
| **`sonar-project.properties`** | Configure l'analyse de qualité, lue par les deux pipelines. |
| **`scripts/perf-ci.sh`** | Enchaîne le démarrage de l'API et le test de performance, pour les deux pipelines. |

## Commandes essentielles

Les contrôles se lancent comme pour GitLab, avec les cibles `make` du projet. Pour la pipeline elle-même :

| Commande | Description |
|---|---|
| **`make lint-yaml`** | Contrôle les fichiers YAML, dont le workflow et les actions locales. |
| **`actionlint`** | Contrôle la syntaxe d'un workflow (outil à installer, facultatif). |
| **`gh run list`** | Liste les dernières exécutions (GitHub CLI). |
| **`gh run watch`** | Suit une exécution en cours. |

La mise en place complète, du dépôt GitHub au miroir, au jeton et au secret `SONAR_TOKEN`, est décrite pas à pas dans
[Miroir GitLab vers GitHub](../pipeline/miroir-github.md).

!!! note "À savoir"
    Le secret `SONAR_TOKEN` n'existe que dans les réglages du dépôt GitHub, et il est masqué dans les logs. Sans lui,
    le job `sonar` échoue avec un message qui le dit : il faut donc le recréer à part, GitLab ne le transmet pas.

!!! warning "Attention"
    Ne poussez que sur GitLab : le miroir recopie vers GitHub, et un commit ajouté directement sur GitHub serait écrasé
    ou ferait échouer la copie. De plus, le workflow est déclenché sur la branche `main` : si la branche principale a un
    autre nom, la ligne `branches` de `ci.yml` doit être adaptée.

!!! tip "Astuce"
    Le déclenchement manuel (**Actions**, puis **CI**, puis **Run workflow**) relance toute la chaîne sans nouveau
    commit. Il est utile après avoir créé le secret `SONAR_TOKEN`.

## Pour aller plus loin

- [Miroir GitLab vers GitHub, toutes les étapes](../pipeline/miroir-github.md)
- [Vue d'ensemble de la pipeline du projet](../pipeline/index.md)
- [Fiche GitLab CI du projet](gitlab-ci.md)
- [Documentation de GitHub Actions](https://docs.github.com/fr/actions)
