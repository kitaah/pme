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
    Le runner de la pipeline est une petite machine partagée. Le profil « ci » est donc plus léger que le profil
    complet. Ses résultats servent de garde-fou contre une régression, pas de mesure de capacité.

!!! note "À savoir"
    k6 envoie toutes ses demandes depuis une seule adresse IP. La limite de débit de l'API est donc relevée pour la
    durée du test.

## Quand il se lance

- Sur la branche principale, à chaque pipeline.

## Où voir le résultat

- **Journal du job** : le résumé de k6, avec chaque seuil marqué réussi ou échoué.
- **Artefacts du job** : `summary.json` (mesures de k6), `api.log` et `environment.log`, conservés une semaine.
- **Statut de la pipeline** : le job échoue, avec le code de sortie 99, si un seuil est dépassé.

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

## Pour aller plus loin

- [Fiche k6 du projet](../outils/k6.md)
- [Documentation de k6](https://grafana.com/docs/k6/latest/)
- [Seuils dans k6](https://grafana.com/docs/k6/latest/using-k6/thresholds/)
