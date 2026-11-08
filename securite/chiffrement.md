# Chiffrement des échanges

## Fiche d'identité

| Information | Détail |
|---|---|
| **Rôle** | Rend illisible et infalsifiable tout ce qui circule, du navigateur jusqu'à la base de données |
| **Outil** | [cert-manager](../outils/cert-manager.md) 1.18.2, autorité de certification locale |
| **Portée externe** | HTTPS sur les six noms d'hôte, HTTP redirigé vers HTTPS, en-tête HSTS de sept jours |
| **Portée interne** | TLS jusqu'à PostgreSQL et jusqu'à NATS, avec vérification du nom du serveur |
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
la transmet ensuite en HTTP simple au service concerné, à l'intérieur du cluster. Ce choix, courant, simplifie la
configuration ; il suppose que le réseau interne du cluster est de confiance, ce qui n'est vrai que pour un cluster
local à un seul nœud.

**Pourquoi les bases de données font exception.**
Les échanges avec PostgreSQL et NATS, eux, sont chiffrés de bout en bout, même à l'intérieur du cluster. C'est là que
circulent les mots de passe de connexion et l'intégralité des données : le gain est réel, et le coût nul.

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
  services: "3. API et modération — HTTP interne" {class: boite}
  donnees: "4. PostgreSQL et NATS — TLS, nom du serveur vérifié" {class: boite}
}
```

**Définitions**

| Terme | Définition |
|---|---|
| **Autorité de certification** | Entité qui signe des certificats. Un client ne fait confiance à un certificat que s'il fait confiance à son autorité. |
| **Certificat** | Document qui associe un nom de serveur à une clé publique, et que signe une autorité. |
| **ECDSA** | Famille d'algorithmes de signature à courbes elliptiques : des clés plus courtes que RSA, pour une sécurité équivalente. |
| **HSTS** | En-tête de réponse qui demande au navigateur de n'utiliser que HTTPS pour un site pendant une durée donnée. |
| **SCRAM-SHA-256** | Méthode d'authentification de PostgreSQL qui ne fait jamais circuler le mot de passe, même chiffré. |
| **Terminaison TLS** | Endroit où le chiffrement s'arrête et où la requête redevient lisible. |
| **TLS** | Protocole qui chiffre une communication et authentifie le serveur. Le « s » de HTTPS. |
| **verify-full** | Niveau de vérification le plus strict : le certificat doit être signé par une autorité connue **et** émis pour le nom demandé. |

## Ce qui est en place

**Côté navigateur**

| Mesure | Détail |
|---|---|
| **HTTPS sur tous les noms** | Un certificat unique couvre les six noms d'hôte de l'ingress. |
| **Redirection du HTTP** | Une requête en HTTP est redirigée vers HTTPS, elle n'est jamais servie en clair. |
| **En-tête HSTS** | Pendant sept jours, le navigateur qui a déjà visité un nom n'utilise plus que HTTPS, même si l'adresse saisie commence par `http://`. |
| **Renouvellement automatique** | cert-manager renouvelle 15 jours avant l'échéance, sans intervention. |
| **Rotation de la clé** | Une nouvelle clé privée est générée à chaque renouvellement, et non réutilisée. |

**Côté services internes**

| Échange | Protection |
|---|---|
| **Vers PostgreSQL** | TLS obligatoire côté serveur : les règles d'accès n'acceptent que des connexions chiffrées, et le mot de passe est contrôlé par SCRAM-SHA-256, qui ne le fait jamais circuler. |
| **Vers NATS** | TLS, avec une version minimale fixée à **1.3**. Sans ce réglage, le serveur accepterait encore TLS 1.2. |
| **Vérification du nom** | L'API, le service de modération, Keycloak et Grafana vérifient que le certificat présenté a bien été émis pour le serveur qu'ils appellent, et non seulement qu'il est signé par l'autorité. |

Le point important du côté de PostgreSQL est que l'obligation est **posée par le serveur**, et non laissée à la
discrétion des clients. Le fichier de règles d'accès fourni par l'image accepte les connexions TCP en clair ; le projet
le remplace par le sien, qui n'autorise que les connexions chiffrées depuis le reste du cluster. Une application mal
configurée n'obtient donc pas une connexion en clair : elle est refusée.

Trois exceptions figurent dans ces règles, toutes internes au pod : la socket Unix, utilisée par l'initialisation de
l'image, et la boucle locale en IPv4 et IPv6, utilisée par les sondes de Kubernetes. Dans un pod, cette boucle locale
n'est joignable que depuis le pod lui-même.

!!! note "À savoir"
    Les certificats internes ne servent qu'à authentifier le **serveur**. Les clients, eux, ne présentent pas de
    certificat : ils s'identifient par leur mot de passe. Une authentification mutuelle, où chaque partie prouve son
    identité par un certificat, serait l'étape suivante.

## Ce qui n'est pas couvert

- **L'autorité est locale** : son certificat doit être importé une fois dans le navigateur, sans quoi celui-ci affiche
  un avertissement. C'est le fonctionnement attendu, et non un défaut : un navigateur qui ferait confiance à une
  autorité inconnue serait le vrai problème.
- **Le trafic interne du site reste en HTTP** : entre l'ingress et les services, la requête circule en clair. Un cluster
  multi-nœuds, ou partagé, justifierait un maillage de services chiffrant tous les échanges.
- **Le port de supervision de NATS reste en HTTP simple** : il n'expose que des compteurs, pas de données, mais il
  échappe à la règle générale.
- **Aucune authentification mutuelle** : un client qui connaît le mot de passe de PostgreSQL peut s'y connecter, d'où
  qu'il vienne. Faute de politique réseau, cela signifie : depuis n'importe quel pod du namespace.
- **HSTS de courte durée, sans prechargement** : la durée est de sept jours, et non d'un an. Un HSTS actif interdit de
  passer outre l'alerte du certificat : après un changement d'autorité locale, le navigateur bloque le site tant qu'il
  retient la règle. La toute première visite d'un navigateur reste servie par la redirection, faute de liste de
  préchargement. En production, la durée serait portée à un an.

## Commandes de vérification

À lancer dans un terminal, depuis le dossier du projet, la plateforme déployée.

| Commande | Description |
|---|---|
| `make ca-cert` | Écrit le certificat de l'autorité locale, à importer dans le navigateur. |
| `kubectl -n pme get certificate` | Affiche les certificats du cluster, leur état et leur validité. |
| `make ca-configmap` | Copie l'autorité dans le namespace, pour que les applications vérifient les certificats. |

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
| `k8s/cert-manager/issuers.yaml` | Déclare l'autorité locale et son émetteur. |
| `k8s/08-certificate.yaml` | Certificat unique des six noms d'hôte de l'ingress. |
| `k8s/00-internal-tls.yaml` | Certificats de PostgreSQL et de NATS. |
| `k8s/08-ingress.yaml` | Termine le TLS et redirige le HTTP vers le HTTPS. |
| `Makefile` (cible `ingress`) | Active l'en-tête HSTS dans la configuration du contrôleur d'ingress. |
| `k8s/config/postgres-hba.conf` | Impose le TLS et SCRAM-SHA-256 à toute connexion venant du cluster. |
| `k8s/config/nats.conf` | Active le TLS de NATS et fixe la version minimale à 1.3. |

## Pour aller plus loin

- [Fiche cert-manager du projet](../outils/cert-manager.md)
- [Les méthodes d'authentification de PostgreSQL](https://www.postgresql.org/docs/current/auth-pg-hba-conf.html)
- [Recommandations de l'ANSSI sur TLS](https://cyber.gouv.fr/publications/recommandations-de-securite-relatives-tls)
