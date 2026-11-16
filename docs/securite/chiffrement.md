# Chiffrement des échanges

## Fiche d'identité

| Information | Détail |
|---|---|
| **Rôle** | Rend illisible et infalsifiable tout ce qui circule, du navigateur jusqu'à la base de données |
| **Outils** | [cert-manager](../outils/cert-manager.md) 1.18.2, autorité de certification locale ; [Istio](../outils/istio.md) 1.30.0, maillage en mode ambient |
| **Portée externe** | HTTPS sur les sept noms d'hôte, HTTP redirigé vers HTTPS, en-tête HSTS de sept jours |
| **Portée interne** | mTLS entre tous les pods du namespace `pme` et de l'ingress par [Istio](../outils/istio.md), autorisation par identité de chaque appel, puis TLS jusqu'à PostgreSQL et jusqu'à NATS, avec vérification du nom du serveur |
| **Certificats** | Clés ECDSA P-256, valables 90 jours, renouvelées 15 jours avant l'échéance |

## Description

Chiffrer une communication, c'est la rendre illisible à quiconque l'intercepte. **TLS**, le protocole derrière le « s »
de HTTPS, fait deux choses à la fois : il chiffre les échanges, et il prouve au client qu'il parle bien au serveur
qu'il croit, grâce à un **certificat**.

**Le problème : un réseau n'est jamais de confiance.**
Sans chiffrement, un mot de passe, un jeton ou le contenu d'une annonce circulent en clair : toute machine placée sur le
chemin peut les lire, et même les modifier au passage. On pense souvent que cela ne concerne que l'Internet, mais le
réseau interne d'un cluster pose le même problème : un conteneur compromis y voit passer le trafic des autres.

**La chaîne de confiance.**
Un certificat n'a de valeur que parce qu'une **autorité de certification** l'a signé, et que le client fait confiance à
cette autorité. Le projet crée sa propre autorité locale : cert-manager génère une clé privée d'autorité, valable dix
ans, puis signe avec elle tous les certificats du cluster. Le navigateur, lui, ne connaît pas cette autorité : il faut
la lui présenter une fois, avec `make ca-cert`. En entreprise, seul l'émetteur changerait, pour l'autorité interne de
l'organisation ou une autorité publique.

**Où s'arrête le chiffrement externe.**
Le TLS du site se termine à l'ingress : c'est lui qui présente le certificat au navigateur et déchiffre la requête. Il
la transmet ensuite en HTTP simple au service concerné, à l'intérieur du cluster. Ce choix est courant. Le trajet
interne reste protégé : [Istio](../outils/istio.md), en mode ambient, chiffre en mTLS chaque connexion entre l'ingress
et les services, et refuse toute connexion qui ne vient pas du maillage. Les applications n'en savent rien : elles
parlent toujours en HTTP, et c'est un proxy installé sur le nœud (ztunnel) qui chiffre le trajet.

**Qui peut appeler quoi.**
Le mTLS donne à chaque pod une identité vérifiée : celle de son compte de service. Le projet s'en sert pour filtrer. Un
premier réglage refuse tout appel entre pods, puis une règle par composant nomme ses seuls appelants. Exemple : seuls
l'API, le service de modération, Keycloak, Grafana et Adminer peuvent joindre PostgreSQL. Un pod qui connaîtrait le mot
de passe de la base mais n'aurait pas la bonne identité est coupé avant même d'ouvrir la connexion. `make authz-check`
le vérifie. Des politiques réseau, appliquées par [Calico](../outils/calico.md), répètent ce filtrage au niveau du réseau du cluster
(tableau dans [Durcissement](durcissement.md)) : un appel doit passer par les deux. `make netpol-check` vérifie ce second filtre.

**Pourquoi les bases de données font exception.**
Les échanges avec PostgreSQL et NATS, eux, sont chiffrés de bout en bout par les applications elles-mêmes, même à
l'intérieur du cluster. C'est là que circulent les mots de passe de connexion et l'intégralité des données : le gain
est réel, et le coût nul. Le maillage enveloppe ces connexions d'une seconde couche, sans les remplacer : la
vérification du nom du serveur, que seule l'application peut faire, est conservée.

**Deux autorités distinctes.**
Les certificats du maillage ne viennent pas de cert-manager. Le plan de contrôle d'Istio, istiod, émet les siens, de
courte durée, et les renouvelle seul. L'autorité locale de cert-manager reste réservée au certificat public de
l'ingress et à ceux de PostgreSQL et de NATS.

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

chaine: "" {
  grid-rows: 4
  grid-gap: 8
  style.opacity: 0

  navigateur: "1. Navigateur" {class: boite}
  https: "2. Ingress — HTTPS, le chiffrement s'arrête ici" {class: boite}
  services: "3. API et modération — HTTP, chiffré par le maillage (mTLS)" {class: boite}
  donnees: "4. PostgreSQL et NATS — TLS, nom du serveur vérifié" {class: boite}
}
```

**Définitions**

| Terme | Définition |
|---|---|
| **Autorité de certification** | Entité qui signe des certificats. Un client ne fait confiance à un certificat que s'il fait confiance à son autorité. |
| **Certificat** | Document qui associe un nom de serveur à une clé publique, et que signe une autorité. |
| **ECDSA** | Famille d'algorithmes de signature à courbes elliptiques : des clés plus courtes que RSA, pour une sécurité équivalente. |
| **mTLS** | TLS mutuel : le client et le serveur présentent chacun un certificat. C'est le mode du maillage Istio. |
| **HSTS** | En-tête de réponse qui demande au navigateur de n'utiliser que HTTPS pour un site pendant une durée donnée. |
| **SCRAM-SHA-256** | Méthode d'authentification de PostgreSQL qui ne fait jamais circuler le mot de passe, même chiffré. |
| **Terminaison TLS** | Endroit où le chiffrement s'arrête et où la requête redevient lisible. |
| **TLS** | Protocole qui chiffre une communication et authentifie le serveur. Le « s » de HTTPS. |
| **verify-full** | Niveau de vérification le plus strict : le certificat doit être signé par une autorité connue **et** émis pour le nom demandé. |

## Ce qui est en place

**Côté navigateur**

| Mesure | Détail |
|---|---|
| **HTTPS sur tous les noms** | Un certificat unique couvre les sept noms d'hôte de l'ingress. |
| **Redirection du HTTP** | Une requête en HTTP est redirigée vers HTTPS, elle n'est jamais servie en clair. |
| **En-tête HSTS** | Pendant sept jours, le navigateur qui a déjà visité un nom n'utilise plus que HTTPS, même si l'adresse saisie commence par `http://`. |
| **Renouvellement automatique** | cert-manager renouvelle 15 jours avant l'échéance, sans intervention. |
| **Rotation de la clé** | Une nouvelle clé privée est générée à chaque renouvellement, et non réutilisée. |

**Côté services internes**

| Échange | Protection |
|---|---|
| **Entre pods** | mTLS par le maillage Istio : chaque connexion est chiffrée et chaque pod porte une identité. Le mode strict refuse toute connexion qui n'arrive pas en mTLS, par exemple celle d'un pod placé hors du maillage. Les politiques d'autorisation refusent ensuite tout appel dont l'identité n'est pas listée pour le composant visé. |
| **Vers PostgreSQL** | TLS obligatoire côté serveur : les règles d'accès n'acceptent que des connexions chiffrées, et le mot de passe est contrôlé par SCRAM-SHA-256, qui ne le fait jamais circuler. |
| **Vers NATS** | TLS, avec une version minimale fixée à **1.3**. Sans ce réglage, le serveur accepterait encore TLS 1.2. Le port de supervision (8222) est servi en HTTPS avec le même certificat. |
| **Vers Garage** | Garage n'a pas de TLS propre : l'écriture des photos par l'API passe dans le tunnel mTLS du maillage, et seuls l'API et l'ingress sont autorisés (identité et étiquette). La lecture par le navigateur, elle, arrive en HTTPS sur `garage.localhost`, par une adresse signée. |
| **Vérification du nom** | L'API, le service de modération, Keycloak et Grafana vérifient que le certificat présenté a bien été émis pour le serveur qu'ils appellent, et non seulement qu'il est signé par l'autorité. |

Le point important du côté de PostgreSQL est que l'obligation est **posée par le serveur**, et non laissée à la
discrétion des clients. Le fichier de règles d'accès fourni par l'image accepte les connexions TCP en clair ; le projet
le remplace par le sien, qui n'autorise que les connexions chiffrées depuis le reste du cluster, et qui limite chaque compte de service à sa propre base (voir [PostgreSQL](../outils/postgresql.md)). Une application mal
configurée n'obtient donc pas une connexion en clair : elle est refusée.

Trois exceptions figurent dans ces règles, toutes internes au pod : la socket Unix, utilisée par l'initialisation de
l'image, et la boucle locale en IPv4 et IPv6, utilisée par les sondes de Kubernetes. Dans un pod, cette boucle locale
n'est joignable que depuis le pod lui-même.

!!! note "À savoir"
    Les certificats de PostgreSQL et de NATS ne servent qu'à authentifier le **serveur**. Les clients, eux, ne
    présentent pas de certificat à ces serveurs : ils s'identifient par leur mot de passe. L'authentification mutuelle
    existe en revanche entre les pods, au niveau du maillage. Elle est vérifiée dans les logs de ztunnel, où chaque
    connexion porte l'identité de sa source et de sa destination (voir les commandes de vérification).

## Ce qui n'est pas couvert

- **L'autorité est locale** : son certificat doit être importé une fois dans le navigateur, sans quoi celui-ci affiche
  un avertissement. C'est le fonctionnement attendu, et non un défaut : un navigateur qui ferait confiance à une
  autorité inconnue serait le vrai problème.
- **L'autorité du maillage est créée par istiod lui-même** : sa clé privée est stockée dans le cluster, dans le
  namespace `istio-system`. C'est acceptable pour un POC ; en production, on brancherait l'autorité interne de
  l'organisation.
- **Les filtres ne regardent que les connexions entrantes, au niveau de la connexion** : les politiques d'autorisation
  d'Istio, appliquées par ztunnel, et les politiques réseau de Calico vérifient la source, la destination et le port,
  mais pas la méthode ni le chemin d'une requête HTTP. Aucun des deux ne filtre les connexions sortantes des pods.
- **Le maillage dépend d'un réglage de l'ordinateur** : ztunnel plante si la limite `inotify` du système est trop
  basse. `make inotify` la relève, avec le mot de passe `sudo`. Sans ztunnel prêt, un namespace déjà enrôlé en mode
  strict devient inaccessible (voir la fiche [Istio](../outils/istio.md)).
- **Le certificat du port de supervision de NATS n'est pas vérifié par `make queues`** : la commande lit ce port
  depuis le pod, sur sa boucle locale, avec `wget`, qui ne connaît pas l'autorité locale. Les sondes de Kubernetes ne
  le vérifient pas non plus. Le certificat se vérifie depuis l'ordinateur, après `make port-forward`, avec `curl` et
  la CA locale.
- **HSTS de courte durée, sans prechargement** : la durée est de sept jours, et non d'un an. Un HSTS actif interdit de
  passer outre l'alerte du certificat : après un changement d'autorité locale, le navigateur bloque le site tant qu'il
  retient la règle. La toute première visite d'un navigateur reste servie par la redirection, faute de liste de
  préchargement. En production, la durée serait portée à un an.

## Commandes de vérification

À lancer dans un terminal, depuis le dossier du projet, la plateforme déployée.

| Commande | Description |
|---|---|
| **`make ca-cert`** | Écrit le certificat de l'autorité locale, à importer dans le navigateur. |
| **`kubectl -n pme get certificate`** | Affiche les certificats du cluster, leur état et leur validité. |
| **`make ca-configmap`** | Copie l'autorité dans le namespace, pour que les applications vérifient les certificats. |
| **`make mesh-check`** | Vérifie le maillage : un pod hors du maillage est refusé, et les échanges portent des identités. |
| **`make authz-check`** | Vérifie les autorisations par identité : un appel autorisé aboutit, un appel non prévu est coupé. |
| **`make netpol-check`** | Vérifie les politiques réseau : un pod sans l'étiquette prévue est coupé, même s'il a la bonne identité. |
| **`curl --cacert pme-ca.crt`**<br>**`https://localhost:8222/healthz`** | Vérifie le certificat du port de supervision de NATS, après `make port-forward`. Le fichier `pme-ca.crt` est écrit par `make ca-cert`. |
| **`kubectl -n istio-system logs ds/ztunnel`**<br>**`--tail=500 \| grep src.identity`** | Affiche les connexions chiffrées vues par ztunnel, avec l'identité de la source et de la destination. |

Dans les logs de ztunnel, une connexion chiffrée par le maillage se reconnaît à deux indices : l'adresse de
destination utilise le port **15008**, celui du tunnel entre nœuds, et les champs `src.identity` et `dst.identity`
contiennent une identité de la forme `spiffe://cluster.local/ns/pme/sa/pme-api`. La connexion de l'ingress vers l'API
et celle de Prometheus vers l'API ont été vérifiées de cette façon.

Pour vérifier que PostgreSQL refuse réellement une connexion en clair, il suffit d'essayer : une connexion ouverte
depuis un autre pod avec `sslmode=disable` est rejetée par le serveur, avant même la vérification du mot de passe.

!!! warning "Attention"
    L'autorité locale est valable dix ans et sa clé privée vit dans le cluster. Un `minikube delete` la détruit : les
    certificats sont régénérés au déploiement suivant, et le navigateur doit alors réimporter la nouvelle autorité,
    écrite par `make ca-cert`.

!!! tip "Astuce"
    Un avertissement du navigateur après un redéploiement signale presque toujours une autorité changée, et non une
    attaque. `make ca-cert`, puis un réimport, suffisent à le faire disparaître.

## Fichiers principaux

| Fichier ou dossier | Description |
|---|---|
| **`k8s/cert-manager/issuers.yaml`** | Déclare l'autorité locale et son émetteur. |
| **`k8s/12-certificate.yaml`** | Certificat unique des sept noms d'hôte de l'ingress. |
| **`k8s/00-internal-tls.yaml`** | Certificats de PostgreSQL et de NATS. |
| **`k8s/istio/`** | Réglages des quatre charts Helm d'Istio, avec des ressources réduites pour Minikube. |
| **`k8s/namespace.yaml`** | Porte le label qui enrôle le namespace `pme` dans le maillage. |
| **`k8s/02-service-accounts.yaml`** | Un compte de service par composant, donc une identité par composant. |
| **`k8s/20-mesh-mtls.yaml`** | Impose le mode strict : toute connexion hors mTLS est refusée. |
| **`k8s/21-authorization-policies.yaml`** | Refus par défaut, puis une règle par composant qui nomme ses appelants autorisés. |
| **`k8s/22-network-policies.yaml`** | Même filtrage au niveau du réseau du cluster, par étiquette de pod, appliqué par Calico. |
| **`k8s/14-ingress.yaml`** | Termine le TLS avec le certificat de cert-manager. |
| **`k8s/13-middlewares.yaml`** | Ajoute l'en-tête HSTS aux réponses de l'ingress, compresse les réponses, limite le débit (API et photos) et valide les jetons de l'API. |
| **`k8s/traefik/values.yaml`** | Redirige le HTTP vers le HTTPS pour tous les noms d'hôte. |
| **`k8s/config/postgres-hba.conf`** | Impose le TLS et SCRAM-SHA-256 à toute connexion venant du cluster, et limite chaque compte de service à sa base. |
| **`k8s/config/nats.conf`** | Active le TLS de NATS pour les clients et pour le port de supervision, et fixe la version minimale à 1.3. |

## Pour aller plus loin

- [Fiche cert-manager du projet](../outils/cert-manager.md)
- [Fiche Istio du projet](../outils/istio.md)
- [Les méthodes d'authentification de PostgreSQL](https://www.postgresql.org/docs/current/auth-pg-hba-conf.html)
- [Recommandations de l'ANSSI sur TLS](https://cyber.gouv.fr/publications/recommandations-de-securite-relatives-tls)
