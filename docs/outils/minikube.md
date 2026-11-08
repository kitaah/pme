# Minikube

## Fiche d'identité

| Information | Détail |
|---|---|
| **Rôle** | Fait fonctionner toute la plateforme sur un ordinateur, en reproduisant l'environnement de serveurs utilisé en production |
| **Version** | Minikube 1.39.0 |
| **Adresse en local** | Aucune : on accède aux applications par l'[ingress](ingress-nginx.md), à l'adresse <https://pme.localhost> |

## Description

Minikube est un logiciel open source. Il installe sur un ordinateur un petit **cluster Kubernetes**, qui reproduit à
échelle réduite l'environnement des serveurs de production.

**Pourquoi un cluster ?**
Une application moderne se compose de plusieurs programmes qui échangent entre eux. Ici, il s'agit de l'interface, de
l'API, du service de modération, de la base de données, de la messagerie et de l'authentification. Pour que
l'ensemble fonctionne de façon fiable, un outil doit démarrer ces programmes, les surveiller, les relancer en cas de
panne et en ajouter lorsque la charge augmente. Cet outil se nomme un **orchestrateur de conteneurs**, et Kubernetes
est le plus répandu. Il s'installe sur un cluster : un ensemble de machines, appelées **nœuds**, qui coopèrent comme un
seul système.

**Un cluster à un seul nœud.**
En production, un cluster compte plusieurs nœuds : la panne de l'un d'eux n'interrompt pas le service. Minikube crée
par défaut un cluster d'un seul nœud. Il suffit pour développer la plateforme, vérifier qu'une modification fonctionne
avant sa mise en ligne, tester l'ensemble des composants et présenter le projet lors d'une démonstration. Ce nœud est
lui-même un conteneur Docker : aucune machine virtuelle n'est nécessaire.

Le schéma suivant montre comment les éléments s'emboîtent sur l'ordinateur, de l'extérieur vers l'intérieur.

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
ordinateur: Ordinateur {
  label.near: bottom-left
  class: boite
  navigateur: "Navigateur\nhttps://pme.localhost" {class: boite}
  docker: Docker {
    label.near: bottom-left
    class: boite
    minikube: "Minikube : cluster à un seul nœud" {
      label.near: bottom-left
      class: boite
      ingress: "Ingress\nports 80 et 443" {class: boite}
      pme: "Namespace pme" {
        label.near: bottom-left
        class: boite
        interface: Interface {class: boite}
        api: API {class: boite}
        moderation: Modération {class: boite}
        donnees: "PostgreSQL, NATS,\nKeycloak, observabilité" {class: boite}
      }
    }
  }
}
ordinateur.navigateur -> ordinateur.docker.minikube.ingress
ordinateur.docker.minikube.ingress -> ordinateur.docker.minikube.pme
```

Chaque flèche indique le sens d'une demande : le navigateur s'adresse à l'ingress, qui la transmet aux applications du
namespace `pme`. Celles-ci s'appuient sur PostgreSQL, NATS et Keycloak, et les outils d'observabilité les surveillent.
L'ingress expose aussi les interfaces de Keycloak, de Grafana, de Prometheus et d'Adminer (voir sa fiche).

**Fonctionnement.**
L'exécution de la plateforme se déroule en trois étapes :

1. Chaque application est livrée sous la forme d'une **image Docker** : un modèle figé qui contient l'application et tout
   ce dont elle a besoin pour fonctionner. Un fichier appelé Dockerfile décrit la fabrication de l'image, qui est
   construite directement dans le cluster.
2. Les **manifestes** du dossier `k8s/` décrivent le résultat attendu : quelles applications exécuter, en combien
   d'exemplaires, avec quelle configuration et comment les rendre accessibles. Cette approche est dite
   **déclarative** : on indique l'état souhaité (« plusieurs exemplaires de l'API en fonctionnement »), et non les
   étapes pour y parvenir. C'est comparable à la commande d'un plat au restaurant, où l'on demande le plat sans
   détailler la recette.
3. Kubernetes compare en permanence l'état souhaité à l'état réel, puis corrige tout écart. Si un exemplaire s'arrête,
   il en démarre un nouveau. Si la charge augmente, il en ajoute, dans la limite prévue par la configuration.

Grâce à Minikube, l'équipe exécute donc toute la plateforme sur un ordinateur, avec les mêmes manifestes et les mêmes
mécanismes qu'en production.

**Contrôler les Dockerfile avec Hadolint.**
Un Dockerfile mal écrit produit une image volumineuse, instable ou vulnérable, et le défaut n'apparaît souvent qu'à
l'exécution. Hadolint est un **linter** : il lit les Dockerfile sans rien construire ni exécuter, puis les compare à une
liste de règles reconnues, identifiées par un code (`DL3006`, `DL4006`…). Pour les commandes écrites dans les
instructions `RUN`, il s'appuie aussi sur ShellCheck, un linter de scripts shell. Pour chaque écart, il indique le
fichier, la ligne, le code de la règle, sa gravité (`error`, `warning`, `info` ou `style`) et une explication.

Le projet fait échouer le contrôle dès la gravité `warning`, réglage placé dans le fichier `.hadolint.yaml`. Les écarts
de gravité `info` et `style` s'affichent, mais ne bloquent pas. Voici quelques règles courantes :

| Règle | Ce qu'elle vérifie | Pourquoi c'est important |
|---|---|---|
| `DL3006` | L'image de base porte une version explicite (`node:24-alpine`, et non `node`). | Sans version, la même construction peut donner un résultat différent d'un jour à l'autre. |
| `DL3002` | Le dernier utilisateur du Dockerfile n'est pas `root`. | Un conteneur qui s'exécute en `root` donne à un attaquant des droits étendus s'il en prend le contrôle. |
| `DL3020` | Les fichiers sont copiés avec `COPY` plutôt qu'avec `ADD`. | `ADD` a des effets cachés (téléchargement, décompression) qui surprennent. |
| `DL3025` | `CMD` est écrit sous forme de liste JSON : `["node", "main.js"]`. | Sans cette forme, le programme passe par un shell et ne reçoit pas toujours le signal d'arrêt de Kubernetes. |
| `DL3008` | Les paquets installés avec `apt-get` ont une version précisée. | Une mise à jour imprévue d'un paquet ne peut plus casser l'image. |
| `DL4006` | Un `RUN` qui contient un tube (`|`) active l'option `pipefail`. | Sans elle, l'échec de la première commande du tube passe inaperçu et la construction continue. |

La commande `make lint-docker` lance Hadolint sur les quatre Dockerfile du projet : l'API, le service de modération,
l'interface et la documentation. Ils passent le contrôle sans alerte : image de base versionnée, construction en
plusieurs étapes et exécution sans droits `root`. Ce contrôle se lance sur l'ordinateur, et la pipeline GitLab le rejoue à chaque modification d'un Dockerfile
(voir la page [Contrôle des Dockerfile](../pipeline/controle-dockerfile.md)).

**Définitions**

| Terme | Définition |
|---|---|
| **Addon** | Composant facultatif que Minikube ajoute au cluster sur demande. Le projet utilise `ingress` et `metrics-server`. |
| **API** | Interface par laquelle des programmes échangent des informations. Ici, l'API est le service qui traite les demandes de l'interface. |
| **Autoscaling** | Ajustement automatique du nombre de réplicas d'une application selon la charge : Kubernetes en ajoute quand l'usage augmente et en retire quand il baisse. |
| **Cluster** | Ensemble de machines reliées entre elles, qui fonctionnent comme un seul système pour exécuter des applications. Ici, il se limite à un nœud. |
| **ConfigMap** | Objet Kubernetes qui contient des paramètres ou des fichiers de configuration fournis aux applications. |
| **Conteneur** | Environnement isolé qui regroupe une application et tout ce dont elle a besoin pour fonctionner. Il s'exécute de la même façon sur n'importe quel ordinateur. |
| **Déclaratif** | Se dit d'une configuration qui décrit le résultat attendu plutôt que les étapes pour l'obtenir. |
| **Docker** | Logiciel open source qui crée et exécute des conteneurs sur un ordinateur. |
| **Dockerfile** | Fichier qui décrit, étape par étape, comment fabriquer une image Docker. |
| **Hadolint** | Linter open source spécialisé dans les Dockerfile. Il les analyse sans rien construire et signale les erreurs et les écarts aux bonnes pratiques de sécurité et de fiabilité. |
| **Image Docker** | Modèle figé d'une application, à partir duquel Docker crée des conteneurs. |
| **Ingress** | Point d'entrée du cluster. Il reçoit les requêtes du navigateur et les dirige vers la bonne application. |
| **`kubectl`** | Outil en ligne de commande qui permet de piloter un cluster Kubernetes. |
| **Kubernetes** | Orchestrateur de conteneurs open source. Il démarre les conteneurs, les surveille, les relance en cas d'arrêt et répartit la charge entre eux. |
| **Kustomize** | Outil intégré à `kubectl` qui assemble plusieurs manifestes en un seul déploiement. |
| **Linter** | Outil qui analyse un fichier sans l'exécuter, pour y repérer des erreurs et des écarts aux bonnes pratiques. |
| **`make`** | Outil qui exécute les commandes nommées du fichier `Makefile`, par exemple `make deploy`. |
| **Manifeste** | Fichier de configuration, écrit en YAML, qui décrit l'état souhaité d'un composant dans Kubernetes. |
| **Namespace** | Espace de noms qui isole un groupe de ressources au sein d'un cluster. |
| **Nœud** | Machine, réelle ou virtuelle, qui exécute les conteneurs d'un cluster. |
| **Open source** | Se dit d'un logiciel dont le code source est public et que chacun peut utiliser gratuitement. |
| **Orchestrateur** | Logiciel qui démarre, surveille et relance automatiquement les conteneurs d'une application. |
| **Pod** | Plus petite unité que Kubernetes déploie. Il contient un ou plusieurs conteneurs étroitement liés. Dans ce projet, un pod correspond à un exemplaire d'une application. |
| **Port** | Numéro qui identifie un service réseau sur un ordinateur. Par convention, le port 80 sert le HTTP et le port 443 le HTTPS. |
| **Réplica** | Exemplaire identique d'un pod. Plusieurs réplicas répartissent la charge et maintiennent le service si l'un d'eux s'arrête. |
| **Sonde de santé** | Test que Kubernetes répète pour savoir si un conteneur est prêt à recevoir des demandes et s'il fonctionne toujours. Si le test échoue, Kubernetes cesse de lui envoyer du trafic ou le relance. |
| **Volume persistant** | Espace de stockage dont le contenu survit à l'arrêt ou au remplacement d'un pod, par exemple pour les données d'une base. |
| **YAML** | Format de fichier texte lisible, utilisé pour écrire les manifestes. |

## Rôle dans le projet

- Il joue le rôle d'orchestrateur : il exécute, surveille et relance automatiquement tous les composants de la plateforme, soit l'interface, l'API, le service de modération, PostgreSQL, NATS, Keycloak et les outils d'observabilité.
- Il constitue l'environnement d'exécution local de l'équipe, sans serveur dédié ni abonnement à un service cloud.
- Il fait fonctionner les mécanismes de production sur lesquels repose la fiabilité de la plateforme :
    - **Autoscaling** : l'interface, l'API et le service de modération passent automatiquement de 2 à 4 réplicas lorsque l'usage moyen du processeur dépasse 70 %. Lors d'une maintenance, au moins un réplica de chaque reste disponible.
    - **Contrôle de santé** : chaque composant déclare ses limites de mémoire et de processeur, ainsi que des sondes de santé qui indiquent à Kubernetes quand le relancer ou lui envoyer du trafic.
    - **Sécurité** : les trois applications s'exécutent sans droits `root`, avec un système de fichiers en lecture seule et sans aucune capacité Linux supplémentaire. Le namespace applique la règle `baseline` et vérifie en plus la règle plus stricte `restricted` en mode audit : elle signale les écarts sans les bloquer.
    - **Chiffrement** : les connexions à PostgreSQL et à NATS sont chiffrées par des certificats que [cert-manager](cert-manager.md) émet pour le cluster.
    - **Données** : PostgreSQL stocke ses données sur un volume persistant de 1 Go. Elles survivent au redémarrage du pod, mais disparaissent avec le namespace (`make undeploy`) ou avec le cluster (`minikube delete`).
- Il exécute des images construites localement : `make image` les fabrique dans le cluster avec l'étiquette `:dev`, sans passer par un registre. Les manifestes demandent à Kubernetes d'utiliser l'image déjà présente (`imagePullPolicy: IfNotPresent`).
- Le passage à un cluster de production n'exige donc pas de réécrire les manifestes : il suffit de les adapter, notamment l'émetteur des certificats et l'origine des images.
- Sans lui, aucun composant ne s'exécute : le projet n'a plus d'environnement ni d'orchestrateur.

Le cluster exécute les composants suivants, tous dans le namespace `pme` :

| Groupe | Composants | Rôle |
|---|---|---|
| Applications | Interface ([React](react.md)), API et service de modération ([NestJS](nestjs.md)) | Affichent le site, appliquent les règles métier et modèrent les contenus. |
| Données et messagerie | [PostgreSQL](postgresql.md), [NATS](nats.md) | Stockent les données et transmettent les messages entre l'API et la modération. |
| Authentification | [Keycloak](keycloak.md) | Gère les comptes, la connexion et les rôles. |
| Observabilité | [Prometheus](prometheus.md), [Loki](loki.md), [Alloy](alloy.md), [Grafana](grafana.md) | Collectent, conservent et affichent les mesures et les journaux. |
| Administration | [Adminer](adminer.md) | Permet de consulter les bases depuis un navigateur. |

Le cluster est créé avec les paramètres suivants :

| Paramètre | Valeur | Explication |
|---|---|---|
| Pilote | `docker` | Le nœud fonctionne dans un conteneur Docker, sans machine virtuelle. |
| Mémoire | 4 096 Mo | Mémoire vive allouée au cluster. La variable `MINIKUBE_MEMORY` permet de la modifier. |
| Processeurs | 2 cœurs | Puissance de calcul allouée au cluster. La variable `MINIKUBE_CPUS` permet de la modifier. |
| Ports publiés | 80 et 443 sur `127.0.0.1` | L'adresse `127.0.0.1` désigne l'ordinateur lui-même. L'ingress est ainsi joignable depuis le navigateur, sans redirection de port. |
| Addons activés | `ingress` et `metrics-server` | Le premier fournit le point d'entrée du cluster. Le second mesure la charge des pods, ce qui permet l'ajustement automatique de leur nombre. |

!!! note "À savoir"
    Le cluster ne compte qu'un nœud. Les réplicas d'une application s'exécutent donc sur la même machine : ils
    répartissent la charge, mais ne protègent pas d'une panne de l'ordinateur. Une véritable haute disponibilité
    suppose un cluster de plusieurs nœuds, ce qui dépasse le périmètre du POC.

## Fichiers et dossiers principaux

| Fichier ou dossier | Description |
|---|---|
| `Makefile` | Regroupe les commandes de création du cluster, de construction des images et de déploiement. |
| `k8s/` | Contient les manifestes, à raison d'un fichier par composant à déployer. |
| `k8s/kustomization.yaml` | Liste les manifestes déployés ensemble et génère les ConfigMaps à partir de `k8s/config/`. |
| `k8s/namespace.yaml` | Crée le namespace `pme` et lui applique la règle de sécurité `baseline`. |
| `k8s/config/` | Contient les fichiers de configuration fournis aux composants : PostgreSQL, NATS, Grafana, Alloy et interface. |
| `k8s/14-pme-secrets-sealed.yaml` | Contient les mots de passe chiffrés, sous une forme qui peut être versionnée dans Git sans risque (voir [Sealed Secrets](sealed-secrets.md)). |
| `k8s/11-autoscaling.yaml` | Définit, pour l'interface, l'API et la modération, l'autoscaling et le nombre minimal de réplicas disponibles. |
| `api/Dockerfile` | Décrit la fabrication de l'image de l'API. |
| `moderation-service/Dockerfile` | Décrit la fabrication de l'image du service de modération. |
| `frontend/Dockerfile` | Décrit la fabrication de l'image de l'interface. |
| `docker/docs/Dockerfile` | Décrit la fabrication de l'image de la documentation, y compris l'installation de l'outil de schémas D2. |
| `.hadolint.yaml` | Règle le niveau à partir duquel Hadolint signale un échec : le niveau « warning ». |
| `.env` | Contient les mots de passe de démonstration, que `make seal` chiffre. Ce fichier est exclu de Git. |

## Commandes essentielles

À lancer dans un terminal, depuis le dossier du projet. Elles supposent que Docker est démarré et que Minikube, `kubectl` et `make` sont installés sur l'ordinateur.

| Commande | Description |
|---|---|
| `make minikube-up` | Crée et démarre le cluster, publie les ports 80 et 443, active l'ingress et metrics-server, installe cert-manager et extrait le certificat de l'autorité de certification locale. |
| `make image` | Construit les trois images (API, modération, interface) directement dans le cluster. |
| `make lint-docker` | Lance Hadolint sur les quatre Dockerfile du projet. La commande échoue dès qu'une règle de gravité `warning` ou `error` est enfreinte. |
| `make deploy` | Applique les manifestes et déploie toute la plateforme. |
| `make pods` | Affiche l'état de chaque pod. |
| `make redeploy` | Reconstruit les images, puis redémarre progressivement l'API, la modération et l'interface pour appliquer une modification du code. |
| `make undeploy` | Supprime le namespace `pme`, donc la plateforme et ses données. |
| `make minikube-down` | Arrête le cluster sans le supprimer. |

Lors du premier démarrage, l'enchaînement est le suivant :

1. `make minikube-up` crée le cluster.
2. Importer dans le navigateur le certificat de l'autorité locale, afin qu'il accepte le HTTPS local (voir [cert-manager](cert-manager.md)).
3. `make image` construit les images.
4. `make deploy` déploie la plateforme.
5. `make pods` permet de suivre le démarrage. Keycloak met environ une minute à devenir disponible.

!!! warning "Attention"
    `make undeploy` supprime aussi les données (annonces, comptes). À réserver au cas où l'on souhaite repartir de zéro.

!!! tip "Astuce"
    L'option `--ports` n'est prise en compte qu'à la création du cluster. Pour l'appliquer à un cluster existant, il
    faut d'abord le supprimer avec `minikube delete`, puis relancer `make minikube-up`. Les déploiements sont alors perdus.

## Pour aller plus loin

- [Site officiel de Minikube](https://minikube.sigs.k8s.io/)
- [Documentation de Kubernetes](https://kubernetes.io/fr/docs/home/)
- [Site officiel de Kustomize](https://kustomize.io/)
- [Site officiel de Hadolint](https://github.com/hadolint/hadolint)
- [Liste des règles de Hadolint](https://github.com/hadolint/hadolint#rules)
