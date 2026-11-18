# RabbitMQ

## Fiche d'identité

| Information | Détail |
|---|---|
| **Rôle** | Seconde solution de messagerie du POC : transmet les événements entre l'API et le service de modération, comme [NATS](nats.md) |
| **Version** | RabbitMQ 4.3, avec le plugin de gestion |
| **Chiffrement** | mTLS du maillage [Istio](istio.md) ; pas de TLS propre à RabbitMQ dans le POC |
| **Adresse en local** | <http://localhost:15672> (interface de gestion), après `make port-forward` puis `make rabbitmq` |
| **Choix du broker** | Variable `BROKER` (`nats` par défaut, ou `rabbitmq`), changée par `make broker-rabbitmq` et `make broker-nats` |

## Description

RabbitMQ est un **broker** de messages open source, le plus répandu en entreprise. Comme [NATS](nats.md), il transporte
des messages d'une application à une autre, sans que les deux aient besoin d'être disponibles en même temps. Le projet
met en œuvre les deux, pour une même fonction : c'est la variable `BROKER` qui désigne celui qu'utilisent l'API et la
modération. Les deux tournent en permanence dans le cluster, et la bascule ne demande aucune reconstruction d'image.

**Pourquoi un broker ?**
Lorsqu'un membre dépose une annonce, celle-ci doit être relue par le service de modération. Avec un broker, l'API se
contente de déposer un **message** et répond aussitôt au membre ; la modération le lit quand elle est disponible. Une
panne de la modération n'empêche donc pas le dépôt. Le raisonnement est détaillé dans la fiche de [NATS](nats.md).

**Le trajet d'un message dans RabbitMQ.**
RabbitMQ ne range pas les messages directement dans une file : l'API les remet à un **échange**, qui les oriente vers
une ou plusieurs **files** selon une **clé de routage**. La modération lit ensuite la file.

```d2
vars: {
  d2-config: {
    layout-engine: elk
    theme-id: 5
    pad: 8
  }
}
direction: down

classes: {
  boite: {
    style: {
      font-size: 24
      border-radius: 12
    }
  }
}

api: "API\npublie l'événement" {class: boite}
echange: "Échange listings\noriente par clé de routage" {class: boite}
file: "File listing.submitted\nmessages en attente" {class: boite}
consommateur: "Service de modération\nlit un message" {class: boite}

traite: "Traité\nmessage retiré de la file" {class: boite}
panne: "Panne passagère\nmessage remis en file" {class: boite}
dlx: "Échange listings.dlx" {class: boite}
dlq: "File listing.submitted.dlq\nmessages rejetés, gardés 7 jours" {class: boite}

api -> echange
echange -> file
file -> consommateur
consommateur -> traite
consommateur -> panne
panne -> file: nouvelle tentative
consommateur -> dlx: message invalide
dlx -> dlq
```

**Les trois issues d'un message.**
Comme avec NATS, le service de modération décide du sort de chaque message :

| Issue | Ce qui se passe | Exemple |
|---|---|---|
| **Traité** | Le service confirme la bonne réception (`ack`), et le message est retiré de la file. | L'annonce est ajoutée à la file de relecture. |
| **Panne passagère** | Le service refuse le message en demandant sa remise en file (`nack` avec remise), après trois secondes. | La base de données ne répond pas. |
| **Message invalide** | Le service refuse le message sans remise : RabbitMQ le renvoie lui-même dans la file des échecs. | Le contenu du message ne respecte pas le format attendu. |

**Ce qui garantit qu'aucune annonce n'est perdue.**

- La file et l'échange sont **durables**, et les messages sont **persistants** : ils sont écrits sur disque et survivent
  au redémarrage du pod.
- Le canal de publication est à **confirmations** : l'API n'obtient sa réponse qu'une fois le message pris en charge par
  RabbitMQ. En cas d'échec, elle réessaie deux fois, avec trois secondes d'attente au plus.
- La modération confirme chaque message **manuellement**, après traitement. Sans confirmation, il est remis.

**La déduplication, différence principale avec NATS.**
NATS ignore un message déjà reçu dans les deux dernières minutes. RabbitMQ n'a pas cette fonction : une publication
rejouée créerait un second message. C'est la modération qui détecte le doublon à la réception, grâce à l'identifiant de
l'annonce, et qui acquitte le second message sans rien ajouter à sa file.

**Une interface de gestion.**
Contrairement à NATS, RabbitMQ fournit une interface web. Elle n'est pas publiée par l'ingress : on l'ouvre sur
l'ordinateur avec `make port-forward` puis `make rabbitmq`. L'onglet **Queues** montre les messages en attente et les
consommateurs de chaque file, et l'onglet **Connections** les connexions de l'API et de la modération. La connexion se
fait avec `RABBITMQ_USER` et `RABBITMQ_PASSWORD` du fichier `.env`.

**Définitions**

| Terme | Définition |
|---|---|
| **Acquittement (`ack`)** | Confirmation envoyée à RabbitMQ une fois le message traité. Le message est alors retiré de la file. |
| **AMQP** | Protocole standard de messagerie utilisé par les applications pour parler à RabbitMQ (port 5672). |
| **Broker** | Serveur qui transporte des messages entre applications. |
| **Clé de routage** | Étiquette portée par un message, que l'échange compare à ses liaisons pour choisir la file, ici `listing.submitted`. |
| **Consommateur** | Programme qui lit les messages d'une file. |
| **Dead letter exchange (DLX)** | Échange vers lequel RabbitMQ renvoie les messages refusés sans remise. Ici `listings.dlx`. |
| **Échange (`exchange`)** | Point d'entrée où l'API dépose ses messages. Il les oriente vers les files, il ne les conserve pas. |
| **File (`queue`)** | Espace où les messages attendent leur traitement. Ici `listing.submitted`. |
| **File des échecs (`DLQ`)** | File qui recueille les messages définitivement inexploitables, pour inspection. Ici `listing.submitted.dlq`. |
| **Persistant** | Message écrit sur disque par RabbitMQ, qui survit à un redémarrage. |
| **Prefetch** | Nombre de messages remis à un consommateur sans attendre d'acquittement, ici 5. |

## Rôle dans le projet

- Il transporte l'événement « annonce déposée » de l'API vers le service de modération, lorsque `BROKER=rabbitmq`.
- Il sert de seconde solution technique de messagerie, comparable à [NATS](nats.md), avec le même contrat de message.
- Il se choisit au démarrage : l'API et la modération contiennent le code des deux brokers, et `make broker-rabbitmq`
  ou `make broker-nats` redémarrent ces deux services avec l'autre valeur.
- Il isole les messages inexploitables dans une file des échecs, consultable pendant sept jours.

Le serveur est configuré ainsi :

| Réglage | Valeur | Effet |
|---|---|---|
| **Échange principal** | `listings` (direct, durable) | Reçoit les messages de l'API. |
| **File principale** | `listing.submitted` (durable) | Contient les annonces à relire. |
| **File des échecs** | `listing.submitted.dlq`, conservation de 7 jours | Contient les messages définitivement rejetés. |
| **Acquittement** | Manuel | Sans confirmation, le message est remis. |
| **Messages remis d'avance** | 5 au maximum | Limite le nombre de messages en cours de traitement par exemplaire. |
| **Stockage** | Volume persistant `rabbitmq-data` de 1 Go | Les messages survivent au redémarrage du pod. |
| **Mémoire** | Limite de 768 Mo | Laisse de la place à l'interface de gestion. |
| **Identifiants** | Secret `pme-secrets` (`rabbitmq-username`, `rabbitmq-password`) | Compte unique utilisé par l'API et la modération. |

!!! note "À savoir"
    Comme NATS, RabbitMQ garantit qu'un message est remis *au moins une fois* : si l'acquittement se perd, le même
    message peut arriver deux fois. Le service de modération le supporte, car rejouer une annonce n'ajoute pas de
    doublon à sa file.

!!! note "À savoir"
    Le serveur est en un seul exemplaire : en production, on déploierait un cluster de trois nœuds avec des files
    répliquées (`quorum queues`). Le nom du nœud est figé (`rabbit@localhost`), car par défaut il contient le nom du
    pod, qui change à chaque recréation : les données du volume deviendraient introuvables.

!!! warning "Attention"
    RabbitMQ n'a pas de TLS propre dans le POC : seul le maillage [Istio](istio.md) chiffre les échanges, et il n'ouvre
    le port 5672 qu'à l'API et à la modération. NATS garde, lui, son TLS applicatif en plus.

## Fichiers et dossiers principaux

| Fichier ou dossier | Description |
|---|---|
| **`k8s/23-rabbitmq.yaml`** | Déploie le serveur RabbitMQ avec son volume et son service. |
| **`libs/common/src/rabbitmq/`**<br>**`rabbitmq.client.ts`** | Gère la connexion et le canal, pour l'API comme pour la modération, avec reprise après coupure. |
| **`libs/common/src/rabbitmq/`**<br>**`listings-topology.ts`** | Déclare l'échange, la file, la file des échecs et leurs liaisons. |
| **`api/src/listings/`**<br>**`rabbitmq-listing-events.publisher.ts`** | Publie l'événement « annonce déposée » dans RabbitMQ. |
| **`api/src/listings/`**<br>**`listing-events.port.ts`** | Interface commune aux deux brokers côté API. |
| **`api/src/listings/`**<br>**`listings.module.ts`** | Choisit le publieur selon `BROKER`. |
| **`moderation-service/src/moderation/`**<br>**`rabbitmq-listing-submitted.consumer.ts`** | Lit les messages de RabbitMQ et décide de leur sort. |
| **`moderation-service/src/moderation/`**<br>**`listing-message-consumer.ts`** | Interface commune aux deux brokers côté modération. |

## Commandes essentielles

À lancer dans un terminal, depuis le dossier du projet.

| Commande | Description |
|---|---|
| **`make broker-rabbitmq`** | Bascule l'API et la modération sur RabbitMQ, sans reconstruire d'image. |
| **`make broker-nats`** | Les rebascule sur NATS. |
| **`make broker`** | Affiche le broker utilisé par l'API et par la modération. |
| **`make queues-rabbitmq`** | Affiche les files, les messages en attente, les messages non acquittés et les consommateurs. |
| **`make rabbitmq`** | Ouvre l'interface de gestion dans le navigateur. Exige `make port-forward`. |
| **`make logs-publish`** | Montre la publication de l'annonce par l'API. |
| **`make logs-receive`** | Montre sa réception par la modération. |
| **`make logs-rabbitmq`** | Suit les logs du serveur RabbitMQ. |
| **`make demo-stop-moderation`** | Arrête la modération : les messages s'accumulent dans la file. |
| **`make demo-start-moderation`** | La relance : les messages en attente sont traités. |

Le déroulé complet de la démonstration est décrit dans la page [Démonstration : NATS et RabbitMQ](../demo-brokers.md).

!!! tip "Astuce"
    Pour prouver que c'est bien RabbitMQ qui travaille, la commande `make broker` doit afficher `rabbitmq` pour les deux
    services, et `kubectl -n pme exec deploy/rabbitmq -- rabbitmqctl list_connections user peer_host state` doit lister
    leurs deux connexions. Les logs de l'API et de la modération sont identiques avec les deux brokers.

## Pour aller plus loin

- [NATS](nats.md), la première solution de messagerie du POC
- [Démonstration : NATS et RabbitMQ](../demo-brokers.md), pour le déroulé et le passage d'une branche à l'autre
- [Istio](istio.md), pour le chiffrement entre pods et les autorisations d'accès
