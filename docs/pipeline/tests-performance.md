# Tests de performance

## Objectif

Vérifier que l'API reste rapide et fiable quand plusieurs utilisateurs s'en servent en même temps. Le test échoue si un
seuil de temps de réponse ou d'erreurs est dépassé : il peut donc bloquer une pipeline.

**Définitions**

- **Test de charge** : test qui envoie beaucoup de demandes à une application pour vérifier qu'elle reste rapide.
- **Utilisateur virtuel** : utilisateur simulé par k6, qui répète un scénario en boucle.
- **Seuil** : limite à ne pas dépasser. Si elle est dépassée, k6 signale un échec.
- **Percentile 95** : durée en dessous de laquelle se situent 95 % des réponses.
- **Faux fournisseur d'identité** : petit serveur local qui signe un jeton de test à la place de Keycloak.

## Ce qui est vérifié

Chaque utilisateur virtuel dépose une annonce, attend une seconde, lit la liste de ses annonces, puis attend encore une
seconde. Le scénario recommence tant que le test dure.

**Contrôles du scénario**

| Contrôle | Attendu |
|---|---|
| **Dépôt d'une annonce** | Réponse 201, avec le statut « en attente de modération ». |
| **Lecture de mes annonces** | Réponse 200. |

**Seuils**

| Mesure | Seuil |
|---|---|
| **Erreurs HTTP** | Moins de 1 %. |
| **Dépôt d'annonce, percentile 95** | Moins de 500 ms. |
| **Lecture de mes annonces, percentile 95** | Moins de 500 ms. |
| **Contrôles réussis** | Plus de 99 %. |

**Profils de charge**

| Profil | Utilisateurs | Durée | Où |
|---|---|---|---|
| **ci** | 10 | 1 minute | Dans la pipeline, sur l'API démarrée dans le job. |
| **complet** | 20 | 1 minute 45 | Sur le cluster Minikube déployé. |

Les deux profils utilisent le même scénario et les mêmes seuils.

**Preuve du découplage**

Un second scénario prouve que le dépôt d'une annonce ne dépend pas du service de modération. Il est lancé deux fois,
avec 5 utilisateurs pendant 30 secondes : une fois avec la modération en marche, une fois avec la modération arrêtée.
Les seuils sont les mêmes. Ce scénario tourne sur le cluster, pas dans la pipeline.

## Comment la pipeline s'y prend

Le job démarre l'API réelle avec les vrais services dont elle dépend, sans Docker ni Keycloak.

1. PostgreSQL et NATS démarrent comme services de GitLab.
2. Le script construit l'API.
3. Un faux fournisseur d'identité signe un jeton de test. Il crée aussi le flux NATS, comme le fait la modération.
4. L'API démarre et signale qu'elle est prête.
5. k6 lance le scénario avec le profil « ci » et écrit son résumé.

!!! note "À savoir"
    L'API vérifie toujours la signature, l'émetteur et le client du jeton. Seul le serveur qui signe est remplacé.
    Keycloak est un produit tiers : sa charge se mesure sur l'environnement de recette.

!!! note "À savoir"
    Le runner de la pipeline est une petite machine partagée. Le profil « ci » est donc plus léger que le profil
    complet. Ses résultats servent de garde-fou contre une régression, pas de mesure de capacité.

!!! note "À savoir"
    k6 envoie toutes ses demandes depuis une seule adresse IP. La limite de débit de l'API est donc relevée pour la
    durée du test.

## Quand il se lance

- Sur la branche principale, quand `.gitlab-ci.yml`, l'API, les scénarios k6 ou `scripts/perf-ci.sh` changent.
- Un changement de l'interface seule ne le lance pas.

## Où voir le résultat

- **Journal du job** : le résumé de k6, avec chaque seuil marqué réussi ou échoué.
- **Artefacts du job** : `summary.json` (mesures de k6), `api.log` et `environment.log`, conservés une semaine.
- **Statut de la pipeline** : le job échoue, avec le code de sortie 99, si un seuil est dépassé.

!!! warning "Attention"
    Le jeton de test n'est jamais publié dans les artefacts.

## Fichiers et dossiers principaux

| Fichier ou dossier | Description |
|---|---|
| `tests/performance/load.js` | Scénario de charge : profils, contrôles et seuils. |
| `tests/performance/decoupling.js` | Scénario qui prouve l'indépendance entre le dépôt et la modération. |
| `tests/performance/common.js` | Fonctions partagées : connexion, dépôt et lecture des annonces. |
| `tests/performance/support/ci-environment.cjs` | Faux fournisseur d'identité et création du flux NATS. |
| `scripts/perf-ci.sh` | Orchestre le test dans la pipeline : API, jeton, k6. |
| `scripts/perf-decoupling.sh` | Lance le scénario de découplage avec puis sans la modération. |
| `.gitlab-ci.yml` | Définit le job `performance-tests` et ses services. |

## Commandes essentielles

À lancer dans un terminal, depuis le dossier du projet.

| Commande | Description |
|---|---|
| `make k6-install` | Installe k6 sur Debian, Ubuntu ou Linux Mint. |
| `make perf-prepare` | Relève la limite de débit de l'API avant le test sur le cluster. |
| `make perf-load` | Lance le test de charge complet sur le cluster. |
| `make perf-decoupling` | Lance la preuve du découplage. |
| `make perf` | Lance les deux tests à la suite. |
| `make perf-reset` | Remet la limite de débit normale. |

!!! warning "Attention"
    Toujours lancer `make perf-reset` après un test sur le cluster. Sans cela, l'API n'est plus protégée contre les abus.

## Pour aller plus loin

- [Fiche k6 du projet](../outils/k6.md)
- [Documentation de k6](https://grafana.com/docs/k6/latest/)
- [Seuils dans k6](https://grafana.com/docs/k6/latest/using-k6/thresholds/)
