# Exigences qualité

## Fiche d'identité

| Information | Détail |
|---|---|
| **Rôle** | Relie chaque exigence de qualité du projet au test qui la prouve et au job qui le lance |
| **Jobs concernés** | Tous les jobs de la pipeline |
| **Référence** | Norme ISO/IEC 25010 pour les attributs de qualité |
| **Déclencheur** | Chaque pipeline, sur la branche principale |

## Description

Cette page relie chaque exigence de qualité du projet au test qui la prouve et au job qui le lance. Les exigences viennent du contexte du projet : une plateforme commerciale où les membres échangent des objets, avec une modération des annonces, une interface fluide et conforme au RGAA, et une sécurité forte. Les attributs de qualité suivent la norme ISO/IEC 25010.

**Le problème qu'elle résout.**
Une exigence sans test n'est pas prouvée, et un test sans exigence n'a pas de raison d'être. Cette page évite les deux : chaque ligne du tableau « Ce qui est vérifié » désigne ce que la plateforme promet, la preuve et le job qui la rejoue à chaque modification.

**Comment la lire.**
Le tableau associe chaque attribut de qualité à une exigence, à sa preuve (un test ou un contrôle) et au job qui l'exécute. Les nombres renvoient aux pages détaillées de chaque famille de tests.

**Définitions**

| Terme | Définition |
|---|---|
| **Attribut de qualité** | famille d'exigences, comme la sécurité ou la performance. |
| **Exigence** | ce que la plateforme doit garantir, par exemple « une annonce n'est jamais perdue ». |
| **ISO/IEC 25010** | norme qui classe les attributs de qualité d'un logiciel. |
| **RGAA** | référentiel français d'accessibilité des sites web. |

## Ce qui est vérifié

| Attribut | Exigence | Preuve | Job |
|---|---|---|---|
| **Fiabilité** | Une annonce déposée n'est jamais perdue, même si un service tombe. | 53 tests unitaires (consommateur, contrat de l'événement, file de modération, publication, topologie et client NATS) : reprises, doublons, messages en échec, panne du broker. | `unit-tests:*`, `integration-tests` |
| **Sécurité applicative** | Seul un membre connecté dépose une annonce, seul un modérateur lit la file. | 14 tests du module commun (jeton, rôles, décorateurs), complétés en intégration par les erreurs 401 et 403. | `unit-tests:*`, `integration-tests` |
| **Robustesse des entrées** | Une annonce invalide est refusée avec une erreur claire. | 52 tests du DTO, 14 tests du stockage des photos (fichier non image refusé en 415, réduction, ré-encodage), et 5 cas refusés avec une erreur 400 en intégration. | `integration-tests` |
| **Sécurité des images** | Les images n'ont ni compte root, ni secret, ni outil de développement. | Compte non root, aucun secret, aucune source ni outil de développement dans les 3 images, et Dockerfile conformes aux règles Hadolint. | `image-tests`, `hadolint` |
| **Vulnérabilités** | Aucune faille grave et corrigeable ne part en production, ni dans les outils de build. | Analyse Trivy des 3 images et des dépendances, puis des 3 images d'Istio (blocage sur les failles CRITICAL). | `image-tests`, `dependency-scan`, `istio-scan` |
| **Performance** | 95 % des dépôts d'annonces répondent en moins de 500 ms. | Test de charge k6 avec seuils. | `performance-tests` |
| **Accessibilité (RGAA)** | Les textes et les composants restent lisibles. | 39 contrôles de contraste. | `unit-tests:frontend` |
| **Observabilité** | Les services publient leurs mesures et la supervision trouve le consommateur. | 12 tests unitaires (mesures et sondes de santé), et le test du consommateur durable en intégration. | `unit-tests:*`, `integration-tests` |
| **Déployabilité** | Chaque image démarre comme le déploiement l'attend. | Port, dossier, commande, Node 24, nginx valide. | `image-tests` |
| **Maintenabilité** | Le code est testé, peu dupliqué, sans défaut majeur et sans fonction trop complexe. | Seuils de couverture à 100 %, code commun mutualisé dans `libs/common`, Quality Gate Sonar, complexité cyclomatique de 10 au plus et cognitive de 15 au plus (ESLint), typage strict, mise en forme unique (Prettier), fichiers YAML valides (yamllint). | `unit-tests:*`, `sonar`, `lint:code`, `lint:yaml` |

!!! note "À savoir"
    Les nombres de tests sont ceux du dépôt à la date de rédaction. La liste complète de chaque famille se trouve dans
    sa page : [unitaires](tests-unitaires.md), [intégration](tests-integration.md), [images](tests-images.md).

## Où les tests se placent dans la pipeline

Du contrôle le plus rapide au plus coûteux :

| Type de test | Outil | Ce qu'il prouve | Nombre |
|---|---|---|---|
| **Unitaire** | Jest, Vitest | Chaque brique fonctionne seule, avec des doublures. | 393 tests |
| **Intégration** | Jest, Testcontainers | Les briques fonctionnent avec une vraie base et un vrai broker. | 35 tests |
| **Image Docker** | container-structure-test, Trivy | L'image livrée est conforme et sans faille grave. | 24 contrôles |
| **Performance** | k6 | L'API tient la charge et respecte ses temps de réponse. | 1 scénario en CI |
| **Lint YAML** | yamllint | Les fichiers de configuration sont bien écrits. | 1 job |
| **Lint du code** | ESLint, tsc, Prettier | Le code respecte les règles, les seuils de complexité et le typage. | 4 jobs, un par module |
| **Qualité du code** | SonarCloud | Le code est lisible, sûr et couvert par les tests. | 1 analyse |

La pyramide est respectée : beaucoup de tests rapides en bas, de moins en moins de tests lents en haut. Un défaut se
trouve ainsi le plus tôt possible, au moindre coût.

## Ce que la pipeline ne prouve pas

- **L'accessibilité complète** : les tests contrôlent les contrastes. Un audit RGAA complet reste un travail manuel.
- **Keycloak sous charge** : c'est un produit tiers. Sa charge se mesure sur l'environnement de recette.
- **L'hébergement en Europe** : c'est un choix d'infrastructure, pas un test.

!!! warning "Attention"
    Les nombres de cette page sont écrits à la main. Quand un test est ajouté ou retiré, mettre à jour cette page et la
    page de la famille concernée ([unitaires](tests-unitaires.md), [intégration](tests-integration.md),
    [images](tests-images.md)) : sinon la preuve annoncée ne correspond plus au dépôt.

!!! tip "Astuce"
    Pour contrôler une ligne du tableau, ouvrir la page de la famille de tests correspondante : chaque test y est décrit,
    et la colonne « Job » indique où lire son résultat dans GitLab.

## Pour aller plus loin

- [Présentation de la norme ISO/IEC 25010](https://iso25000.com/index.php/en/iso-25000-standards/iso-25010)
- [Référentiel RGAA](https://accessibilite.numerique.gouv.fr/)
