# container-structure-test

## Fiche d'identité

| Information | Détail |
|---|---|
| **Rôle** | Contrôle le contenu et la configuration d'une image Docker avant sa livraison |
| **Version** | container-structure-test 1.19.3 |
| **Adresse en local** | aucune |

## Description

container-structure-test est un outil libre de Google. Il vérifie qu'une image Docker contient ce qu'elle doit contenir,
et rien d'autre. Les contrôles s'écrivent dans un fichier YAML. L'outil peut lancer une commande dans l'image, tester
l'existence d'un fichier et lire la configuration de l'image, comme son port ou sa commande de démarrage.

**Définitions**

- **Image Docker** : modèle figé d'une application, à partir duquel Docker crée des conteneurs.
- **Test de commande** : lance une commande dans l'image et compare sa réponse à celle attendue.
- **Test de fichier** : vérifie qu'un fichier existe ou n'existe pas dans l'image.
- **Test de métadonnées** : vérifie la configuration de l'image : port, dossier de travail, commande, variables.
- **Compte non root** : compte sans droits d'administrateur. S'il est piraté, l'attaquant peut moins agir.

## Rôle dans le projet

- Il contrôle les trois images avec 22 vérifications.
- Il garantit que les images ne tournent pas en administrateur.
- Il garantit qu'aucun secret, aucune source et aucun outil de développement n'est livré.
- Il vérifie que chaque image démarre avec le bon port, la bonne commande et la bonne version de Node.
- Sans lui, une image mal construite pourrait partir en production sans que personne le voie.

## Fichiers et dossiers principaux

| Fichier ou dossier | Description |
|---|---|
| `tests/image/api.yaml` | Décrit les 8 contrôles de l'image de l'API. |
| `tests/image/moderation.yaml` | Décrit les 8 contrôles de l'image de la modération. |
| `tests/image/frontend.yaml` | Décrit les 6 contrôles de l'image de l'interface. |
| `.gitlab-ci.yml` | Définit l'exécution des contrôles dans le job `image-tests`. |
| `Makefile` | Contient la commande de contrôle des images sur le poste. |

## Commandes essentielles

À lancer dans un terminal, depuis le dossier du projet, Docker et Minikube démarrés.

| Commande | Description |
|---|---|
| `make image` | Construit les images à contrôler. |
| `make image-test` | Contrôle la structure puis les failles des trois images. |
| `container-structure-test test --image pme-api:dev --config tests/image/api.yaml` | Contrôle l'image de l'API seule. |

!!! warning "Attention"
    Le contrôle de version de Node est écrit dans les fichiers de `tests/image`. Après une montée de version de Node,
    mettre à jour ces fichiers en même temps que les Dockerfile.

!!! note "À savoir"
    Dans la pipeline, le programme est téléchargé depuis les publications officielles sur GitHub. Sa somme de contrôle
    est vérifiée avant son installation.

## Pour aller plus loin

- [Dépôt officiel de container-structure-test](https://github.com/GoogleContainerTools/container-structure-test)
- [Fiche Trivy du projet](trivy.md)
- [Page Tests des images Docker](../pipeline/tests-images.md)
