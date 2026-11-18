# Tests de performance

## Fiche d'identité

| Information | Détail |
|---|---|
| **Rôle** | Vérifie que l'API reste rapide et fiable quand plusieurs utilisateurs s'en servent en même temps |
| **Job** | `performance-tests` |
| **Outil** | k6 1.4.0 |
| **Déclencheur** | Chaque pipeline, sur la branche principale |
| **Seuil principal** | 95 % des dépôts d'annonce répondent en moins de 500 ms |

## Description

Les tests de performance vérifient que l'API reste rapide et fiable quand plusieurs utilisateurs s'en servent en même temps. Le test échoue si un seuil de temps de réponse ou d'erreurs est dépassé : il peut donc bloquer une pipeline.

**Le problème qu'ils résolvent.**
Un test fonctionnel vérifie qu'une réponse est correcte, pas qu'elle arrive vite quand plusieurs personnes demandent en même temps. Sans test de charge, une lenteur n'apparaît qu'en situation réelle.

**Comment ils fonctionnent.**
k6 simule des utilisateurs virtuels qui déposent des annonces et lisent leur liste, puis compare les temps de réponse et le taux d'erreurs à des seuils. Si un seuil est dépassé, le job échoue.

**Définitions**

| Terme | Définition |
|---|---|
| **Faux fournisseur d'identité** | petit serveur local qui signe un jeton de test à la place de Keycloak. |
| **Percentile 95** | durée en dessous de laquelle se situent 95 % des réponses. |
| **Seuil** | limite à ne pas dépasser. Si elle est dépassée, k6 signale un échec. |
| **Test de charge** | test qui envoie beaucoup de demandes à une application pour vérifier qu'elle reste rapide. |
| **Utilisateur virtuel** | utilisateur simulé par k6, qui répète un scénario en boucle. |

## Ce qui est vérifié

Chaque utilisateur virtuel dépose une annonce, attend une seconde, lit la liste de ses annonces, puis attend encore une
seconde. Le scénario recommence tant que le test dure.

Le dépôt est envoyé en JSON, sans photo : le test mesure le parcours texte (validation, base, événement), pas le traitement de
l'image ni l'envoi vers [Garage](../outils/garage.md), qui seront plus coûteux.

**Contrôles du scénario**

| Contrôle | Attendu |
|---|---|
| **Dépôt d'une annonce** | Réponse 201, avec le statut « en attente de validation ». |
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
| **complet** | 20 | 1 minute 45 | Profil par défaut de k6, non utilisé par la pipeline. |

Les deux profils utilisent le même scénario et les mêmes seuils.

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
    Le test s'adresse directement à l'API, sans passer par Traefik : ses mesures n'incluent donc ni le contrôle du jeton
    de l'ingress ni le déchiffrement HTTPS.

!!! note "À savoir"
    Le runner de la pipeline est une petite machine partagée. Le profil « ci » est donc plus léger que le profil
    complet. Ses résultats servent de garde-fou contre une régression, pas de mesure de capacité.

!!! note "À savoir"
    k6 envoie toutes ses demandes depuis une seule adresse IP. La limite de débit de l'API est donc relevée pour la
    durée du test.

## Quand il se lance

- Sur la branche principale, à chaque pipeline.

## Où voir le résultat

- **Log du job** : le résumé de k6, avec chaque seuil marqué réussi ou échoué.
- **Artefacts du job** : `summary.json` (mesures de k6), `api.log` et `environment.log`, conservés une semaine.
- **Statut de la pipeline** : le job échoue, avec le code de sortie 99, si un seuil est dépassé.
- **En cas d'échec avant ou pendant le test** (service injoignable, identifiants refusés, API qui ne démarre pas) : le log du job affiche la fin de `environment.log` (faux Keycloak et flux NATS), puis celle de `api.log`.

!!! warning "Attention"
    Le jeton de test n'est jamais publié dans les artefacts.

## Fichiers et dossiers principaux

| Fichier ou dossier | Description |
|---|---|
| **`tests/performance/load.js`** | Scénario de charge : profils, contrôles et seuils. |
| **`tests/performance/common.js`** | Fonctions partagées : connexion, dépôt et lecture des annonces. |
| **`tests/performance/support/`**<br>**`ci-environment.cjs`** | Faux fournisseur d'identité et création du flux NATS. |
| **`scripts/perf-ci.sh`** | Orchestre le test dans la pipeline : API, jeton, k6. |
| **`.gitlab-ci.yml`** | Définit le job `performance-tests` et ses services. |

## Commandes essentielles

À lancer depuis le dossier du projet, Docker démarré et k6 installé.

| Commande | Description |
|---|---|
| **`make test-perf`** | Rejoue le job `performance-tests` : PostgreSQL et NATS jetables, API réelle, profil « ci ». |

Les résultats sont écrits dans `perf-results/` (`summary.json`, `api.log`). Les conteneurs sont supprimés à la fin, même si un seuil est dépassé.

!!! tip "Astuce"
    Avant de pousser un changement qui touche le dépôt d'annonce, `make test-perf` rejoue le job en local : un seuil
    dépassé se découvre alors sans attendre la pipeline.

## Pour aller plus loin

- [Fiche k6 du projet](../outils/k6.md)
- [Documentation de k6](https://grafana.com/docs/k6/latest/)
- [Seuils dans k6](https://grafana.com/docs/k6/latest/using-k6/thresholds/)
