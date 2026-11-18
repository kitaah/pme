# Démonstration : NATS et RabbitMQ

## Fiche d'identité

| Information | Détail |
|---|---|
| **Rôle** | Montrer que le POC fonctionne avec deux solutions de messagerie interchangeables : NATS JetStream et RabbitMQ |
| **Branche** | `feat/broker-nats-rabbitmq` (le broker se choisit par la variable `BROKER`) |
| **Valeur par défaut** | `nats` : sans réglage, le comportement est celui de la branche `main` |
| **Bascule** | `make broker-nats` et `make broker-rabbitmq`, sans reconstruire d'image (environ 30 secondes) |
| **Chiffrement** | TLS 1.3 sur le port AMQP (5671), en plus du mTLS d'Istio |
| **Vérification** | `make broker`, `make logs-publish`, `make logs-receive`, `make queues`, `make queues-rabbitmq`, `make rabbitmq` (interface web) et le tableau de bord Grafana « NATS et RabbitMQ » |
| **Version** | RabbitMQ 4.3 (`rabbitmq:4.3-management-alpine`) |
| **Préparation** | La veille, une fois : `make image`, `make deploy`, `make redeploy` depuis la branche de démonstration. Le jour J, seulement `make broker-*` |
| **Fichiers concernés** | `k8s/23-rabbitmq.yaml`, `libs/common/src/rabbitmq/`, les modules de l'API et de la modération, le `Makefile` |

## Description

Le POC repose sur un **broker de messages** : un intermédiaire qui reçoit un message d'un service et le conserve
jusqu'à ce qu'un autre service le traite. Ici, quand un membre dépose une annonce, l'API publie un message
`listing.submitted`, et le service de modération le reçoit pour placer l'annonce dans sa file de validation.

**Pourquoi deux brokers.**
Le projet doit mettre en œuvre deux solutions techniques pour une même fonction. NATS JetStream est la solution du
POC ; RabbitMQ est la seconde, la plus répandue en entreprise pour ce besoin. Les deux remplissent le même rôle : le
reste de l'application ne sait pas lequel est utilisé.

**Comment le choix se fait.**
Les deux brokers tournent en permanence dans le cluster. L'API et la modération contiennent le code pour parler aux
deux, et la variable d'environnement `BROKER` désigne celui qu'ils utilisent : `nats` ou `rabbitmq`. Changer de broker
revient à modifier cette variable et à redémarrer les deux services, ce que font les commandes `make broker-nats` et
`make broker-rabbitmq`. Aucune image n'est reconstruite, et le cluster reste en place.

```text
Membre -> API -> [ NATS  ou  RabbitMQ ] -> Service de modération -> base de modération
                   choisi par BROKER
```

**Ce que chaque broker apporte au même scénario.**

- **Livraison garantie :** le message est écrit sur disque avant d'être confirmé à l'API, et il reste conservé si la
  modération est arrêtée.
- **Acquittement :** la modération confirme chaque message traité. Sans confirmation, il est remis plus tard.
- **File des échecs :** un message illisible ou invalide n'est jamais rejoué. Il est mis de côté dans une file dédiée
  (`listing.submitted.dlq`).
- **Doublons :** NATS ignore un message déjà reçu. RabbitMQ n'a pas cette fonction : c'est la modération qui détecte
  le doublon à la réception.

!!! note "À savoir"
    Les messages de logs de l'API et de la modération sont identiques avec les deux brokers. Pour prouver lequel est
    actif, on utilise `make broker` et la connexion visible dans le pod du broker, pas le texte des logs.

## Préparer la démonstration

La préparation se fait **la veille**, pas le jour de la démonstration : elle reconstruit les images et dure plusieurs
minutes. Le cluster Minikube doit être démarré.

### Étape 1 : mettre le cluster en version « deux brokers »

```bash
git checkout feat/broker-nats-rabbitmq
npm ci
cd libs/common && npm run build && cd ../..

make image
make deploy
make redeploy
make pods
```

- `npm ci` installe les dépendances exactes du dépôt, dont `amqplib`, le client RabbitMQ.
- Le build de `libs/common` recompile la bibliothèque partagée par l'API et la modération.
- `make image` construit les images, `make deploy` applique les manifestes (dont `k8s/23-rabbitmq.yaml`) et
  `make redeploy` relance l'API et la modération avec les nouvelles images.
- `make pods` doit montrer `nats`, `rabbitmq`, `pme-api` et `pme-moderation` à l'état `Running`. Le Job
  `keycloak-admin`, à l'état `Completed`, est normal : il est recréé à chaque `make deploy` et se supprime seul au bout
  de cinq minutes.

Le secret `pme-secrets` doit contenir les clés `rabbitmq-username` et `rabbitmq-password`, et le fichier `.env` les
variables `RABBITMQ_USER` et `RABBITMQ_PASSWORD`. Pour le vérifier :

```bash
kubectl -n pme get secret pme-secrets -o jsonpath='{.data}' | grep -o 'rabbitmq-[a-z]*'
```

### Étape 2 : revenir sur `main` si besoin

Le cluster ne dépend pas de la branche Git courante : après `git checkout main`, il garde ses images et ses
manifestes de la branche de démonstration. L'application tourne en NATS par défaut, comme sur `main`. Il n'y a donc
rien à refaire pour la démonstration elle-même.

### Étape 3 : répéter la démonstration

Fais un essai complet avec chaque broker (voir ci-dessous), puis `make smoke`.

!!! warning "Attention"
    Après la préparation, **ne lance ni `make deploy` ni `make redeploy` depuis `main`**. Ils remettraient dans le
    cluster les images et les manifestes de `main`, sans la bascule `BROKER`. Dans ce cas, refais l'étape 1.

!!! tip "Astuce"
    Pour n'appliquer que RabbitMQ, par exemple après un changement de version, sans toucher au reste :
    `kubectl -n pme apply -f k8s/23-rabbitmq.yaml`.

!!! note "À savoir"
    Le premier `make deploy` après la renumérotation des manifestes redémarre aussi PostgreSQL, NATS, Garage, Alloy et
    Keycloak, car les commentaires modifiés changent l'empreinte de leurs ConfigMaps. C'est une raison de plus pour
    préparer la veille.

### Le jour de la démonstration : vérification rapide

Dix minutes avant, depuis n'importe quelle branche :

```bash
make pods
make broker
make queues-rabbitmq
```

`make pods` doit montrer tous les pods `Running`, `make broker` doit répondre `nats` ou `rabbitmq` pour l'API et la
modération, et `make queues-rabbitmq` doit lister la file `listing.submitted`. Si l'une de ces commandes échoue, le
cluster est resté en version `main` : refais l'étape 1, ce qui prend plusieurs minutes.

Vérifie aussi que la collecte des mesures fonctionne, sinon le tableau de bord Grafana sera vide : `make prometheus`
ouvre la page Prometheus, et dans Status > Targets les lignes `nats`, `rabbitmq` et `rabbitmq-queues` doivent être `UP`.

Pour la démonstration, démarre aussi `make port-forward`, qui donne accès à la supervision de NATS (`make nats`). L'interface de RabbitMQ n'en a pas besoin : elle passe par l'ingress.

## Déroulé de la démonstration

### 1. Avec RabbitMQ

```bash
make broker-rabbitmq
make broker
```

`make broker` doit afficher `rabbitmq` pour `pme-api` et `pme-moderation`. Dépose ensuite une annonce depuis
l'application, puis :

```bash
make logs-publish
make logs-receive
make queues-rabbitmq
make db-moderation
kubectl -n pme exec deploy/rabbitmq -- rabbitmqctl list_connections user peer_host state
```

Ce qu'on doit voir :

- `make logs-publish` : `Evenement listing.submitted publie pour l'annonce <id>`, côté API.
- `make logs-receive` : `Consommateur demarre sur la file listing.submitted`, puis
  `Annonce <id> recue de <membre> -> placee dans la file de moderation`, côté modération.
- `make queues-rabbitmq` : la file `listing.submitted` avec un consommateur connecté et zéro message en attente une
  fois l'annonce traitée. La file `listing.submitted.dlq` est vide, sauf en cas de message rejeté.
- `make db-moderation` : l'annonce dans la table `moderation_queue`, avec le même identifiant.
- `list_connections` : deux connexions `running`, celles de l'API et de la modération.

### 2. Avec NATS

```bash
make broker-nats
make broker
```

Dépose une nouvelle annonce, puis :

```bash
make logs-publish
make logs-receive
make queues
make db-moderation
```

`make queues` affiche l'état du flux JetStream `LISTINGS` : messages en attente et consommateur `moderation`.

### 3. Comparer les deux brokers dans Grafana

Avec `make grafana`, ouvre le tableau de bord **« NATS et RabbitMQ »**. Il affiche les deux brokers côte à côte, NATS à
gauche et RabbitMQ à droite, sur les 2 dernières minutes, avec le même contenu de chaque côté :

- **l'état et les connexions** : le broker actif est celui dont le nombre de connexions est supérieur à zéro ;
- **un grand compteur** « messages publiés (2 dernières minutes) » ;
- **une courbe** « messages publiés par seconde », relevée toutes les 5 secondes.

Dépose une annonce : le compteur du broker actif passe de `0` à `1` et la courbe monte pendant quelques secondes, alors
que l'autre côté reste à zéro. Le compteur est le plus lisible devant un jury, parce qu'il garde sa valeur pendant que tu
parles ; la courbe retombe à zéro après quelques secondes (l'unité « ops » veut dire messages par seconde). Cette
comparaison ne dépend pas de l'interface propre à chaque broker.

### 4. Montrer la file des échecs (facultatif)

Arrête la modération pour montrer que les messages sont conservés, puis relance-la :

```bash
make demo-stop-moderation
# déposer une annonce
make queues-rabbitmq        # messages_ready = 1 : le message attend
make demo-start-moderation
make queues-rabbitmq        # messages_ready = 0 : il a été traité
```

### 5. L'interface web de RabbitMQ (facultatif)

```bash
make rabbitmq
```

La page s'ouvre sur `https://rabbitmq.localhost`, servie par l'ingress. La connexion se fait avec `RABBITMQ_USER` et
`RABBITMQ_PASSWORD` du fichier `.env`. Le nom `rabbitmq.localhost` doit figurer dans le fichier `hosts` : relance
`make hosts` et recopie la ligne affichée si besoin. L'onglet **Queues** montre `listing.submitted` (messages en attente, consommateurs) et
`listing.submitted.dlq`, et l'onglet **Connections** les connexions de l'API et de la modération.

!!! note "À savoir"
    Les logs bruts de chaque broker sont disponibles avec `make logs-rabbitmq` et `make logs-nats`.

## La supervision des deux brokers

Le tableau de bord « NATS et RabbitMQ » s'appuie sur trois composants du cluster. Les fiches de
[Prometheus](outils/prometheus.md), de [Grafana](outils/grafana.md) et de [NATS](outils/nats.md) décrivent ces outils tels
qu'ils sont sur `main` : tout ce qui concerne la démonstration est ici.

**Comment les mesures arrivent dans Grafana.**

| Étape | Qui | Détail |
|---|---|---|
| **1. Production** | RabbitMQ | Son plugin `rabbitmq_prometheus`, actif dans l'image, publie ses mesures sur le port 15692. |
| **1. Production** | NATS | NATS ne produit pas de mesures au format de Prometheus. Un conteneur `exporter` (`natsio/prometheus-nats-exporter`), placé dans le même pod, relit la supervision du port 8222 (`/varz` et `/jsz`) et les expose sur le port 7777. Il ne tourne pas en administrateur, n'écrit rien sur le disque et ne parle qu'à NATS. |
| **2. Collecte** | Prometheus | Trois cibles dans `k8s/config/prometheus.yml` : `nats`, `rabbitmq` et `rabbitmq-queues`. Les deux premières sont relevées toutes les 5 secondes (au lieu de 15) pour qu'un seul message se voie en direct. |
| **3. Affichage** | Grafana | Le tableau de bord `k8s/config/grafana-dashboard-broker.json`, chargé avec les autres par le ConfigMap `grafana-dashboards`. |

`rabbitmq-queues` lit le point d'entrée `/metrics/detailed` de RabbitMQ : il donne les compteurs file par file, alors que
le point d'entrée par défaut les additionne.

**Ce que montre le tableau de bord**, sur les 2 dernières minutes, avec le même contenu pour chaque broker :

| Panneau | NATS | RabbitMQ |
|---|---|---|
| **État** | `up{job="nats"}` | `up{job="rabbitmq"}` |
| **Connexions clients** | `gnatsd_varz_connections` | `rabbitmq_connections` |
| **Messages publiés (2 minutes)** | variation de `jetstream_stream_last_seq` | variation de `rabbitmq_channel_messages_published_total` |
| **Messages publiés par seconde** | `rate(jetstream_stream_last_seq[15s])` | `rate(rabbitmq_channel_messages_published_total[15s])` |

Pour NATS, `jetstream_stream_last_seq` est le dernier numéro de message du flux `LISTINGS` : il n'augmente qu'à chaque
publication, sans compter les acquittements du consommateur.

**Fichiers modifiés pour la supervision.**

| Fichier | Description |
|---|---|
| **`k8s/04-nats.yaml`** | Ajoute le conteneur `exporter`, le port 7777 du Service et le volume qui donne à l'exporter le certificat de l'autorité locale (il lit NATS en HTTPS sur `localhost`). |
| **`k8s/23-rabbitmq.yaml`** | Ajoute le port 15692 du conteneur et du Service. |
| **`k8s/config/prometheus.yml`** | Ajoute les trois cibles. |
| **`k8s/config/grafana-dashboard-broker.json`** | Décrit le tableau de bord. |
| **`k8s/kustomization.yaml`** | Ajoute `brokers.json` au ConfigMap des tableaux de bord. |
| **`k8s/21-authorization-policies.yaml`**<br>**`k8s/22-network-policies.yaml`** | Ouvrent les ports 7777 (NATS) et 15692 (RabbitMQ) au seul Prometheus, dans le maillage Istio et dans Calico. |
| **`Makefile`** | `make logs-nats` et `make queues` visent le conteneur `nats`, car le pod en compte maintenant deux. |

**Ressources ajoutées.** L'exporter demande 16 Mo de mémoire (64 Mo au maximum), et RabbitMQ 256 Mo (768 Mo au maximum).
Sur `main`, après un `make deploy`, le tableau de bord et les trois cibles disparaissent, et l'exporter quitte le pod NATS ;
RabbitMQ reste dans le cluster tant qu'on ne le supprime pas.

## Passer de `main` à la branche de démonstration, et inversement

Le cluster Minikube reste démarré dans tous les cas : on ne le recrée jamais pour changer de branche.

Ni `node_modules` ni `libs/common/dist` ne sont suivis par Git. Ils gardent donc l'état de la dernière installation
quand on change de branche, alors que le code, lui, change. Cela ne concerne que le travail en local (IDE, `make api`,
`make moderation`, tests) : le cluster, lui, est piloté par les images et les manifestes déployés.

### De `main` vers la branche de démonstration

Commence toujours par savoir dans quel état est le cluster :

```bash
make broker
```

**Cas 1 : `make broker` répond (`nats` ou `rabbitmq`).** Le cluster est déjà en version « deux brokers », il n'y a rien
à reconstruire ni à redéployer. Pour la démonstration, saute directement à `make broker-rabbitmq`. Les trois commandes
suivantes ne servent que si tu veux travailler en local sur le code de la branche (IDE, `make api`, tests) :

```bash
git checkout feat/broker-nats-rabbitmq
npm ci
cd libs/common && npm run build && cd ../..
```

**Cas 2 : `make broker` échoue.** Le cluster est resté en version `main`. Lance alors toute la séquence, qui prend
plusieurs minutes :

```bash
git checkout feat/broker-nats-rabbitmq
npm ci
cd libs/common && npm run build && cd ../..
make image
make deploy
make redeploy
make pods
```

Ensuite, `make broker` doit répondre.

### De la branche de démonstration vers `main`

Git remet automatiquement les fichiers de `main`, dont les `package.json` et `package-lock.json`. Il reste à remettre
l'environnement local dans l'état de `main` :

```bash
git checkout main
npm ci
cd libs/common && npm run build && cd ../..
```

- `npm ci` réinstalle exactement les dépendances de `main`, donc sans `amqplib`.
- Le build de `libs/common` recompile la bibliothèque sans le code RabbitMQ. Sans cette étape, un `make api` ou
  un `make moderation` en local plante, car l'ancien `dist` cherche encore `amqplib`.
- Le cluster n'est pas concerné : il reste en version « deux brokers », qui se comporte comme `main` tant que `BROKER`
  vaut `nats`.

Pour remettre aussi le cluster dans l'état de `main`, lance `make image`, `make deploy` et `make redeploy` depuis
`main`. Le pod RabbitMQ n'est alors pas supprimé : `kubectl apply` ne retire pas ce qu'un manifeste n'indique plus. Il
reste en marche, sans être utilisé par `main`. Pour le retirer :
`kubectl -n pme delete deploy/rabbitmq svc/rabbitmq pvc/rabbitmq-data`.

### Entre deux démonstrations, sans changer de branche

Pas besoin de `npm ci` ni de reconstruire d'image : `make broker-nats` et `make broker-rabbitmq` suffisent.

!!! warning "Attention"
    Un `make deploy` effectué après une bascule peut relancer les pods de l'API et de la modération. Le broker
    sélectionné par `make broker-*` est conservé, mais vérifie-le toujours avec `make broker` avant de commencer.

## Dépannage

| Symptôme | Cause probable | Solution |
|---|---|---|
| `TS2305: Module '@pme/common' has no exported member 'RabbitMqClient'` (ou `ConsumeMessage`, `LISTING_SUBMITTED_QUEUE`) | La bibliothèque `libs/common/dist` est périmée | `cd libs/common && npm run build && cd ../..`, puis redémarrer le serveur TypeScript de l'IDE |
| Le pod `rabbitmq` ne démarre pas | Clés `rabbitmq-username` et `rabbitmq-password` absentes du secret | `make seal` puis `kubectl apply -n pme -f k8s/01-pme-secrets-sealed.yaml` |
| `make broker` affiche `nats` après `make broker-rabbitmq` | Les deux déploiements n'ont pas été relancés | Relancer `make broker-rabbitmq` et attendre la fin du `rollout status` |
| `make logs-receive` ne renvoie rien | La modération vient de redémarrer, ou aucune annonce n'a été déposée | Déposer une annonce, puis relancer la commande |
| L'interface RabbitMQ affiche `Connections: 0` et `Consumers: 0` | Les services utilisent encore NATS (`BROKER=nats`, valeur par défaut) | `make broker-rabbitmq`, puis `make broker` |
| `rabbitmq.localhost` ne s'ouvre pas | Le nom n'est pas dans le fichier `hosts`, ou le certificat de l'ingress n'a pas été renouvelé | `make hosts` et recopier la ligne ; puis `make deploy` pour que cert-manager réémette le certificat |
| La modération ou l'API affiche une erreur de certificat RabbitMQ | Le pod `rabbitmq` n'a pas son certificat ou l'autorité locale a changé | `kubectl -n pme get certificate rabbitmq-tls`, puis `make mesh-renew` ou `make ca-configmap` si l'autorité a changé |
| Le tableau de bord Grafana affiche `No data` | Prometheus n'a pas chargé les cibles `nats` et `rabbitmq` (fichier `k8s/config/prometheus.yml` ancien, ou `make deploy` non relancé) | `grep -c "job_name" k8s/config/prometheus.yml` doit afficher `6` ; puis `make deploy`, attendre 30 secondes et contrôler `make prometheus` (Status > Targets) |
| Les compteurs du tableau de bord restent à `0` après une annonce | Le broker actif n'est pas celui que l'on regarde, ou la cible est `DOWN` | `make broker` pour connaître le broker actif, puis Status > Targets dans `make prometheus` |
| `ImagePullBackOff` sur le pod `rabbitmq` | Le tag `rabbitmq:4.3-management-alpine` n'a pas pu être téléchargé | `kubectl -n pme describe pod -l app=rabbitmq`, puis passer au tag `4.2-management-alpine` dans `k8s/23-rabbitmq.yaml` |
| Le pod `rabbitmq` ne démarre pas après un changement de version | Le volume `rabbitmq-data` contient les données de l'ancienne série | Supprimer le déploiement puis le volume : `kubectl -n pme delete deploy/rabbitmq pvc/rabbitmq-data`, puis `make deploy` (les messages de démonstration sont perdus) |
| La modération affiche `RabbitMQ injoignable (tentative n/20)` | Le pod RabbitMQ n'est pas encore prêt | Attendre : elle réessaie toutes les 3 secondes pendant une minute |

## Limites

- Prometheus ne garde les mesures que 6 heures : le tableau de bord ne montre rien d'avant, et les compteurs repartent de
  zéro si Prometheus redémarre.
- Le choix du broker (`BROKER`) et le consommateur RabbitMQ ont des tests unitaires. Le publieur RabbitMQ et les
  **tests d'intégration** (Testcontainers) ne couvrent que NATS : RabbitMQ n'y est pas testé de bout en bout.
- RabbitMQ ne vérifie pas de certificat client (comme NATS) : l'authentification repose sur l'identifiant et le mot de
  passe. Après un renouvellement du certificat (90 jours), le pod doit être redémarré.
- L'interface de gestion de RabbitMQ est protégée par le compte RabbitMQ, pas par Keycloak.