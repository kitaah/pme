# GitLab CI

## Fiche d'identité

| Information | Détail |
|---|---|
| **Rôle** | Lance automatiquement les contrôles de qualité à chaque modification de la branche principale |
| **Version** | Service GitLab.com, offre gratuite de 400 minutes de calcul par mois |
| **Adresse en local** | Aucune : <https://gitlab.com/kitaah/pme> |

## Description

GitLab CI/CD est la fonction d'**intégration continue** de GitLab. Elle lit un fichier placé à la racine du dépôt,
`.gitlab-ci.yml`, qui décrit les contrôles à lancer et les conditions de leur déclenchement.

**Pourquoi automatiser les contrôles ?**
Les tests existent déjà et peuvent être lancés à la main. Le problème n'est pas de les écrire, mais de les lancer
systématiquement : un vendredi soir, sur une correction « évidente », personne ne les lance. GitLab CI les exécute à
chaque modification, sans que personne ait à y penser, et conserve le résultat. Un défaut est ainsi repéré en quelques
minutes plutôt qu'en démonstration.

**Ce qu'est un job.**
Un **job** est une tâche isolée, par exemple « lancer les tests de l'API ». Il s'exécute dans un conteneur neuf, sur
une machine fournie par GitLab appelée **runner**. Rien ne subsiste d'un job à l'autre, hormis ce qui est explicitement
conservé : c'est ce qui rend les résultats reproductibles et indépendants de l'ordinateur de chacun.

```d2
vars: {
  d2-config: {
    layout-engine: elk
    theme-id: 5
    pad: 8
  }
}
direction: right

# Mise en forme commune : texte lisible à la largeur de la page, angles arrondis
classes: {
  boite: {
    style: {
      font-size: 24
      border-radius: 12
    }
  }
}

conteneur: "1. Conteneur neuf\nsur un runner" {class: boite}
code: "2. Récupération\ndu code" {class: boite}
script: "3. Exécution\ndu contrôle" {class: boite}
rapports: "4. Rapports\net verdict" {class: boite}

conteneur -> code -> script -> rapports
```

**Les jobs sont indépendants.**
Aucun job n'attend les autres, à une exception près : l'analyse de la qualité a besoin des rapports de couverture
produits par les tests. La durée d'une pipeline est donc celle de son job le plus long, et non la somme de tous.

**Un job ne tourne que s'il est concerné.**
Chaque job déclare les fichiers qu'il surveille. Modifier une page de documentation ne déclenche aucun test ; modifier
le code de l'API déclenche ses tests et l'analyse de qualité. Cette règle protège le quota de 400 minutes mensuelles,
et évite surtout d'attendre des contrôles sans rapport avec la modification.

**Les outils sont épinglés et vérifiés.**
Les programmes téléchargés par les jobs le sont dans une version précise, et leur empreinte est vérifiée avant usage.
Une pipeline qui réussit aujourd'hui donnera donc le même résultat dans six mois, et une archive modifiée sur le
serveur d'origine serait détectée.

**Définitions**

| Terme | Définition |
|---|---|
| **Artefact** | Fichier produit par un job et conservé, par exemple un rapport de tests. |
| **Cache** | Dossier conservé d'un job à l'autre pour éviter de retélécharger les mêmes dépendances. |
| **Intégration continue (CI)** | Pratique qui consiste à contrôler automatiquement le code à chaque modification. |
| **Job** | Tâche de la pipeline, par exemple « lancer les tests de l'API ». |
| **Pipeline** | Ensemble des jobs lancés pour une même modification. |
| **Runner** | Machine fournie par GitLab qui exécute les jobs. |
| **Service** | Conteneur auxiliaire démarré pendant un job, comme PostgreSQL ou NATS. |
| **Étape (stage)** | Regroupement de jobs. Le projet en utilise cinq : tests, qualité, intégration, images, performance. |

## Rôle dans le projet

- Il exécute les neuf jobs de la pipeline : tests unitaires, analyse SonarCloud, contrôle des Dockerfile, tests
  d'intégration, analyse des dépendances, contrôle et publication des images, tests de performance.
- Il ne se déclenche que sur la branche principale, et seulement pour les jobs dont les fichiers ont changé.
- Il publie les images vérifiées dans le registre de conteneurs du projet.
- Il publie les rapports de tests et de couverture dans l'interface de GitLab.
- Il conserve le résultat de chaque pipeline, ce qui prouve que chaque modification a été contrôlée.
- Sans lui, les contrôles dépendraient de la rigueur de chacun et de la machine utilisée.

Le détail de chaque contrôle est décrit dans la [vue d'ensemble de la pipeline](../pipeline/index.md).

!!! note "À savoir"
    Les valeurs sensibles, comme le jeton d'accès à SonarCloud, sont définies dans les réglages CI/CD du projet, et
    masquées dans les journaux. Elles ne sont jamais écrites dans le dépôt.

## Fichiers et dossiers principaux

| Fichier ou dossier | Description |
|---|---|
| `.gitlab-ci.yml` | Décrit les étapes, les jobs, leurs conditions et leurs rapports. |
| `sonar-project.properties` | Configure l'analyse de qualité lancée par un job. |
| `docker-bake.hcl` | Décrit la construction des trois images. |
| `.hadolint.yaml` | Règle le niveau d'échec du contrôle des Dockerfile. |
| `.trivyignore` | Liste les failles acceptées temporairement, avec leur date d'expiration. |
| `scripts/perf-ci.sh` | Enchaîne le démarrage de l'API et le test de performance. |
| `tests/` | Contient les contrôles d'images et les scénarios de performance. |

## Commandes essentielles

Chaque contrôle de la pipeline a son équivalent sur l'ordinateur, à lancer depuis le dossier du projet.

| Commande | Description |
|---|---|
| `make test` | Lance les tests unitaires, comme les jobs `unit-tests`. |
| `make coverage` | Lance les tests avec la couverture et ses seuils. |
| `make test-integration` | Lance les tests d'intégration, Docker démarré. |
| `make lint-docker` | Contrôle les Dockerfile, comme le job `hadolint`. |
| `make image-test` | Contrôle les images, comme le job `image-tests`. |
| `make perf` | Lance les tests de performance sur le cluster local. |
| `make quality` | Enchaîne les contrôles statiques. |

!!! note "À savoir"
    Dans GitLab, le menu **Build**, puis **Pipelines**, liste les pipelines et leur résultat. Le menu **Build**, puis
    **Jobs**, donne accès au journal complet de chaque job, qui indique la cause exacte d'un échec.

!!! warning "Attention"
    Chaque pipeline consomme le quota gratuit de 400 minutes de calcul par mois. Une fois épuisé, plus aucun job ne
    démarre avant le mois suivant : mieux vaut regrouper les corrections mineures en un seul envoi.

!!! tip "Astuce"
    Lancer le contrôle équivalent sur son ordinateur avant de pousser évite un aller-retour de plusieurs minutes et
    économise le quota mensuel.

## Pour aller plus loin

- [Vue d'ensemble de la pipeline du projet](../pipeline/index.md)
- [Documentation de GitLab CI/CD](https://docs.gitlab.com/ci/)
- [Référence du fichier `.gitlab-ci.yml`](https://docs.gitlab.com/ci/yaml/)
