# NATS

## Fiche d'identité

| Information | Détail |
|---|---|
| **Rôle** | Transmet des messages entre les services de la plateforme, sans en perdre |
| **Version** | NATS 2.14 avec JetStream |
| **Adresse en local** | <http://localhost:8222/jsz> (après `make port-forward`) |

## Description

NATS est un serveur de messagerie libre. Il transmet des messages d'une application à une autre. L'application qui
envoie n'attend pas la réponse de celle qui reçoit. JetStream est la fonction de NATS qui conserve les messages sur
disque. Un message reste dans un flux tant que le destinataire n'a pas confirmé l'avoir traité. Si le destinataire est
arrêté, les messages attendent son retour.

**Définitions**

- **Message** : information envoyée par une application à une autre.
- **JetStream** : fonction de NATS qui conserve les messages sur disque jusqu'à leur traitement.
- **Flux** : espace de NATS où sont rangés les messages en attente.
- **Consommateur** : programme qui lit les messages d'un flux. Il est dit durable quand NATS retient où il en est de sa lecture.
- **Accusé de réception** : confirmation envoyée à NATS une fois le message traité. Le message est alors retiré du flux.

## Rôle dans le projet

- Il fait circuler les événements entre l'API et les autres services.
- Il découple les services : celui qui envoie n'attend pas celui qui reçoit.
- Il conserve les messages tant qu'ils ne sont pas traités, même si le service destinataire est arrêté.
- Sans lui, les services ne pourraient plus échanger d'événements.

## Fichiers et dossiers principaux

| Fichier ou dossier | Description |
|---|---|
| `k8s/02-nats.yaml` | Déploie le serveur NATS dans Minikube. |
| `api/src/listings/nats.client.ts` | Gère la connexion de l'API à NATS. |
| `api/src/listings/listing-events.publisher.ts` | Envoie les événements de l'API. |
| `moderation-service/src/moderation/nats-topology.ts` | Crée les flux et le consommateur au démarrage. |
| `moderation-service/src/moderation/listing-submitted.consumer.ts` | Lit les messages et envoie l'accusé de réception. |

## Commandes essentielles

À lancer dans un terminal, depuis le dossier du projet. `Ctrl+C` arrête une commande en cours.

| Commande | Description |
|---|---|
| `make nats` | Ouvre la page de supervision dans le navigateur. |
| `make queues` | Affiche les flux, les messages en attente et le consommateur. |
| `make demo-stop-moderation` | Arrête le service qui lit les messages : ils restent dans NATS. |
| `make demo-start-moderation` | Relance ce service : les messages en attente sont traités. |
| `make logs-moderation` | Affiche le journal du service de modération, mis à jour en direct. |

## Pour aller plus loin

- [Site officiel de NATS](https://nats.io/)
- [Documentation officielle](https://docs.nats.io/)
- [Documentation de JetStream](https://docs.nats.io/nats-concepts/jetstream)