# Contrôle des Dockerfile

## Fiche d'identité

| Information | Détail |
|---|---|
| **Rôle** | Repère, avant toute construction, les erreurs et les mauvaises pratiques écrites dans les Dockerfile |
| **Job** | `hadolint` |
| **Outil** | Hadolint 2.14.0 |
| **Déclencheur** | Chaque pipeline, sur la branche principale |

## Description

Le contrôle des Dockerfile repère, avant même de construire une image, les erreurs et les mauvaises pratiques écrites dans un Dockerfile : image de base sans version, exécution avec les droits `root`, commande mal formée, installation de paquets non maîtrisée.

**Le problème qu'il résout.**
Un Dockerfile mal écrit produit une image fragile ou dangereuse, par exemple une image qui tourne en administrateur. Sans contrôle, on ne s'en aperçoit qu'après une construction complète, plusieurs minutes plus tard.

**Comment il fonctionne.**
Hadolint lit le texte de chaque Dockerfile sans rien construire, applique ses règles (et celles de ShellCheck pour les commandes `RUN`), puis affiche chaque écart avec sa gravité. Les écarts `error` et `warning` font échouer le job.

**Définitions**

| Terme | Définition |
|---|---|
| **Dockerfile** | fichier de recettes qui décrit, étape par étape, comment construire une image Docker. |
| **Gravité** | importance d'un écart, parmi `error`, `warning`, `info` et `style`. |
| **Hadolint** | linter open source spécialisé dans les Dockerfile. Il s'appuie aussi sur ShellCheck pour les commandes des instructions `RUN`. |
| **Linter** | programme qui lit un fichier sans l'exécuter et signale les erreurs et les écarts aux bonnes pratiques. |
| **Règle** | contrôle identifié par un code, comme `DL3006` (règle Hadolint) ou `SC2086` (règle ShellCheck). |
| **Somme de contrôle (SHA-256)** | empreinte d'un fichier. Si elle diffère de celle attendue, le fichier a été modifié. |

## Pourquoi en plus des tests des images

| Contrôle | Ce qu'il voit | Ce qu'il ne voit pas |
|---|---|---|
| **Dockerfile (Hadolint)** | Le texte du Dockerfile, avant toute construction. | L'image réellement obtenue. |
| **[Images Docker](tests-images.md)** | L'image construite : utilisateur, fichiers présents, paquets vulnérables. | Les pratiques d'écriture qui n'ont pas d'effet visible dans l'image. |

Hadolint est rapide : il ne démarre pas Docker et ne construit rien. Il signale un défaut en quelques secondes, là où
les tests des images n'interviennent qu'après une construction complète.

## Ce qui est vérifié

| Règle | Valeur |
|---|---|
| **Ce qui est analysé** | Les 4 Dockerfile : `api/Dockerfile`, `moderation-service/Dockerfile`, `frontend/Dockerfile` et `docker/docs/Dockerfile`. |
| **Réglages** | Le fichier `.hadolint.yaml`, partagé avec la commande locale `make lint-docker`. |
| **Gravités bloquantes** | `error` et `warning`. Les gravités `info` et `style` s'affichent sans bloquer. |
| **Version de l'outil** | Hadolint 2.14.0, épinglée dans la pipeline. |
| **Intégrité de l'outil** | Le programme téléchargé est vérifié par sa somme de contrôle avant son utilisation. |

!!! note "À savoir"
    Le fichier `.hadolint.yaml` est partagé entre la pipeline et la commande locale `make lint-docker` : les deux
    appliquent exactement les mêmes règles.

## Quand il se lance

- Sur la branche principale, à chaque pipeline, sans lancement manuel.

## Où voir le résultat

- **Log du job** `hadolint` : une ligne par écart, avec le fichier, la ligne, le code de la règle, sa gravité et une explication.
- **Statut de la pipeline** : le job échoue dès qu'un écart de gravité `warning` ou `error` subsiste.

## Corriger un écart

1. Lire dans le log le fichier, la ligne et le code de la règle.
2. Corriger le Dockerfile, ou consulter l'explication de la règle (voir la liste officielle ci-dessous).
3. Vérifier sur son ordinateur avec `make lint-docker`, puis pousser la correction.

Si un écart est volontaire, il peut être ignoré pour une instruction précise avec un commentaire
`# hadolint ignore=DL3008` placé juste au-dessus, accompagné de sa justification.

!!! warning "Attention"
    Un commentaire `# hadolint ignore=…` masque un écart au lieu de le corriger. Il doit rester rare, viser une
    instruction précise et être justifié par un commentaire.

!!! tip "Astuce"
    Avec Hadolint installé, `make lint-docker` donne le même verdict que la pipeline en quelques secondes, avant l'envoi
    du code.

## Pour aller plus loin

- [Liste des règles de Hadolint](https://github.com/hadolint/hadolint#rules)
- [Fiche Minikube du projet](../outils/minikube.md), qui détaille quelques règles courantes
