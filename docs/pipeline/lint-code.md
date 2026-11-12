# Lint du code

## Objectif

Repérer, sans exécuter le programme, les erreurs, les fonctions trop complexes et les écarts de mise en forme dans le
code TypeScript. Le contrôle porte sur les quatre modules du projet : `libs/common`, `api`, `moderation-service` et
`frontend`.

**Définitions**

- **Linter** : programme qui lit un fichier sans l'exécuter et signale les erreurs et les écarts aux bonnes pratiques.
- **ESLint** : linter open source pour JavaScript et TypeScript.
- **Complexité cyclomatique** : nombre de chemins d'exécution indépendants d'une fonction, c'est-à-dire de `if`, de boucles et de choix à suivre. Plus il est élevé, plus la fonction est difficile à tester. Le seuil usuel, dit de McCabe, est de 10.
- **Complexité cognitive** : mesure de l'effort nécessaire pour comprendre une fonction. Elle pénalise surtout les blocs imbriqués. Sonar la définit et fixe son seuil par défaut à 15.
- **TypeScript (`tsc`)** : compilateur de TypeScript. Avec l'option `--noEmit`, il vérifie les types sans produire de fichier.
- **Prettier** : outil qui impose une mise en forme unique du code (guillemets, retours à la ligne, indentation).
- **Matrice (`parallel: matrix`)** : réglage de GitLab qui lance un même job une fois par valeur d'une variable, ici une fois par module.

## Ce qui est vérifié

| Contrôle | Ce qu'il vérifie | Seuil ou règle |
|---|---|---|
| **ESLint** | Règles TypeScript, règles de qualité de Sonar, variables inutilisées. | Toute erreur fait échouer le job. |
| **Complexité cyclomatique** | Nombre de chemins d'exécution par fonction. | **10 au maximum** (`complexity`). |
| **Complexité cognitive** | Lisibilité de chaque fonction. | **15 au maximum** (`sonarjs/cognitive-complexity`). |
| **Taille des fonctions et paramètres** | Fonctions de plus de 60 lignes, plus de 5 paramètres. | Avertissement seulement, il ne bloque pas. |
| **Typage (`tsc --noEmit`)** | Cohérence des types, en mode `strict`. | Toute erreur de type fait échouer le job. |
| **Prettier (`format:check`)** | Mise en forme identique dans tout le code. | Tout fichier mal formaté fait échouer le job. |

Les règles sont dans le fichier `eslint.config.mjs` de chaque module. Les tests (`*.spec.ts`) ont droit à des
fonctions longues, car un bloc `describe` regroupe naturellement beaucoup de cas.

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

## Pour aller plus loin

- [Règle `complexity` d'ESLint](https://eslint.org/docs/latest/rules/complexity)
- [Règle de complexité cognitive de SonarJS](https://sonarsource.github.io/rspec/#/rspec/S3776/javascript)
- [Documentation de Prettier](https://prettier.io/docs/)
