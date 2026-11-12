# NATS

## Fiche d'identité

| Information | Détail |
|---|---|
| **Rôle** | Transmet les événements entre l'API et le service de modération, sans jamais en perdre |
| **Version** | NATS 2.14, avec JetStream |
| **Chiffrement** | TLS 1.3 obligatoire sur le port des applications (4222), en plus du mTLS du maillage [Istio](istio.md) |
| **Adresse en local** | <http://localhost:8222/jsz>, après `make port-forward` |

## Description

NATS est un **serveur de messagerie** open source, aussi appelé **broker**. Son rôle est de transporter des messages
d'une application à une autre, sans que les deux aient besoin de se connaître ni d'être disponibles en même temps.

**Pourquoi un broker ?**
Lorsqu'un membre dépose une annonce, celle-ci doit être relue par le service de modération. L'API pourrait appeler
directement ce service et attendre sa réponse, mais cela créerait deux problèmes : le membre patienterait pendant tout
le traitement, et une panne de la modération empêcherait tout dépôt. Avec un broker, l'API se contente de déposer un
**message** et répond aussitôt au membre. Le service de modération le lira quand il sera disponible. C'est le principe
du **découplage** : chaque composant avance à son rythme.

**JetStream : les messages sont conservés.**
Sans option particulière, NATS ne garde rien : un message publié alors que personne n'écoute est perdu. JetStream est
la fonction qui ajoute la conservation sur disque. Un message reste dans un **flux** tant que son destinataire n'a pas
confirmé l'avoir traité. Si le service de modération est arrêté, les messages patientent et sont traités à son retour.

Le schéma suivant montre le trajet d'un message et ses trois issues possibles.

```d2
vars: {
  d2-config: {
    layout-engine: elk
    theme-id: 5
    pad: 8
  }
}
direction: down

# Mise en forme commune : texte lisible à la largeur de la page, angles arrondis
classes: {
  boite: {
    style: {
      font-size: 24
      border-radius: 12
    }
  }
}

api: "API\npublie l'événement" {class: boite}
flux: "Flux LISTINGS\nmessages en attente" {class: boite}
consommateur: "Service de modération\nlit un message" {class: boite}

traite: "Traité\nmessage retiré du flux" {class: boite}
panne: "Panne passagère\nmessage remis en file" {class: boite}
invalide: "Message invalide\nflux d'échec, gardé 7 jours" {class: boite}

api -> flux
flux -> consommateur
consommateur -> traite
consommateur -> panne
consommateur -> invalide
panne -> flux: nouvelle tentative
```

**Les trois issues d'un message.**
Le service de modération décide lui-même du sort de chaque message, ce qui évite aussi bien les pertes que les boucles
sans fin :

| Issue | Ce qui se passe | Exemple |
|---|---|---|
| **Traité** | Le service confirme la bonne réception, et le message est retiré du flux. | L'annonce est ajoutée à la file de relecture. |
| **Panne passagère** | Le message retourne dans le flux et sera représenté quelques secondes plus tard. | La base de données ne répond pas. |
| **Message invalide** | Le message est copié dans un flux d'échec, puis retiré. Il n'est jamais représenté. | Le contenu du message ne respecte pas le format attendu. |

La distinction est essentielle. Représenter un message invalide donnerait toujours le même résultat et bloquerait la
file. À l'inverse, jeter un message à la première panne ferait perdre une annonce déposée par un membre.

**Une file de travail, et non un journal.**
Le flux principal est configuré en **file de travail** : un message en disparaît dès qu'il est traité. Ce qu'il reste
dans le flux correspond donc, à tout instant, à ce qu'il reste à faire, ce que la commande `make queues` affiche
directement. Une fenêtre de déduplication de deux minutes ignore par ailleurs la republication d'une même annonce.

**Deux ports, deux usages.**
Le port 4222 reçoit les applications ; il est chiffré et exige un identifiant. Le port 8222 est un port de supervision
qui publie l'état du serveur et des flux au format texte. Il reste en HTTP simple : il n'expose aucun message.
Il n'est plus publié par le service du cluster : les autres composants ne le trouvent donc plus par son nom. En
pratique, seuls y accèdent les sondes de Kubernetes, qui s'adressent directement au pod, la commande `make queues`, qui
s'exécute dans le pod, et `make port-forward`, qui ouvre un accès temporaire depuis l'ordinateur. Un pod du maillage
pourrait encore l'appeler par l'adresse du pod, faute de politique réseau, mais l'échange serait alors chiffré par
[Istio](istio.md). NATS n'a pas d'interface web. Le port 4222,
lui, est chiffré deux fois : par le TLS de NATS, puis par le maillage [Istio](istio.md).

**Définitions**

| Terme | Définition |
|---|---|
| **Accusé de réception** | Confirmation envoyée à NATS une fois le message traité. Le message est alors retiré du flux. |
| **Broker** | Serveur qui transporte des messages entre applications. |
| **Consommateur** | Programme qui lit les messages d'un flux. Il est dit **durable** quand NATS retient où il en est. |
| **Découplage** | Organisation dans laquelle deux composants échangent sans dépendre de la disponibilité l'un de l'autre. |
| **Événement** | Message qui annonce un fait déjà survenu, par exemple « une annonce a été déposée ». |
| **File de travail** | Mode de conservation dans lequel un message disparaît du flux dès qu'il est traité. |
| **Flux** | Espace de JetStream où les messages sont conservés sur disque en attendant leur traitement. |
| **Flux d'échec** | Flux séparé qui recueille les messages définitivement inexploitables, pour inspection. |
| **JetStream** | Fonction de NATS qui conserve les messages et gère les accusés de réception. |
| **Message** | Information envoyée par une application à une autre. |
| **Sujet** | Nom qui identifie une catégorie de messages, ici `listing.submitted`. |

## Rôle dans le projet

- Il transporte l'événement « annonce déposée » de l'API vers le service de modération.
- Il découple les deux services : le dépôt d'une annonce reste possible même si la modération est arrêtée, et le membre
  obtient sa réponse sans attendre la relecture.
- Il conserve les messages non traités, ce qui garantit qu'aucune annonce déposée ne passe inaperçue.
- Il permet de faire fonctionner plusieurs exemplaires du service de modération : JetStream répartit les messages, et
  chaque annonce n'est traitée qu'une fois.
- Il isole les messages inexploitables dans un flux d'échec, consultable pendant sept jours.
- Sans lui, l'API devrait appeler la modération directement : toute panne de ce service bloquerait le dépôt d'annonces.

Le serveur est configuré ainsi :

| Réglage | Valeur | Effet |
|---|---|---|
| **Flux principal** | `LISTINGS`, sujet `listing.submitted` | Contient les annonces à relire. |
| **Flux d'échec** | `LISTINGS_DLQ`, conservation de 7 jours | Contient les messages définitivement rejetés. |
| **Consommateur** | `moderation`, durable | NATS retient sa position de lecture entre deux démarrages. |
| **Accusé de réception** | Manuel, attendu sous 30 secondes | Sans confirmation, le message est automatiquement représenté. |
| **Messages remis d'avance** | 10 au maximum | Limite le nombre de messages en cours de traitement par exemplaire. |
| **Déduplication** | 2 minutes | Une même annonce publiée deux fois n'est conservée qu'une fois. |
| **Stockage** | Volume persistant `nats-data` de 1 Go, limite de 768 Mo pour les flux | Les messages survivent au redémarrage du pod. NATS refuse les nouveaux messages avant de remplir le volume. |

!!! note "À savoir"
    NATS garantit qu'un message est remis *au moins une fois* : si l'accusé de réception se perd, le même message
    peut arriver deux fois. Le service de modération le supporte, car rejouer une annonce n'ajoute pas de doublon à sa
    file.

!!! note "À savoir"
    Le stockage des flux est persistant (`PersistentVolumeClaim` `nats-data`, 1 Go), comme pour PostgreSQL. Les
    messages survivent à l'arrêt du service de modération et à la suppression ou au redémarrage du pod NATS.
    Seule la suppression du volume les ferait disparaître, ce que fait `make undeploy` (il supprime le namespace).
    Le serveur est en un seul exemplaire : en production, on déploierait un cluster de trois serveurs, avec réplication
    des flux.

## Fichiers et dossiers principaux

| Fichier ou dossier | Description |
|---|---|
| **`k8s/02-nats.yaml`** | Déploie le serveur NATS dans le cluster, avec JetStream activé. |
| **`k8s/config/nats.conf`** | Configure le chiffrement du serveur et la limite de stockage des flux. |
| **`libs/common/src/nats/`**<br>**`nats.client.ts`** | Gère la connexion au broker, pour l'API comme pour la modération. |
| **`api/src/listings/`**<br>**`listing-events.publisher.ts`** | Publie l'événement « annonce déposée ». |
| **`api/src/listings/listing-events.ts`** | Décrit le contenu de l'événement côté API. La modération en garde sa propre description (`listing-submitted.event.ts`). |
| **`moderation-service/src/moderation/`**<br>**`nats-topology.ts`** | Crée les flux et le consommateur durable au démarrage. |
| **`moderation-service/src/moderation/`**<br>**`listing-submitted.consumer.ts`** | Lit les messages et décide de leur sort. |

## Commandes essentielles

À lancer dans un terminal, depuis le dossier du projet. `Ctrl+C` arrête une commande en cours.

| Commande | Description |
|---|---|
| **`make queues`** | Affiche les flux, le nombre de messages en attente et l'état du consommateur. |
| **`make nats`** | Ouvre la page de supervision dans le navigateur. |
| **`make logs-moderation`** | Affiche le journal du service de modération, mis à jour en direct. |
| **`make demo-stop-moderation`** | Arrête le service qui lit les messages : ils s'accumulent dans le flux. |
| **`make demo-start-moderation`** | Relance ce service : les messages en attente sont traités. |

Pour observer le découplage, l'enchaînement est le suivant :

1. `make demo-stop-moderation` arrête le service de modération.
2. Déposer une annonce depuis l'interface : elle est acceptée normalement.
3. `make queues` montre le message en attente dans le flux.
4. `make demo-start-moderation` relance le service, qui traite aussitôt le message.
5. `make queues` montre un flux de nouveau vide.

Pour observer la persistance, l'enchaînement est le suivant :

1. `make demo-stop-moderation` arrête le service de modération.
2. Déposer une annonce depuis l'interface.
3. `make queues` montre le message en attente.
4. `kubectl -n pme delete pod -l app=nats` supprime le pod NATS, que Kubernetes recrée aussitôt.
5. Une fois le pod de nouveau `Running`, `make queues` montre toujours le message.
6. `make demo-start-moderation` relance le service, qui traite le message.

!!! tip "Astuce"
    Le nombre de messages en attente est l'indicateur à surveiller. Il augmente lorsque la modération est arrêtée ou
    plus lente que les dépôts, et revient à zéro dès qu'elle a rattrapé son retard.

## Pour aller plus loin

- [Site officiel de NATS](https://nats.io/)
- [Documentation de NATS](https://docs.nats.io/)
- [Documentation de JetStream](https://docs.nats.io/nats-concepts/jetstream)
