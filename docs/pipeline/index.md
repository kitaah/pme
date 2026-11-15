# Pipeline CI/CD

## Fiche d'identité

| Information | Détail |
|---|---|
| **Rôle** | Vérifie automatiquement la qualité du code et des images à chaque modification de la branche principale, puis publie les images vérifiées dans le registre GitLab |
| **Plateforme** | GitLab CI/CD, offre gratuite (400 minutes de calcul par mois) |
| **Configuration** | Le fichier `.gitlab-ci.yml`, à la racine du dépôt |
| **Déclencheur** | Chaque commit ou fusion sur la branche principale (`main`) |
| **Durée visée** | Moins de 5 minutes par pipeline (environ 2 à 3 minutes une fois le cache de construction rempli) |
| **Nombre de jobs** | 16 jobs, répartis en 10 familles de contrôles |

## Description

Une **pipeline** est une suite de tâches que GitLab lance seul, sans intervention humaine. Chaque tâche s'appelle un
**job**. Chaque job démarre dans un conteneur neuf, fait un contrôle précis, puis publie son résultat. Si un contrôle
échoue, la pipeline devient rouge et l'équipe le voit tout de suite.

**Le problème : des contrôles qui dépendent de la mémoire.**
Avant chaque mise en ligne, il faudrait relancer les tests, vérifier les images, relire les dépendances, mesurer la
vitesse de l'API. Réalisés à la main, ces contrôles sont longs, et chacun finit par en oublier un quand le temps manque.
Une régression passe alors inaperçue jusqu'à ce qu'un membre la rencontre. La pipeline remplace la mémoire par une
procédure : les mêmes contrôles, dans les mêmes conditions, à chaque modification.

**Ce qu'elle vérifie.**
Neuf choses : le code est bien écrit et sa complexité reste sous les seuils, les fichiers YAML sont valides, le code se
comporte comme prévu, les services fonctionnent ensemble, les Dockerfile respectent les bonnes pratiques, les
dépendances sont sûres, les images Docker du projet sont sûres, celles d'Istio aussi, et l'API reste rapide. Une
dixième analyse note la qualité générale du code. Une fois les images contrôlées, elles sont publiées dans le registre de GitLab.

**Pourquoi publier les images.**
Cette publication apporte quatre bénéfices. Chaque image est liée à un commit précis, donc traçable. L'image déployée est
celle qui a été vérifiée, pas une reconstruction. En cas de problème, on revient à la version précédente sans rien
reconstruire. Enfin, la pipeline fournit un résultat prêt à déployer, ce qui prépare la livraison continue.

**Définitions**

| Terme | Définition |
|---|---|
| **Artefact** | Fichier produit par un job et conservé, comme un rapport de tests. |
| **Job** | Tâche de la pipeline, par exemple « lancer les tests de l'API ». |
| **Pipeline** | Ensemble des jobs lancés pour un commit. |
| **Runner** | Machine de GitLab qui exécute les jobs. |
| **Seuil** | Limite à respecter, par exemple une couverture minimale. Si elle n'est pas atteinte, le job échoue. |

## Rôle dans le projet

- Elle contrôle chaque exigence de qualité du projet par au moins un test. Voir la page [Exigences qualité](exigences-qualite.md).
- Elle empêche une régression d'arriver sur la branche principale sans que l'équipe la voie.
- Elle garde une trace de chaque contrôle : rapports de tests, couverture, analyse des vulnérabilités.
- Elle publie les images vérifiées, prêtes à être déployées.
- Sans elle, les contrôles dépendraient de la mémoire de chaque développeur.

Les jobs n'attendent pas les uns les autres : ils démarrent ensemble. Seule l'analyse SonarCloud attend les rapports de
couverture des tests unitaires. La durée de la pipeline est donc celle du job le plus long.

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

commit: "Commit\nsur main" {class: boite}

jobs: "Jobs lancés ensemble" {
  grid-columns: 2
  unitaires: "Tests unitaires\n4 jobs" {class: boite}
  lintcode: "Lint du code\n4 jobs" {class: boite}
  lintyaml: "Lint YAML" {class: boite}
  hadolint: "Contrôle des\nDockerfile" {class: boite}
  dependances: "Analyse des\ndépendances" {class: boite}
  istio: "Analyse des\nimages d'Istio" {class: boite}
  integration: "Tests\nd'intégration" {class: boite}
  images: "Tests et publication\ndes images" {class: boite}
  performance: "Tests de\nperformance" {class: boite}
}

sonar: "Analyse SonarCloud\nqualité et couverture" {class: boite}

commit -> jobs
jobs.unitaires -> sonar: "rapports de\ncouverture"
```

## Les jobs

Tous ces jobs tournent à **chaque** pipeline, quels que soient les fichiers modifiés par le commit : aucun n'est lancé à la main.

| Job | Ce qu'il contrôle |
|---|---|
| **`unit-tests:common`** | Les 67 tests unitaires du module commun et leur couverture. |
| **`unit-tests:api`** | Les 119 tests unitaires de l'API. |
| **`unit-tests:moderation-service`** | Les 49 tests unitaires du service de modération. |
| **`unit-tests:frontend`** | Les 136 tests unitaires de l'interface. |
| **`sonar`** | La qualité du code, la couverture et les doublons. |
| **`lint:code`** | 4 jobs, un par module : ESLint (complexité cyclomatique de 10 au plus, cognitive de 15 au plus), typage `tsc` et mise en forme Prettier. |
| **`lint:yaml`** | Les fichiers YAML : manifestes Kubernetes, tests d'images et pipeline. |
| **`hadolint`** | Les bonnes pratiques des 4 Dockerfile du projet. |
| **`integration-tests`** | Les 31 tests avec une vraie base et un vrai broker. |
| **`dependency-scan`** | Les failles connues dans les dépendances, devDependencies comprises. |
| **`istio-scan`** | Les failles connues dans les 3 images d'Istio. Le job échoue sur une faille CRITICAL corrigeable. |
| **`image-tests`** | La structure et les vulnérabilités des 3 images, puis leur publication dans le registre. |
| **`performance-tests`** | La rapidité de l'API sous charge. |

## Principes de conception

| Principe | Application |
|---|---|
| **Indépendance** | Les jobs n'ont pas de dépendance entre eux, sauf Sonar. |
| **Économie** | Les couches des images sont mises en cache dans le registre, et les téléchargements d'outils se font en parallèle. |
| **Reproductibilité** | Chaque outil a une version précise. Les programmes téléchargés sont vérifiés par leur somme de contrôle. |
| **Traçabilité** | Les rapports sont conservés une semaine dans GitLab. |
| **Sobriété** | Un nouveau commit annule la pipeline devenue inutile. Un job s'arrête après 5 minutes, 6 pour `image-tests`. |
| **Fiabilité** | Un job n'est relancé qu'en cas de panne du runner, jamais après un échec de test. |

Le détail de ces règles se trouve dans la page [Fonctionnement](fonctionnement.md).

## Les pages de cette section

| Page | Ce qu'on y trouve |
|---|---|
| **[Exigences qualité](exigences-qualite.md)** | Les exigences du projet et le test qui prouve chacune. |
| **[Fonctionnement](fonctionnement.md)** | Déclenchement, optimisations, quota et lecture des résultats. |
| **[Tests unitaires](tests-unitaires.md)** | La liste des 370 tests unitaires. |
| **[Tests d'intégration](tests-integration.md)** | La liste des 31 tests d'intégration. |
| **[Lint du code](lint-code.md)** | ESLint, complexité, typage et mise en forme des 4 modules. |
| **[Lint YAML](lint-yaml.md)** | Les règles yamllint appliquées aux fichiers YAML. |
| **[Contrôle des Dockerfile](controle-dockerfile.md)** | Les règles Hadolint appliquées aux 4 Dockerfile. |
| **[Analyse des dépendances](analyse-dependances.md)** | La recherche de failles dans les `package-lock.json` et dans les images d'Istio. |
| **[Tests des images Docker](tests-images.md)** | Les 24 contrôles de structure et l'analyse Trivy. |
| **[Publication des images](publication-images.md)** | Le dépôt des images vérifiées dans le registre GitLab. |
| **[Tests de performance](tests-performance.md)** | Les scénarios k6 et leurs seuils. |
| **[Analyse SonarCloud](analyse-sonarcloud.md)** | La Quality Gate et ses résultats. |

## Contrôles prévus

D'autres contrôles existent déjà sur l'ordinateur de chaque développeur. Ils seront ajoutés à la pipeline, un par un.
Le lint du code, la complexité, la mise en forme et le lint YAML y sont déjà.

| Contrôle | Commande locale |
|---|---|
| **Manifestes Kubernetes (kubeconform)** | `make lint-k8s` |
| **Secrets oubliés dans le code (gitleaks)** | `make secrets-scan` |
| **Dépendances vulnérables (npm audit)** | `make audit` |
| **Tous les contrôles, y compris ceux déjà dans la pipeline** | `make quality` |

!!! note "À savoir"
    La pipeline ne trie pas les commits selon les fichiers modifiés : un commit qui ne touche que la documentation
    lance les seize jobs et consomme du quota comme n'importe quel autre. Grouper les retouches de documentation en
    un seul commit reste donc la façon la plus simple d'économiser des minutes.

!!! warning "Attention"
    La pipeline ne se lance que sur la branche principale. Un commit poussé sur une autre branche n'est contrôlé par
    aucun job : lancer les commandes locales avant de fusionner.

!!! tip "Astuce"
    Chaque contrôle de la pipeline a son équivalent sur l'ordinateur, à lancer avant d'envoyer le code. Cela évite un
    aller-retour de plusieurs minutes et économise le quota mensuel. Les commandes sont listées dans la fiche
    [GitLab CI](../outils/gitlab-ci.md).

## Pour aller plus loin

- [Fichier de la pipeline sur GitLab](https://gitlab.com/kitaah/pme/-/blob/main/.gitlab-ci.yml)
- [Documentation de GitLab CI/CD](https://docs.gitlab.com/ci/)
- [Fiche GitLab CI du projet](../outils/gitlab-ci.md)
