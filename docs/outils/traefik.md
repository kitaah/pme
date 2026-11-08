# Traefik

## Fiche d'identité

| Information | Détail |
|---|---|
| **Rôle** | Point d'entrée unique du cluster : il reçoit les requêtes du navigateur, les déchiffre et les dirige vers le bon service |
| **Version** | Chart Helm 41.3.0, qui installe Traefik Proxy 3.7 |
| **Adresse en local** | <https://pme.localhost> et les cinq autres noms en `.localhost` |

## Description

Traefik est un **contrôleur d'ingress** : un serveur qui reçoit le trafic entrant dans le cluster et l'aiguille vers
la bonne application. C'est un projet libre, maintenu activement, que de nombreux fournisseurs de Kubernetes ont adopté
comme point d'entrée par défaut.

**Pourquoi Traefik et non ingress-nginx ?**
Le projet ingress-nginx, longtemps le choix par défaut, a été archivé par la communauté Kubernetes en mars 2026. Il ne
reçoit plus aucun correctif, y compris de sécurité. Or l'ingress est la seule partie du cluster directement exposée aux
clients : y laisser un composant sans mise à jour n'est pas acceptable. Traefik remplace donc ingress-nginx.
Il comprend les ressources d'ingress existantes, ce qui limite le changement aux réglages propres au contrôleur.

**Pourquoi un point d'entrée unique ?**
Le cluster héberge plusieurs interfaces web : le site, l'API, la modération, Keycloak, Adminer, Grafana, Prometheus
et Alloy. Sans point d'entrée commun, chacune exigerait sa propre ouverture vers l'extérieur et son propre numéro de port, à
retenir et à transmettre. L'ingress règle le problème : il n'écoute que les ports 80 et 443, et choisit la destination
d'après l'adresse demandée. Une seule porte, plusieurs destinations.

**Comment il choisit la destination.**
Deux informations lui suffisent. Le **nom d'hôte** d'abord, c'est-à-dire l'adresse saisie dans le navigateur :
`grafana.localhost` mène à Grafana. Le **chemin** ensuite, pour le site principal, où trois destinations cohabitent
sous la même adresse. La règle est celle du chemin le plus long : `/api/v1/moderation` l'emporte sur `/api/v1`, qui
l'emporte à son tour sur `/`.

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

navigateur: "Navigateur\nHTTPS, ports 80 et 443" {class: boite}
ingress: "Traefik\nle chiffrement s'arrête ici" {class: boite}

site: "pme.localhost" {
  class: boite
  front: "Site\nchemin /" {class: boite}
  api: "API\nchemin /api/v1" {class: boite}
  moderation: "Modération\nchemin /api/v1/moderation" {class: boite}
}

autres: "Un nom d'hôte par outil\nKeycloak, Adminer, Grafana,\nPrometheus, Alloy" {class: boite}

navigateur -> ingress
ingress -> site
ingress -> autres
```

**Le chiffrement s'arrête à l'ingress.**
Les échanges entre le navigateur et Traefik sont chiffrés en HTTPS, avec un certificat fourni par
[cert-manager](cert-manager.md). Traefik déchiffre la requête, puis la transmet en HTTP aux services du cluster :
c'est ce qu'on appelle la **terminaison TLS**. Ce choix évite à chaque application de gérer son propre certificat. Ce
dernier trajet n'est pas en clair pour autant : le namespace de Traefik est enrôlé dans le maillage
[Istio](istio.md), qui chiffre en mTLS la connexion de l'ingress vers les pods.
Deux liaisons internes font exception et restent chiffrées de bout en bout, parce qu'elles transportent des données
sensibles : celles vers [PostgreSQL](postgresql.md) et vers [NATS](nats.md).

**Il ajoute des protections aux réponses.**
Les réglages de réponse sont décrits dans des ressources appelées **middlewares**, que l'ingress référence. Deux sont
utilisés. L'un ajoute l'en-tête HSTS, qui demande au navigateur de n'utiliser que HTTPS pour ces noms. L'autre compresse
les réponses volumineuses pour accélérer le chargement.

**Il répartit aussi la charge.**
Une application fonctionne en plusieurs exemplaires, dont le nombre varie avec la charge. Traefik envoie les
requêtes directement à ces exemplaires, à tour de rôle. Lorsque l'autoscaler en ajoute ou en retire, la répartition
suit d'elle-même. Le cluster n'a donc pas besoin d'un répartiteur de charge séparé, service que seul un hébergeur
fournirait.

**Toutes les adresses ne sont pas exposées.**
Seul le préfixe `/api/v1` est accessible depuis l'extérieur. Les adresses techniques de l'API, ses mesures et ses
sondes de santé, restent internes au cluster : Prometheus et Kubernetes les interrogent directement, sans passer par
l'ingress. Une adresse non exposée est une surface d'attaque en moins. L'interface web propre à Traefik, son tableau de
bord, n'est pas exposée non plus.

**Définitions**

| Terme | Définition |
|---|---|
| **Chart Helm** | Paquet qui décrit l'installation d'un logiciel dans Kubernetes. Il se règle par un fichier de valeurs. |
| **Chemin** | Partie de l'adresse qui suit le nom d'hôte, par exemple `/api/v1/listings`. |
| **Contrôleur d'ingress** | Programme qui applique les règles d'ingress et achemine réellement les requêtes. |
| **Fichier hosts** | Fichier de l'ordinateur qui associe un nom d'hôte à une adresse réseau. |
| **Helm** | Outil en ligne de commande qui installe et met à jour les charts dans Kubernetes. |
| **HSTS** | En-tête de réponse qui demande au navigateur de n'utiliser que HTTPS pour un site pendant une durée donnée. |
| **Ingress** | Règle Kubernetes qui associe un nom d'hôte et un chemin à un service du cluster. |
| **Middleware** | Traitement que Traefik applique à une requête ou à une réponse, par exemple l'ajout d'un en-tête. |
| **Nom d'hôte** | Adresse saisie dans le navigateur, par exemple `keycloak.localhost`. |
| **Répartition de charge** | Distribution des requêtes entre plusieurs exemplaires d'une même application. |
| **Terminaison TLS** | Fait de déchiffrer le HTTPS à l'entrée, puis de transmettre la requête en HTTP à l'intérieur. |
| **TLS 1.2 et 1.3** | Versions actuelles du protocole de chiffrement. Les versions antérieures sont refusées. |
| **Tunnel** | Liaison qui rend l'ingress joignable depuis l'ordinateur lorsque le cluster n'a pas publié ses ports. |

## Rôle dans le projet

- Il est la seule porte d'entrée des interfaces web du cluster.
- Il dirige chaque nom d'hôte vers son service, et les trois chemins du site vers leurs destinations respectives.
- Il chiffre les échanges avec le navigateur et redirige automatiquement le HTTP vers le HTTPS.
- Il appartient au maillage Istio : sans cela, le mode strict du namespace `pme` refuserait ses connexions vers les services.
- Il ajoute l'en-tête HSTS à ses réponses : pendant sept jours, le navigateur n'utilise plus que HTTPS pour ces noms.
- Il compresse les réponses de plus de 1 Ko.
- Il répartit les requêtes entre les exemplaires de l'API, de la modération et du site.
- Il n'expose que ce qui doit l'être : les mesures et les sondes de santé restent internes.
- Il écrit un journal de chaque requête, au format JSON, consultable avec la commande de journal ci-dessous.
- Sans lui, chaque interface exigerait une redirection de port distincte, à relancer à chaque session de travail.

Les six noms d'hôte sont les suivants :

| Adresse | Service | Port | Rôle |
|---|---|---|---|
| <https://pme.localhost> | `pme-frontend`, `pme-api`, `pme-moderation` | 8080, 3000 et 3001 | Le site et son API, selon le chemin. |
| <https://keycloak.localhost> | `keycloak` | 8080 | Connexion et gestion des comptes. |
| <https://adminer.localhost> | `adminer` | 8080 | Consultation des bases de données. |
| <https://grafana.localhost> | `grafana` | 3000 | Tableaux de bord. |
| <https://prometheus.localhost> | `prometheus` | 9090 | Mesures brutes et état de la collecte. |
| <https://alloy.localhost> | `alloy` | 12345 | Suivi de la collecte des journaux. |

!!! note "À savoir"
    Ces noms d'hôte figurent aussi dans le `Makefile`, dans la configuration de Keycloak, de l'API, de la modération,
    de Grafana et du site. En changer un impose de modifier tous ces fichiers ensemble, sans quoi la connexion échoue.

## Fichiers et dossiers principaux

| Fichier ou dossier | Description |
|---|---|
| `k8s/traefik/values.yaml` | Réglages de Traefik : ports 80 et 443, redirection vers HTTPS, journal d'accès. |
| `k8s/08-ingress.yaml` | Déclare les noms d'hôte, les chemins, les services visés et le certificat. |
| `k8s/08-middlewares.yaml` | Décrit l'en-tête HSTS et la compression des réponses. |
| `k8s/08-certificate.yaml` | Demande à cert-manager le certificat des six noms d'hôte. |
| `k8s/03-keycloak.yaml` | Fixe l'adresse publique de Keycloak. |
| `k8s/config/realm-pme.json` | Liste les adresses de retour autorisées après la connexion. |
| `k8s/config/frontend-config.js` | Indique au site l'adresse de Keycloak. |
| `Makefile` | Contient les noms d'hôte, la version du chart et les commandes liées à l'ingress. |
| `/etc/hosts` | Associe les six noms d'hôte à l'adresse de l'ordinateur. |

## Commandes essentielles

À lancer dans un terminal, depuis le dossier du projet. Helm doit être installé sur l'ordinateur, ce que fait `make helm`.

| Commande | Description |
|---|---|
| `make minikube-up` | Crée le cluster en publiant les ports 80 et 443 sur l'ordinateur, puis installe Traefik. |
| `make helm` | Installe Helm sur l'ordinateur s'il est absent. Le mot de passe administrateur est demandé. |
| `make ingress` | Installe ou met à jour Traefik dans le cluster et attend qu'il soit prêt. |
| `make istio` | Installe le maillage Istio et enrôle le namespace de Traefik (voir [Istio](istio.md)). À lancer après `make ingress`. |
| `make hosts` | Affiche la ligne à ajouter au fichier hosts de l'ordinateur. |
| `make deploy` | Installe les règles d'ingress, les middlewares et le certificat avec le reste de la plateforme. |
| `make app` | Ouvre l'application dans le navigateur. |
| `make ca-cert` | Écrit l'autorité locale dans `pme-ca.crt`, à importer dans le navigateur. |
| `make tunnel` | Redirige les ports 80 et 443 vers Traefik, pour un cluster créé sans publication des ports. |
| `kubectl -n traefik logs deploy/traefik` | Affiche le journal de Traefik, dont les requêtes reçues. |

La ligne à ajouter une seule fois au fichier hosts est la suivante :

```
127.0.0.1 pme.localhost keycloak.localhost adminer.localhost grafana.localhost prometheus.localhost alloy.localhost
```

Ce fichier se trouve dans `/etc/hosts` sous Linux et macOS, et dans `C:\Windows\System32\drivers\etc\hosts` sous
Windows. Sa modification demande les droits d'administrateur.

!!! note "À savoir"
    Le suffixe `.localhost` n'est pas un détail. Les navigateurs traitent ces adresses comme un contexte sécurisé, ce
    dont la connexion à Keycloak a besoin, et les dirigent toujours vers l'ordinateur lui-même. Un suffixe `.local`
    ferait échouer la connexion.

!!! warning "Attention"
    Le contrôleur d'ingress était auparavant ingress-nginx, installé par l'extension « ingress » de Minikube. Sur un
    cluster déjà créé avec cette extension, `make ingress` la désactive avant d'installer Traefik : les deux se
    disputeraient les ports 80 et 443. Les anciennes règles d'ingress doivent être supprimées, puis recréées par
    `make deploy`.

!!! tip "Astuce"
    Le cluster publie les ports 80 et 443 dès sa création : l'ingress est donc joignable sans autre commande, et
    `make tunnel` ne sert que pour un cluster créé autrement. L'adresse donnée par `minikube ip` n'est jamais utilisée,
    car elle change d'un ordinateur à l'autre.

## Pour aller plus loin

- [Documentation de Traefik](https://doc.traefik.io/traefik/)
- [Installation de Helm](https://helm.sh/docs/intro/install/)
- [Documentation de Kubernetes sur les ingress](https://kubernetes.io/fr/docs/concepts/services-networking/ingress/)
- [Annonce du retrait d'ingress-nginx](https://kubernetes.io/blog/2025/11/11/ingress-Nginx-retirement/)
- [Fiche cert-manager du projet](cert-manager.md)
