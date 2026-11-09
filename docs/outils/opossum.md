# opossum

## Fiche d'identité

| Information | Détail |
|---|---|
| **Rôle** | Protège l'API lorsque PostgreSQL ne répond plus, en coupant les appels au lieu de les laisser s'accumuler |
| **Version** | opossum 9 |
| **Adresse en local** | Aucune |

## Description

opossum est une bibliothèque open source qui fournit un **disjoncteur**, en anglais *circuit breaker*. C'est un
mécanisme de résilience : il ne répare pas la panne, il empêche ses conséquences de se propager.

**Le problème : une panne qui se propage.**
Lorsqu'une base de données ne répond plus, chaque demande qui lui est adressée reste en attente jusqu'à expiration du
délai, trois secondes ici. Pendant ce temps, l'API mobilise de la mémoire et des connexions pour une demande qui est
déjà perdue. Les demandes s'accumulent, l'API ralentit, puis cesse de répondre à son tour, y compris pour les
opérations qui n'ont pas besoin de la base. Une panne limitée à un composant finit ainsi par arrêter toute la
plateforme.

**La solution : couper rapidement.**
Le disjoncteur fonctionne comme celui d'une installation électrique. Tant que tout va bien, il laisse passer. Quand
les échecs s'accumulent, il coupe : les demandes suivantes échouent immédiatement, sans même solliciter la base. Le
membre reçoit une réponse claire en quelques millisecondes — « le service est momentanément indisponible » — au lieu
d'attendre trois secondes pour le même résultat. Après une pause, le disjoncteur laisse passer un seul appel d'essai
pour savoir si la base est revenue.

```d2
vars: {
  d2-config: {
    layout-engine: elk
    theme-id: 5
    pad: 8
  }
}
# Mise en forme commune : texte lisible à la largeur de la page, angles arrondis
classes: {
  boite: {
    style: {
      font-size: 24
      border-radius: 12
    }
  }
}

# Les trois états, dans l'ordre où ils se succèdent
etats: "" {
  grid-columns: 3
  style.opacity: 0

  ferme: "1. Circuit fermé" {
    grid-rows: 2
    class: boite
    quoi: "Les appels atteignent la base" {class: boite}
    membre: "Le membre reçoit sa réponse" {class: boite}
  }

  ouvert: "2. Circuit ouvert" {
    grid-rows: 2
    class: boite
    quoi: "Trop d'échecs :\nla base n'est plus sollicitée" {class: boite}
    membre: "Erreur 503 immédiate" {class: boite}
  }

  semi: "3. Circuit semi-ouvert" {
    grid-rows: 2
    class: boite
    quoi: "Après 10 secondes,\nun appel d'essai" {class: boite}
    membre: "Essai réussi : retour à 1\nEssai échoué : retour à 2" {class: boite}
  }
}
```

**Toutes les erreurs ne se valent pas.**
Le disjoncteur ne réagit qu'aux pannes : base injoignable, connexion refusée, délai dépassé. Une erreur de données,
comme une contrainte violée ou une requête mal formée, ne l'ouvre pas : la base a répondu, elle fonctionne donc
normalement. Sans cette distinction, quelques saisies invalides suffiraient à couper l'accès à une base en parfait
état.

**Un disjoncteur par exemplaire.**
Chaque pod de l'API possède son propre disjoncteur, avec son propre décompte. Ils s'ouvrent donc séparément. Pour que
le membre reçoive malgré tout une réponse cohérente, un appel qui échoue alors que le circuit est encore fermé renvoie
déjà une erreur 503, et non une erreur 500 : le code de réponse ne dépend pas du pod qui a reçu la demande.

**Définitions**

| Terme | Définition |
|---|---|
| **Circuit fermé** | Fonctionnement normal : les appels atteignent la base. |
| **Circuit ouvert** | Les appels échouent aussitôt, sans solliciter la base. |
| **Circuit semi-ouvert** | Un seul appel d'essai est autorisé, pour vérifier si le service est revenu. |
| **Disjoncteur** | Mécanisme qui interrompt les appels vers un service en panne, puis teste périodiquement son retour. |
| **Erreur 503** | Réponse HTTP « service momentanément indisponible », au format Problem Details dans l'API. |
| **Résilience** | Capacité d'un système à continuer de fonctionner, même en mode dégradé, pendant une panne partielle. |

## Rôle dans le projet

- Il entoure tous les appels de l'API à PostgreSQL : dépôt d'une annonce et consultation des annonces du membre.
- Il transforme une attente de trois secondes en une réponse immédiate dès que la base est en panne, ce qui évite la
  saturation de l'API.
- Il renvoie toujours la même erreur au membre, que le circuit soit ouvert ou que l'appel vienne d'échouer.
- Il se referme seul lorsque la base revient : aucune intervention ni redémarrage n'est nécessaire.
- Il publie son état sous forme de mesure, ce qui rend la coupure visible dans [Grafana](grafana.md).
- Sans lui, une panne de la base rendrait toute l'API inutilisable pendant plusieurs minutes, au lieu de dégrader
  seulement les fonctions qui en dépendent.

Ses réglages sont les suivants :

| Réglage | Valeur | Effet |
|---|---|---|
| **Délai d'un appel** | 3 secondes | Au-delà, l'appel est compté comme un échec. |
| **Volume minimal** | 5 appels | En dessous, le disjoncteur ne se prononce pas : quelques échecs isolés ne coupent rien. |
| **Seuil d'échecs** | 50 % | À partir de cette proportion d'échecs, le circuit s'ouvre. |
| **Pause avant essai** | 10 secondes | Durée pendant laquelle le circuit reste ouvert avant l'appel d'essai. |

L'état du circuit est publié dans la mesure `circuit_breaker_state{name="postgresql"}`, lue par
[Prometheus](prometheus.md) :

| Valeur | État |
|---|---|
| **0** | Fermé |
| **1** | Semi-ouvert |
| **2** | Ouvert |

!!! note "À savoir"
    Ce mécanisme correspond à celui que la bibliothèque Resilience4j assure dans le monde Java. Le projet initial, écrit
    avec Spring Boot, l'utilisait au même endroit : opossum en est l'équivalent pour Node.

## Fichiers et dossiers principaux

| Fichier ou dossier | Description |
|---|---|
| **`api/src/common/`**<br>**`database-circuit-breaker.ts`** | Contient le disjoncteur, ses réglages et sa mesure. |
| **`api/src/listings/listings.service.ts`** | Fait passer par le disjoncteur tous les appels à la base. |
| **`api/src/listings/listings.module.ts`** | Crée le disjoncteur et publie sa mesure. |

## Commandes essentielles

À lancer dans un terminal, depuis le dossier du projet, la plateforme déployée.

| Commande | Description |
|---|---|
| **`make logs-api`** | Affiche le journal de l'API, où chaque échec d'appel à la base est tracé. |

Lors d'une panne de PostgreSQL, le circuit se comporte ainsi :

1. **État initial** : l'API répond 200 et le circuit est fermé.
2. **Coupure** : la base est arrêtée, puis des appels sont envoyés jusqu'à l'ouverture du circuit.
3. **Circuit ouvert** : un appel reçoit une erreur 503 en moins d'une seconde.
4. **Remise en service** : la base est relancée, l'API répond de nouveau 200 et le circuit se referme.

!!! tip "Astuce"
    `make pods` confirme que PostgreSQL est prêt, et `make logs-api` montre chaque échec d'appel à la base.

## Pour aller plus loin

- [Dépôt officiel d'opossum](https://github.com/nodeshift/opossum)
- [Le patron Circuit Breaker, par Martin Fowler](https://martinfowler.com/bliki/CircuitBreaker.html)
- [Fiche PostgreSQL du projet](postgresql.md)
