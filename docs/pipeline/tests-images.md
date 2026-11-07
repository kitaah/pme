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

**1. Structure de l'image : 22 contrôles**

| Image | Contrôles | Ce qui est vérifié |
|---|---|---|
| `tests/image/api.yaml` | 8 | Compte non root, Node 24, application compilée, aucune source ni outil de développement, aucun secret, port 3000. |
| `tests/image/moderation.yaml` | 8 | Les mêmes contrôles que l'API, avec le port 3001. |
| `tests/image/frontend.yaml` | 6 | Compte non root, configuration nginx valide, site compilé, aucun code source, port 8080. |

Détail des 8 contrôles des images de l'API et de la modération :

- Le compte utilisé n'est pas root (identifiant 1000).
- Node 24 est présent.
- L'application compilée `dist/main.js` existe.
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

- **Automatiquement** quand une image ou son contrôle change : Dockerfile, `.dockerignore`, `package-lock.json`,
  `frontend/nginx.conf`, `docker-bake.hcl`, `tests/image/`, `.trivyignore` ou `.gitlab-ci.yml`.
- **À la demande** dans les autres cas : le job reste disponible, avec un bouton de lancement manuel.

Ce job est le plus coûteux de la pipeline. Il ne se lance donc que s'il peut trouver quelque chose de nouveau.

## Où voir le résultat

- **Journal du job** : la construction, les contrôles de structure, puis un tableau des failles par image.
- **Artefacts du job** : les rapports `trivy-api.json`, `trivy-moderation.json` et `trivy-frontend.json`, conservés une semaine.
- **Statut de la pipeline** : le job échoue si un contrôle échoue ou s'il reste une faille grave non justifiée.

## Fichiers et dossiers principaux

| Fichier ou dossier | Description |
|---|---|
| `tests/image/api.yaml` | Décrit les contrôles de l'image de l'API. |
| `tests/image/moderation.yaml` | Décrit les contrôles de l'image de la modération. |
| `tests/image/frontend.yaml` | Décrit les contrôles de l'image de l'interface. |
| `docker-bake.hcl` | Décrit la construction parallèle des trois images. |
| `.trivyignore` | Liste les failles acceptées temporairement, avec leur expiration. |
| `api/Dockerfile` | Fabrique l'image de l'API. |
| `moderation-service/Dockerfile` | Fabrique l'image de la modération. |
| `frontend/Dockerfile` | Fabrique l'image de l'interface. |

## Commandes essentielles

À lancer dans un terminal, depuis le dossier du projet, Docker et Minikube démarrés.

| Commande | Description |
|---|---|
| `make image` | Construit les trois images dans Minikube. |
| `make image-test` | Contrôle la structure puis les vulnérabilités des trois images. |
| `docker buildx bake` | Construit les trois images en parallèle, comme la pipeline. |

!!! tip "Astuce"
    Pour retarder une faille sans correctif durable, ajouter son identifiant dans `.trivyignore` avec une date
    d'expiration proche et un commentaire. Ne jamais l'ajouter sans date.

!!! note "À savoir"
    Les versions de container-structure-test (1.19.3) et de Trivy (0.71.2) sont fixées. Chaque programme téléchargé est
    vérifié par sa somme de contrôle avant son installation.

!!! note "À savoir"
    La base de vulnérabilités de Trivy est d'abord téléchargée depuis un miroir d'Amazon. La limite de débit du site
    d'origine faisait échouer des analyses.

## Pour aller plus loin

- [Documentation de container-structure-test](https://github.com/GoogleContainerTools/container-structure-test)
- [Documentation de Trivy](https://trivy.dev/latest/docs/)
- [Fiche container-structure-test du projet](../outils/container-structure-test.md)
- [Fiche Trivy du projet](../outils/trivy.md)
