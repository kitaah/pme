# Tests des images Docker

## Objectif

Vérifier que les trois images livrées sont conformes et sûres : elles ne tournent pas en administrateur, ne contiennent
ni secret ni outil de développement, démarrent comme Kubernetes l'attend, et n'embarquent aucune faille grave déjà
corrigeable.

**Définitions**

- **Image Docker** : modèle figé d'une application, à partir duquel Docker crée des conteneurs.
- **container-structure-test** : outil libre de Google qui contrôle le contenu et la configuration d'une image.
- **Trivy** : outil libre qui cherche les failles connues dans les paquets d'une image.
- **Faille (CVE)** : défaut de sécurité public, repéré par un identifiant du type `CVE-2026-00000`.
- **Gravité** : niveau de risque d'une faille. Le projet bloque les niveaux HIGH (élevé) et CRITICAL (critique).
- **Faille corrigeable** : faille pour laquelle l'éditeur a déjà publié un correctif.
- **BuildKit (bake)** : moteur de Docker qui construit plusieurs images en parallèle.

## Ce qui est vérifié

Un seul job construit les trois images, puis les contrôle en deux temps.

**1. Structure de l'image : 24 contrôles**

| Image | Contrôles | Ce qui est vérifié |
|---|---|---|
| **`tests/image/api.yaml`** | 9 | Compte non root, Node 24, application compilée et module commun livré, aucune source ni outil de développement, aucun secret, port 3000. |
| **`tests/image/moderation.yaml`** | 9 | Les mêmes contrôles que l'API, avec le port 3001. |
| **`tests/image/frontend.yaml`** | 6 | Compte non root, configuration nginx valide, site compilé, aucun code source, port 8080. |

Détail des 9 contrôles des images de l'API et de la modération :

- Le compte utilisé n'est pas root (identifiant 1000).
- Node 24 est présent.
- L'application compilée `dist/main.js` existe.
- Le module commun compilé (`@pme/common`) est livré avec l'image.
- Les sources TypeScript sont absentes.
- TypeScript n'est pas installé dans l'image.
- Jest n'est pas installé dans l'image.
- Aucun fichier `.env` n'a été copié.
- Le port, le dossier de travail, la commande de démarrage et `NODE_ENV=production` sont conformes.

Détail des 6 contrôles de l'image de l'interface :

- Le compte utilisé n'est pas root (identifiant 101).
- La configuration de nginx est valide.
- La page `index.html` est présente.
- Le fichier `config.js` est présent. Il est remplacé par le ConfigMap dans le cluster.
- Aucun code source n'est livré.
- Le port 8080 est exposé.

**2. Vulnérabilités : analyse Trivy**

| Règle | Valeur |
|---|---|
| **Gravités bloquantes** | HIGH et CRITICAL |
| **Failles sans correctif** | Ignorées : l'équipe ne peut rien y faire. |
| **Ce qui est analysé** | Les paquets de l'image, pas les secrets ni la configuration. |
| **Exceptions** | Listées dans `.trivyignore`, avec une date d'expiration obligatoire. |
| **Résultat** | Un tableau dans le journal et un rapport JSON par image. |

!!! warning "Attention"
    Une exception du fichier `.trivyignore` cesse de s'appliquer à sa date d'expiration. La pipeline échoue alors de
    nouveau, ce qui oblige l'équipe à revoir la décision. Chaque exception doit être justifiée par un commentaire.

## Quand il se lance

- Sur la branche principale, à chaque pipeline, sans lancement manuel.

Ainsi, chaque commit sur la branche principale produit trois images contrôlées et étiquetées avec le même SHA : le registre
ne garde jamais des images plus anciennes que le code. Ce job est le plus long de la pipeline : environ 1 à 2 minutes avec le
cache de construction rempli, et près de 6 minutes lorsqu'il est vide (voir ci-dessous). Sa limite est fixée à 6 minutes.

## Construction et cache

Les trois images sont construites en parallèle par `docker buildx bake`, avec un constructeur BuildKit qui peut lire et
écrire un cache dans le registre GitLab.

| Élément | Rôle |
|---|---|
| **`docker-bake.hcl`** | Déclare les trois images et, pour chacune, l'emplacement du cache (`cache/api`, `cache/moderation`, `cache/frontend`). |
| **Dépôts `cache/`** | Conservent les couches déjà construites. Ils ne sont pas des images à déployer : ne pas les supprimer. |
| **Étape `prod-deps`** | Dans les Dockerfile de l'API et de la modération, installe uniquement les dépendances de production. Elle ne change que si `package-lock.json` change. |

Une couche n'est reconstruite que si les fichiers qu'elle utilise changent. Tant que `package-lock.json` est identique,
`npm ci` n'est donc pas refait : c'est ce qui fait passer la construction de plusieurs minutes à quelques secondes. Le
premier passage, ou le premier après un changement de dépendances, remplit le cache et reste plus lent. Le cache est
facultatif : s'il est indisponible, la construction se fait quand même, sans lui.

## Publication

Sur la branche principale, si tous les contrôles réussissent, le job publie les trois images dans le registre GitLab.
Voir [Publication des images](publication-images.md).

## Où voir le résultat

- **Journal du job** : la construction, les contrôles de structure, puis un tableau des failles par image.
- **Artefacts du job** : les rapports `trivy-api.json`, `trivy-moderation.json` et `trivy-frontend.json`, conservés une semaine.
- **Statut de la pipeline** : le job échoue si un contrôle échoue ou s'il reste une faille grave non justifiée.

## Fichiers et dossiers principaux

| Fichier ou dossier | Description |
|---|---|
| **`tests/image/api.yaml`** | Décrit les contrôles de l'image de l'API. |
| **`tests/image/moderation.yaml`** | Décrit les contrôles de l'image de la modération. |
| **`tests/image/frontend.yaml`** | Décrit les contrôles de l'image de l'interface. |
| **`docker-bake.hcl`** | Décrit la construction parallèle des trois images et l'emplacement de leur cache dans le registre. |
| **`.trivyignore`** | Liste les failles acceptées temporairement, avec leur expiration. |
| **`api/Dockerfile`** | Fabrique l'image de l'API en trois étapes : dépendances de production, compilation, image finale sans `npm`. Son contexte de construction est la racine du dépôt, car l'image embarque aussi `libs/common`. |
| **`moderation-service/Dockerfile`** | Fabrique l'image de la modération, avec le même contexte et les mêmes étapes. |
| **`frontend/Dockerfile`** | Fabrique l'image de l'interface, dont les paquets système sont mis à jour à la construction. |

## Commandes essentielles

À lancer dans un terminal, depuis le dossier du projet, Docker et Minikube démarrés.

| Commande | Description |
|---|---|
| **`make image`** | Construit les trois images, puis les rend disponibles dans Minikube. |
| **`make image-test`** | Contrôle la structure puis les vulnérabilités des trois images. |
| **`docker buildx bake`** | Construit les trois images en parallèle, comme la pipeline. |

!!! tip "Astuce"
    Pour retarder une faille sans correctif durable, ajouter son identifiant dans `.trivyignore` avec une date
    d'expiration proche et un commentaire. Ne jamais l'ajouter sans date.

!!! note "À savoir"
    Les versions de container-structure-test (1.19.3) et de Trivy (0.71.2) sont fixées. Chaque programme téléchargé est
    vérifié par sa somme de contrôle avant son installation.

!!! note "À savoir"
    **Les failles viennent aussi des images de base.** Trivy a signalé des failles qui ne venaient pas des dépendances du projet :
    des paquets Alpine de l'image nginx (le frontend) et des outils livrés avec l'image Node (`npm`, `corepack`, `yarn`). Les
    corrections sont dans les Dockerfile : mise à jour des paquets système (`apk upgrade`) pour l'interface, et suppression de
    `npm`, `corepack` et `yarn` de l'image finale de l'API et de la modération, où ils ne servent pas à lancer l'application.

!!! warning "Attention"
    Le script du job tourne dans un seul shell : un bloc qui se termine par `exit` arrête tout le script avec succès. Les
    analyses Trivy et la publication ne s'exécutaient alors jamais, alors que le job restait vert. Les blocs utilisent donc
    `test "$status" -eq 0`.

!!! note "À savoir"
    La base de vulnérabilités de Trivy est d'abord téléchargée depuis un miroir d'Amazon. La limite de débit du site
    d'origine faisait échouer des analyses.

## Pour aller plus loin

- [Documentation de container-structure-test](https://github.com/GoogleContainerTools/container-structure-test)
- [Documentation de Trivy](https://trivy.dev/latest/docs/)
- [Fiche container-structure-test du projet](../outils/container-structure-test.md)
- [Fiche Trivy du projet](../outils/trivy.md)
