# container-structure-test

## Fiche d'identité

| Information | Détail |
|---|---|
| **Rôle** | Vérifie qu'une image Docker contient ce qu'elle doit contenir, et rien d'autre, avant sa publication |
| **Version** | container-structure-test 1.19.3 |
| **Adresse en local** | Aucune |

## Description

container-structure-test est un outil open source publié par Google. Il examine une image Docker terminée et contrôle
son contenu ainsi que sa configuration, sans avoir à déployer l'application.

**Ce qu'il contrôle, et que les tests ne voient pas.**
Les tests unitaires et d'intégration portent sur le comportement du code. Ils ne disent rien de l'image qui le
transporte. Or une image peut parfaitement exécuter un code correct tout en étant mal construite : démarrer avec les
droits d'administrateur, embarquer le code source ou un fichier de configuration local, ou exposer un autre port que
celui attendu par Kubernetes. Ces défauts ne se voient qu'une fois l'image déployée, souvent au pire moment.

**Trois familles de contrôles.**

| Famille | Principe | Exemple dans le projet |
|---|---|---|
| **Commande** | Exécute une commande dans l'image et compare sa réponse à celle attendue. | Vérifier que l'application ne s'exécute pas en administrateur. |
| **Fichier** | Vérifie qu'un fichier est présent, ou justement absent. | Vérifier que les sources TypeScript ne sont pas livrées. |
| **Métadonnées** | Lit la configuration de l'image. | Vérifier le port exposé et la commande de démarrage. |

**Vérifier une absence est aussi important.**
La moitié de ces contrôles porte sur ce qui ne doit pas se trouver dans l'image. Une image qui embarque les sources,
les outils de développement ou un fichier d'environnement est plus lourde, et surtout elle offre davantage de prise à
une attaque. Rien dans la construction n'empêche ces fichiers d'y entrer : seul un contrôle explicite le signale.

**Un contrôle rapide, avant l'analyse de sécurité.**
Ces vérifications prennent quelques secondes, alors que l'analyse des failles exige le téléchargement du catalogue
public. Les contrôles de structure passent donc en premier : une image mal construite est rejetée avant que le reste
du travail ne soit engagé.

**Définitions**

| Terme | Définition |
|---|---|
| **Compte non root** | Compte sans droits d'administrateur. Une attaque réussie sur l'application a alors une portée limitée. |
| **Image Docker** | Modèle figé d'une application, à partir duquel Docker crée des conteneurs. |
| **Métadonnées** | Configuration enregistrée dans l'image : port exposé, dossier de travail, commande de démarrage. |
| **Somme de contrôle** | Empreinte d'un fichier, qui permet de vérifier qu'il n'a pas été modifié. |

## Rôle dans le projet

- Il contrôle les trois images avant leur publication, avec une vingtaine de vérifications au total.
- Il garantit qu'aucune image ne s'exécute avec les droits d'administrateur.
- Il garantit qu'aucun secret, aucune source et aucun outil de développement n'est livré.
- Il vérifie que chaque image démarre avec le bon port, la bonne commande et la bonne version de Node.
- Il complète [Trivy](trivy.md), qui examine la sécurité des paquets, là où cet outil examine la construction.
- Sans lui, une image mal construite pourrait être publiée sans que personne ne s'en aperçoive.

Les contrôles sont répartis par image :

| Fichier | Image contrôlée | Points vérifiés |
|---|---|---|
| `tests/image/api.yaml` | API | Compte non root, version de Node, application compilée présente, sources et outils absents, port et commande. |
| `tests/image/moderation.yaml` | Service de modération | Les mêmes points, adaptés à ce service. |
| `tests/image/frontend.yaml` | Interface | Fichiers du site présents, configuration nginx valide, sources absentes, port exposé. |

!!! warning "Attention"
    La version de Node attendue est écrite dans ces fichiers. Après une montée de version, il faut les mettre à jour
    en même temps que les Dockerfile, sans quoi le contrôle échoue alors que l'image est correcte.

## Fichiers et dossiers principaux

| Fichier ou dossier | Description |
|---|---|
| `tests/image/api.yaml` | Décrit les contrôles de l'image de l'API. |
| `tests/image/moderation.yaml` | Décrit les contrôles de l'image du service de modération. |
| `tests/image/frontend.yaml` | Décrit les contrôles de l'image de l'interface. |
| `.gitlab-ci.yml` | Lance ces contrôles avant l'analyse de sécurité et la publication. |
| `Makefile` | Contient la commande de contrôle des images sur l'ordinateur. |

## Commandes essentielles

À lancer dans un terminal, depuis le dossier du projet, Docker et le cluster démarrés.

| Commande | Description |
|---|---|
| `make image` | Construit les trois images à contrôler. |
| `make image-test` | Contrôle la structure des images, puis leurs failles. |
| `container-structure-test test --image pme-api:dev --config tests/image/api.yaml` | Contrôle l'image de l'API seule. |

!!! note "À savoir"
    Dans la pipeline, le programme est téléchargé depuis les publications officielles, dans une version précise, et sa
    somme de contrôle est vérifiée avant son installation.

!!! tip "Astuce"
    Chaque contrôle porte un nom lisible, par exemple « l'application ne tourne pas en root ». En cas d'échec, le
    journal affiche ce nom : il indique directement ce qui manque, sans avoir à ouvrir le fichier de contrôles.

## Pour aller plus loin

- [Dépôt officiel de container-structure-test](https://github.com/GoogleContainerTools/container-structure-test)
- [Fiche Trivy du projet](trivy.md)
- [Page Tests des images Docker](../pipeline/tests-images.md)
