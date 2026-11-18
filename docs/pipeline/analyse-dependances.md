# Analyse des dépendances

## Fiche d'identité

| Information | Détail |
|---|---|
| **Rôle** | Détecte les failles de sécurité connues dans les bibliothèques du projet, y compris celles qui ne servent qu'à construire et tester l'application |
| **Jobs** | `dependency-scan` pour les dépendances, `istio-scan` pour les images d'Istio |
| **Outil** | Trivy 0.71.2 |
| **Déclencheur** | Chaque pipeline, sur la branche principale |

## Description

L'analyse des dépendances recherche les failles de sécurité déjà publiées dans les bibliothèques externes dont le projet a besoin, y compris celles qui ne servent qu'à construire et tester l'application.

**Le problème qu'elle résout.**
Une bibliothèque externe peut contenir une faille découverte après son ajout au projet. Sans contrôle, personne ne le sait. Les listes publiques de failles évoluent chaque jour : le contrôle est donc répété à chaque pipeline, même quand le projet n'a pas changé.

**Comment elle fonctionne.**
Trivy lit les fichiers `package-lock.json` du dépôt, compare chaque version à la liste publique des failles connues, puis fait échouer le job s'il reste une faille grave (HIGH ou CRITICAL) pour laquelle un correctif existe. Il ne démarre pas Docker.

**Définitions**

| Terme | Définition |
|---|---|
| **Dépendance** | bibliothèque externe dont le projet a besoin, déclarée dans `package.json`. |
| **devDependency** | dépendance utilisée seulement pour développer (build, tests, outils). Elle n'est pas dans l'image livrée. |
| **Faille (CVE)** | défaut de sécurité public, repéré par un identifiant du type `CVE-2026-00000`. |
| **Faille corrigeable** | faille pour laquelle l'éditeur a déjà publié un correctif. |
| **`package-lock.json`** | fichier qui fige la version exacte de chaque dépendance. |
| **Trivy** | outil libre qui compare ces versions à la liste publique des failles connues. |

## Pourquoi en plus de l'analyse des images

| Analyse | Ce qu'elle voit | Ce qu'elle ne voit pas |
|---|---|---|
| **[Images Docker](tests-images.md)** | Les paquets présents dans l'image livrée. | Les devDependencies, absentes de l'image. |
| **Dépendances** | Les trois `package-lock.json`, devDependencies comprises. | Le système de l'image (Alpine, nginx). |

Une faille dans un outil de build ne part pas en production, mais elle peut compromettre le poste d'un développeur ou
la pipeline elle-même. Les deux analyses se complètent.

## Ce qui est vérifié

| Règle | Valeur |
|---|---|
| **Ce qui est analysé** | Les fichiers `package-lock.json` de l'API, de la modération et de l'interface. |
| **Gravités bloquantes** | HIGH et CRITICAL. |
| **Failles sans correctif** | Ignorées : l'équipe ne peut rien y faire. |
| **Exceptions** | Listées dans `.trivyignore`, avec une date d'expiration obligatoire. Le fichier est partagé avec l'analyse des images. |
| **Résultat** | Un tableau dans le log et le rapport `trivy-dependencies.json`. |

Le job ne démarre pas Docker : Trivy lit directement les fichiers du dépôt. Il est donc court et peu coûteux.

!!! note "À savoir"
    Le job `dependency-scan` lit les fichiers du dépôt : il voit les dépendances Node.js, pas le système de l'image
    (Alpine, nginx). Cette part est couverte par les [tests des images Docker](tests-images.md).

## Quand il se lance

- Sur la branche principale, à chaque pipeline, sans lancement manuel.
- Le job `istio-scan` suit la même règle.

**Images du maillage Istio.** Le job `istio-scan` analyse les images d'Istio (plan de contrôle, agent réseau et ztunnel),
dont deux s'exécutent avec des droits élevés sur le nœud. Ces images sont publiées par Istio et le projet ne les
reconstruit pas : seule une nouvelle version d'Istio corrige une faille. La règle est donc différente de celle des
dépendances. Une faille CRITICAL corrigeable fait échouer le job. Les failles HIGH sont comptées dans le log et
conservées dans un rapport JSON par image, pour décider d'une montée de version. Le job lit la version d'Istio dans le
`Makefile`, se lance, lui aussi, à chaque pipeline. En
local : `make istio-scan`.

!!! warning "Attention"
    Une nouvelle faille peut être publiée sans que le projet change. Le job la voit au prochain pipeline, dès que la
    base de Trivy est à jour. Les images du projet sont analysées de la même façon à chaque pipeline.

## Où voir le résultat

- **Log du job** `dependency-scan` : un tableau des failles par fichier, avec la version qui les corrige.
- **Artefact du job** : `trivy-dependencies.json`, conservé une semaine.
- **Statut de la pipeline** : le job échoue s'il reste une faille grave et corrigeable non justifiée.

## Corriger une faille

1. Lire dans le tableau la dépendance concernée et la version corrigée.
2. Mettre à jour la dépendance, par exemple avec `npm update <nom>` dans le module concerné.
3. Valider le changement avec les tests, puis pousser le nouveau `package-lock.json`.

Si la mise à jour est impossible tout de suite, ajouter une exception datée dans `.trivyignore`, avec sa justification.

!!! tip "Astuce"
    `make audit` donne en quelques secondes un premier contrôle des dépendances de production, avant l'envoi du code.
    Il ne remplace pas le job `dependency-scan`, qui analyse aussi les devDependencies.

## Pour aller plus loin

- [Analyse du système de fichiers par Trivy](https://trivy.dev/latest/docs/target/filesystem/)
- [Fiche Trivy du projet](../outils/trivy.md)
