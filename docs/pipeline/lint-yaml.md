# Lint YAML

## Objectif

Repérer, avant tout déploiement, les erreurs d'écriture dans les fichiers YAML du projet : indentation incorrecte,
retour à la ligne manquant en fin de fichier, clé dupliquée, valeur ambiguë.

**Définitions**

- **YAML** : format de fichier lisible, fondé sur l'indentation. Les manifestes Kubernetes et la configuration de la pipeline sont écrits en YAML.
- **Linter** : programme qui lit un fichier sans l'exécuter et signale les erreurs et les écarts aux bonnes pratiques.
- **yamllint** : linter open source spécialisé dans les fichiers YAML.
- **Gravité** : importance d'un écart, `error` (bloquant) ou `warning` (affiché sans bloquer).
- **Manifeste** : fichier YAML qui décrit une ressource Kubernetes, comme un déploiement ou un service.

## Ce qui est vérifié

| Règle | Valeur |
|---|---|
| **Ce qui est analysé** | Le dossier `k8s/` (manifestes), le dossier `tests/` (contrôles d'images), `.gitlab-ci.yml` et `.yamllint.yml`. La configuration de la documentation (`mkdocs.yml`) n'en fait pas partie : elle ne fait pas partie de l'application. |
| **Réglages** | Le fichier `.yamllint.yml`, partagé avec la commande locale `make lint-yaml`. |
| **Indentation** | 2 espaces, listes cohérentes dans tout le fichier. |
| **Longueur des lignes** | 160 caractères au maximum, en avertissement : une ligne plus longue ne bloque pas. |
| **Gravité bloquante** | `error` : indentation, clé dupliquée, retour à la ligne final manquant, syntaxe invalide. |
| **Version de l'outil** | yamllint 1.38.0, épinglée dans la pipeline. |

!!! note "À savoir"
    Le fichier `k8s/14-pme-secrets-sealed.yaml` contient des valeurs chiffrées très longues. Elles produisent des
    avertissements de longueur de ligne, normaux et sans effet sur le résultat. Le fichier du realm Keycloak est au
    format JSON : il n'est pas analysé ici.

## Pourquoi ce contrôle

- Une erreur d'indentation dans un manifeste change le sens du fichier, ou provoque un refus de Kubernetes au déploiement.
- Le contrôle est rapide : il ne démarre ni cluster ni conteneur applicatif.
- Il garde les fichiers de configuration homogènes, ce qui facilite leur relecture.

## Quand il se lance

- Sur la branche principale, à chaque pipeline, sans lancement manuel.
- En un seul job `lint:yaml`, indépendant des autres, dans une image Python légère.

## Où voir le résultat

- **Logs du job** `lint:yaml` : une ligne par écart, avec le fichier, la ligne, la colonne, la gravité et le nom de la règle.
- **Statut de la pipeline** : le job échoue dès qu'un écart de gravité `error` subsiste.

## Corriger un écart

1. Lire dans les logs le fichier, la ligne et le nom de la règle.
2. Corriger le fichier. Pour un retour à la ligne final manquant, ajouter une ligne vide en fin de fichier.
3. Vérifier sur son ordinateur avec `make lint-yaml`, puis pousser la correction.

## Pour aller plus loin

- [Documentation de yamllint](https://yamllint.readthedocs.io/)
- [Liste des règles de yamllint](https://yamllint.readthedocs.io/en/stable/rules.html)
