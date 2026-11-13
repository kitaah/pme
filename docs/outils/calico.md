# Calico

## Fiche d'identité

| Information | Détail |
|---|---|
| **Rôle** | Applique les politiques réseau : il décide quels pods peuvent ouvrir une connexion vers quels autres |
| **Version** | Plugin réseau fourni par Minikube (`minikube start --cni=calico`) |
| **Installation** | Choisi à la création du cluster, par `make minikube-up` |
| **Adresse en local** | Aucune interface : il travaille à l'intérieur du cluster |

## Description

Calico est un **plugin réseau** (*CNI*) open source pour Kubernetes. Il connecte les pods entre eux, et il applique les
règles qui limitent leurs échanges.

**Le problème : dans un cluster, tout pod peut joindre n'importe quel autre.**
Par défaut, Kubernetes ne filtre aucune connexion entre les pods d'un même cluster. Si un attaquant prend le contrôle de
l'interface web, rien ne l'empêche d'ouvrir une connexion vers la base de données. Kubernetes sait décrire des règles
qui l'interdiraient, les **politiques réseau**, mais il ne les applique pas lui-même. Il confie ce travail au plugin
réseau. Celui que Minikube installe par défaut accepte ces règles sans les appliquer : elles existent, et ne bloquent rien.

**Comment Calico les applique.**
Un agent de Calico tourne sur chaque nœud. Il lit les politiques réseau du cluster, puis les traduit en règles de pare-feu
dans le noyau Linux. Une connexion non autorisée est abandonnée avant d'atteindre le pod visé. L'appelant ne reçoit
aucune réponse et finit par abandonner (*timeout*).

**Le refus par défaut.**
Le projet commence par une politique qui interdit toute connexion entrante vers les pods du namespace `pme`. Il ajoute
ensuite une politique par composant, qui nomme les appelants autorisés. Un composant oublié reste donc injoignable : une
erreur de configuration refuse l'accès au lieu de l'ouvrir.

**Deux filtres qui se complètent.**
Calico reconnaît un pod à ses **étiquettes**, que n'importe quel administrateur du namespace peut modifier. Le maillage
[Istio](istio.md) le reconnaît à son **identité** cryptographique, qui ne peut pas être imitée. Le projet utilise les
deux avec les mêmes listes d'appelants : si l'un est contourné ou mal réglé, l'autre bloque encore.

**Définitions**

| Terme | Définition |
|---|---|
| **CNI** | *Container Network Interface*. Standard des plugins réseau de Kubernetes : celui qui branche chaque pod sur le réseau du cluster. |
| **Étiquette (label)** | Paire nom et valeur attachée à un pod. Une politique réseau s'en sert pour désigner les pods concernés et leurs appelants. |
| **Politique réseau** | Règle Kubernetes qui décide quels pods peuvent se parler. Elle n'a d'effet que si le plugin réseau l'applique. |
| **Refus par défaut** | Principe qui consiste à tout interdire, puis à autoriser explicitement chaque échange nécessaire. |

## Rôle dans le projet

- Il applique les douze politiques réseau de `k8s/18-network-policies.yaml` : un refus par défaut, et une règle par composant.
- Il garantit qu'un pod compromis ne peut joindre que les composants dont il est un appelant prévu. L'interface, par exemple, ne peut plus joindre PostgreSQL.
- Il double le filtrage du maillage [Istio](istio.md), avec une vérification indépendante au niveau du réseau.
- Sans lui, les politiques réseau sont acceptées par Kubernetes mais ne bloquent plus aucune connexion : seul le filtrage d'Istio subsiste.

La liste des composants et de leurs appelants autorisés figure dans la page [Durcissement](../securite/durcissement.md).

!!! note "À savoir"
    Les politiques ne contrôlent que les connexions **entrantes**. Les connexions sortantes des pods ne sont pas filtrées.
    Chaque règle ouvre aussi le port 15008, celui du tunnel que le maillage utilise entre les pods, aux mêmes appelants
    que le port de l'application.

## Fichiers et dossiers principaux

| Fichier ou dossier | Description |
|---|---|
| **`k8s/18-network-policies.yaml`** | Déclare le refus par défaut et la politique de chaque composant. |
| **`k8s/17-authorization-policies.yaml`** | Déclare les mêmes règles côté Istio, par identité : les deux fichiers se modifient ensemble. |
| **`Makefile`**<br>(cibles **`minikube-up`**,<br>**`netpol-check`** et **`authz-check`**) | Crée le cluster avec Calico, puis vérifie les politiques réseau et les autorisations d'Istio. |

## Commandes essentielles

À lancer dans un terminal, depuis le dossier du projet, le cluster démarré.

| Commande | Description |
|---|---|
| **`make minikube-up`** | Crée le cluster avec Calico (option `--cni=calico`). |
| **`make netpol-check`** | Lance deux pods temporaires de même identité, l'un avec l'étiquette prévue, l'autre sans. Le premier obtient `HTTP 200`, le second est coupé (`HTTP 000`). |
| **`kubectl -n pme get networkpolicy`** | Liste les douze politiques du namespace `pme`. |
| **`kubectl -n pme describe`**<br>**`networkpolicy allow-postgres`** | Affiche les appelants et les ports autorisés pour PostgreSQL. |
| **`kubectl -n kube-system get pods`**<br>**`-l k8s-app=calico-node`** | Vérifie que l'agent de Calico tourne sur le nœud. |

!!! warning "Attention"
    Le plugin réseau se choisit à la **création** du cluster. Pour passer un cluster existant sous Calico, il faut le
    supprimer avec `minikube delete`, puis relancer `make minikube-up`. Les déploiements sont alors perdus, et
    `make seal` doit être relancé avant `make deploy` (voir [Sealed Secrets](sealed-secrets.md)).

!!! tip "Astuce"
    Si `make netpol-check` affiche `HTTP 200` pour le pod sans étiquette, les politiques ne sont pas appliquées :
    vérifier que le cluster a bien été créé avec `--cni=calico`. En cas de page injoignable après un déploiement,
    `kubectl -n pme delete networkpolicy --all` retire les politiques pour isoler la cause. `make deploy` les recrée.

## Pour aller plus loin

- [Site officiel de Calico](https://www.tigera.io/project-calico/)
- [Documentation de Kubernetes sur les politiques réseau](https://kubernetes.io/fr/docs/concepts/services-networking/network-policies/)
- [Fiche Istio du projet](istio.md)
- [Page Durcissement du projet](../securite/durcissement.md)
