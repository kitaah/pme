# opossum

## Fiche d'identité

| Information | Détail |
|---|---|
| **Rôle** | Protège l'API quand PostgreSQL est indisponible, grâce à un disjoncteur |
| **Version** | opossum 9 |
| **Adresse en local** | aucune |

## Description

Un disjoncteur (circuit breaker) fonctionne comme celui d'une installation électrique. Tant que tout va bien, il laisse
passer le courant. Quand les pannes s'accumulent, il coupe le circuit pour éviter d'aggraver le problème. Puis il
laisse passer un seul appel d'essai pour savoir si le service est revenu.

opossum est la bibliothèque Node.js qui fournit ce mécanisme. Le projet Spring utilise Resilience4j pour le même usage.

**Définitions**

- **Circuit fermé** : fonctionnement normal, les appels passent.
- **Circuit ouvert** : les appels échouent aussitôt, sans solliciter la base.
- **Circuit semi-ouvert** : un appel d'essai est autorisé pour tester le retour du service.
- **Erreur 503** : réponse HTTP « service indisponible », au format RFC 9457 dans l'API.

## Rôle dans le projet

- Il entoure tous les appels de l'API à PostgreSQL : dépôt d'une annonce et lecture des annonces du membre.
- Base en panne, le circuit s'ouvre après 5 appels dont la moitié échoue. Le membre reçoit alors un 503 en quelques
  millisecondes, au lieu d'attendre le délai de connexion.
- Tant que le circuit est fermé, un appel qui échoue renvoie déjà un 503, jamais une erreur 500 opaque.
- Chaque pod de l'API a son propre circuit : ils s'ouvrent séparément.
- Le circuit se referme seul quand la base revient : un appel d'essai est tenté toutes les 10 secondes.
- Il ne réagit qu'aux pannes. Une erreur de données, comme une contrainte violée, ne l'ouvre pas.
- Sans lui, chaque requête resterait bloquée jusqu'à 3 secondes et saturerait l'API pendant la panne.

## Réglages

| Réglage | Valeur | Effet |
|---|---|---|
| **Délai d'un appel** | 3 secondes | Un appel plus long compte comme un échec. |
| **Volume minimal** | 5 appels | Le circuit n'est évalué qu'à partir de ce nombre d'appels. |
| **Seuil d'échecs** | 50 % | À partir de cette part d'échecs, le circuit s'ouvre. |
| **Pause avant essai** | 10 secondes | Durée pendant laquelle le circuit reste ouvert. |

## Observer l'état

L'API publie la mesure `circuit_breaker_state{name="postgresql"}` pour Prometheus.

| Valeur | Etat |
|---|---|
| 0 | Fermé |
| 1 | Semi-ouvert |
| 2 | Ouvert |

## Protocole de vérification

La commande `make breaker-test` déroule le protocole sur le cluster Minikube. Elle remet toujours la base en service,
même si elle est interrompue.

1. **Etat initial** : l'API répond 200 et le circuit est fermé (0).
2. **Coupure** : la base est arrêtée. Des appels sont envoyés jusqu'à l'ouverture du circuit (2).
3. **Circuit ouvert** : un appel reçoit un 503 en moins d'une seconde.
4. **Remise en service** : la base est relancée. L'API répond de nouveau 200 et le circuit se referme (0).

La commande `make demo-breaker` fait la même coupure sans vérification : elle affiche seulement le code, la durée et
l'état du circuit à chaque appel. Elle sert à montrer le mécanisme.

!!! warning "Attention"
    Ces commandes coupent PostgreSQL pendant une à deux minutes. À lancer sur le cluster de démonstration, jamais
    pendant un test de charge.

## Fichiers et dossiers principaux

| Fichier ou dossier | Description |
|---|---|
| `api/src/common/database-circuit-breaker.ts` | Contient le disjoncteur, ses réglages et sa mesure. |
| `api/src/listings/listings.service.ts` | Fait passer les appels à la base par le disjoncteur. |
| `api/src/listings/listings.module.ts` | Crée le disjoncteur et publie sa mesure. |
| `scripts/verify-breaker.sh` | Déroule le protocole de vérification, avec résultats OK ou ECHEC. |
| `scripts/demo-breaker.sh` | Montre le disjoncteur en action, sans vérification. |

## Commandes essentielles

| Commande | Description |
|---|---|
| `make breaker-test` | Coupe PostgreSQL, vérifie le circuit, remet la base. |
| `make demo-breaker` | Montre le circuit s'ouvrir puis se refermer. |
| `cd api && npm install` | Installe les dépendances de l'API, opossum compris. |

## Pour aller plus loin

- [Dépôt officiel d'opossum](https://github.com/nodeshift/opossum)
- [Le patron Circuit Breaker](https://martinfowler.com/bliki/CircuitBreaker.html)
- [Fiche PostgreSQL du projet](postgresql.md)
