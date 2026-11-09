# Exigences qualité

## Objectif

Cette page relie chaque exigence de qualité du projet au test qui la prouve et au job qui le lance. Une exigence sans
test n'est pas prouvée. Un test sans exigence n'a pas de raison d'être.

Les exigences viennent du contexte du projet : une plateforme commerciale où les membres échangent des objets, avec une
modération des annonces, une interface fluide et conforme au RGAA, et une sécurité forte. Les attributs de qualité
suivent la norme ISO/IEC 25010.

**Définitions**

- **Exigence** : ce que la plateforme doit garantir, par exemple « une annonce n'est jamais perdue ».
- **Attribut de qualité** : famille d'exigences, comme la sécurité ou la performance.
- **RGAA** : référentiel français d'accessibilité des sites web.
- **ISO/IEC 25010** : norme qui classe les attributs de qualité d'un logiciel.

## Ce qui est vérifié

| Attribut | Exigence | Preuve | Job |
|---|---|---|---|
| **Fiabilité** | Une annonce déposée n'est jamais perdue, même si un service tombe. | 17 tests : reprises, doublons, messages en échec, panne du broker. | `unit-tests:*`, `integration-tests` |
| **Sécurité applicative** | Seul un membre connecté dépose une annonce, seul un modérateur lit la file. | 14 tests : contrôle des rôles, erreurs 401 et 403, jetons invalides. | `unit-tests:*`, `integration-tests` |
| **Robustesse des entrées** | Une annonce invalide est refusée avec une erreur claire. | 5 cas refusés avec une erreur 400. | `integration-tests` |
| **Sécurité des images** | Les images n'ont ni compte root, ni secret, ni outil de développement. | Compte non root, aucun secret, aucune source ni outil de développement dans les 3 images, et Dockerfile conformes aux règles Hadolint. | `image-tests`, `hadolint` |
| **Vulnérabilités** | Aucune faille grave et corrigeable ne part en production, ni dans les outils de build. | Analyse Trivy des 3 images et des dépendances, puis des 3 images d'Istio (blocage sur les failles CRITICAL). | `image-tests`, `dependency-scan`, `istio-scan` |
| **Performance** | 95 % des dépôts d'annonces répondent en moins de 500 ms. | Test de charge k6 avec seuils. | `performance-tests` |
| **Accessibilité (RGAA)** | Les textes et les composants restent lisibles. | 26 contrôles de contraste. | `unit-tests:frontend` |
| **Observabilité** | Les services publient leurs mesures et la supervision trouve le consommateur. | 11 tests. | `unit-tests:*`, `integration-tests` |
| **Déployabilité** | Chaque image démarre comme le déploiement l'attend. | Port, dossier, commande, Node 24, nginx valide. | `image-tests` |
| **Maintenabilité** | Le code est testé, peu dupliqué et sans défaut majeur. | Seuils de couverture et Quality Gate Sonar. | `unit-tests:*`, `sonar` |

!!! note "À savoir"
    Les nombres de tests sont ceux du dépôt à la date de rédaction. La liste complète de chaque famille se trouve dans
    sa page : [unitaires](tests-unitaires.md), [intégration](tests-integration.md), [images](tests-images.md).

## Où les tests se placent dans la pipeline

Du contrôle le plus rapide au plus coûteux :

| Type de test | Outil | Ce qu'il prouve | Nombre |
|---|---|---|---|
| **Unitaire** | Jest, Vitest | Chaque brique fonctionne seule, avec des doublures. | 66 tests |
| **Intégration** | Jest, Testcontainers | Les briques fonctionnent avec une vraie base et un vrai broker. | 27 tests |
| **Image Docker** | container-structure-test, Trivy | L'image livrée est conforme et sans faille grave. | 22 contrôles |
| **Performance** | k6 | L'API tient la charge et respecte ses temps de réponse. | 1 scénario en CI |
| **Qualité du code** | SonarCloud | Le code est lisible, sûr et couvert par les tests. | 1 analyse |

La pyramide est respectée : beaucoup de tests rapides en bas, de moins en moins de tests lents en haut. Un défaut se
trouve ainsi le plus tôt possible, au moindre coût.

## Ce que la pipeline ne prouve pas

- **L'accessibilité complète** : les tests contrôlent les contrastes. Un audit RGAA complet reste un travail manuel.
- **Keycloak sous charge** : c'est un produit tiers. Sa charge se mesure sur l'environnement de recette.
- **L'hébergement en Europe** : c'est un choix d'infrastructure, pas un test.

## Pour aller plus loin

- [Présentation de la norme ISO/IEC 25010](https://iso25000.com/index.php/en/iso-25000-standards/iso-25010)
- [Référentiel RGAA](https://accessibilite.numerique.gouv.fr/)
