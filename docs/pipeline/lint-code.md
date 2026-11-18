# Lint du code

## Fiche d'identité

| Information | Détail |
|---|---|
| **Rôle** | Repère, sans exécuter le programme, les erreurs, les fonctions trop complexes et les écarts de mise en forme du code TypeScript |
| **Job** | `lint:code`, en 4 exécutions parallèles : une par module |
| **Outils** | ESLint, `tsc` (TypeScript) et Prettier |
| **Déclencheur** | Chaque pipeline, sur la branche principale |

## Description

Le lint du code repère, sans exécuter le programme, les erreurs, les fonctions trop complexes et les écarts de mise en forme dans le code TypeScript. Le contrôle porte sur les quatre modules du projet : `libs/common`, `api`, `moderation-service` et `frontend`.

**Le problème qu'il résout.**
Une fonction trop complexe est difficile à lire, à tester et à corriger, et un code mis en forme de dix façons différentes est pénible à relire. Les tests ne le voient pas : le code fonctionne, mais il devient coûteux à maintenir. Le lint bloque ces écarts dès qu'ils apparaissent, avec la fonction et la ligne en cause.

**Comment il fonctionne.**
Pour chaque module, le job lance ESLint, puis le compilateur TypeScript en mode vérification (`tsc --noEmit`), puis Prettier en lecture seule (`format:check`). Une erreur dans l'un de ces contrôles fait échouer le job du module concerné.

**Définitions**

| Terme | Définition |
|---|---|
| **Complexité cognitive** | mesure de l'effort nécessaire pour comprendre une fonction. Elle pénalise surtout les blocs imbriqués. Sonar la définit et fixe son seuil par défaut à 15. |
| **Complexité cyclomatique** | nombre de chemins d'exécution indépendants d'une fonction, c'est-à-dire de `if`, de boucles et de choix à suivre. Plus il est élevé, plus la fonction est difficile à tester. Le seuil usuel, dit de McCabe, est de 10. |
| **ESLint** | linter open source pour JavaScript et TypeScript. |
| **Linter** | programme qui lit un fichier sans l'exécuter et signale les erreurs et les écarts aux bonnes pratiques. |
| **Matrice (`parallel: matrix`)** | réglage de GitLab qui lance un même job une fois par valeur d'une variable, ici une fois par module. |
| **Prettier** | outil qui impose une mise en forme unique du code (guillemets, retours à la ligne, indentation). |
| **TypeScript (`tsc`)** | compilateur de TypeScript. Avec l'option `--noEmit`, il vérifie les types sans produire de fichier. |

## Ce qui est vérifié

| Contrôle | Ce qu'il vérifie | Seuil ou règle |
|---|---|---|
| **ESLint** | Règles TypeScript, règles de qualité de Sonar, variables inutilisées. | Toute erreur fait échouer le job. |
| **Complexité cyclomatique** | Nombre de chemins d'exécution par fonction. | **10 au maximum** (`complexity`). |
| **Complexité cognitive** | Lisibilité de chaque fonction. | **15 au maximum** (`sonarjs/cognitive-complexity`). |
| **Taille des fonctions et paramètres** | Plus de 5 paramètres (tous les modules) ; fonctions de plus de 60 lignes (API, modération et module commun, pas l'interface). | Avertissement seulement, il ne bloque pas. |
| **Typage (`tsc --noEmit`)** | Cohérence des types, en mode `strict`. | Toute erreur de type fait échouer le job. |
| **Prettier (`format:check`)** | Mise en forme identique dans tout le code. | Tout fichier mal formaté fait échouer le job. |

Les règles sont dans le fichier `eslint.config.mjs` de chaque module. Les tests (`*.spec.ts`) ont droit à des
fonctions longues, car un bloc `describe` regroupe naturellement beaucoup de cas.

!!! note "À savoir"
    Les règles de taille (plus de 60 lignes par fonction, plus de 5 paramètres) sont de simples avertissements : elles
    s'affichent dans le log sans faire échouer le job. Seuls les seuils de complexité, le typage et la mise en forme
    bloquent.

## Pourquoi en plus de SonarCloud

| Contrôle | Ce qu'il apporte |
|---|---|
| **ESLint** | Un seuil écrit dans le dépôt (10 par fonction) et un échec immédiat, avec la fonction et la ligne en cause. |
| **[SonarCloud](analyse-sonarcloud.md)** | Une vue globale : bugs, failles, duplication, couverture, dette technique. |

Les deux se complètent. ESLint bloque une fonction trop complexe dès qu'elle apparaît ; Sonar note la qualité de l'ensemble.

## Quand il se lance

- Sur la branche principale, à chaque pipeline, sans lancement manuel.
- En 4 jobs `lint:code` parallèles, un par module, indépendants des autres jobs de la pipeline.

## Où voir le résultat

- **Logs du job** `lint:code` : une ligne par écart, avec le fichier, la ligne, la règle et son explication.
- **Statut de la pipeline** : le job du module concerné devient rouge dès qu'une règle bloquante est enfreinte.

## Corriger un écart

1. Repérer dans les logs le module, le fichier, la ligne et la règle.
2. Pour une complexité trop élevée, découper la fonction en fonctions plus petites.
3. Pour la mise en forme, lancer `npm run format` dans le module : Prettier corrige les fichiers.
4. Vérifier sur son ordinateur avec `make lint` et `make format-check`, puis pousser la correction.

!!! warning "Attention"
    Ne pas contourner une règle de complexité avec un commentaire `eslint-disable` pour faire passer le job : la fonction
    reste aussi difficile à lire, l'écart est seulement masqué. Il faut la découper.

!!! tip "Astuce"
    `make lint` et `make format-check` exécutent en local les mêmes contrôles que `lint:code` sur les quatre modules :
    les lancer avant l'envoi du code évite un aller-retour avec la pipeline.

## Pour aller plus loin

- [Règle `complexity` d'ESLint](https://eslint.org/docs/latest/rules/complexity)
- [Règle de complexité cognitive de SonarJS](https://sonarsource.github.io/rspec/#/rspec/S3776/javascript)
- [Documentation de Prettier](https://prettier.io/docs/)
