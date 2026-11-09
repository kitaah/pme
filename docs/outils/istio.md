# Istio

## Fiche d'identité

| Information | Détail |
|---|---|
| **Rôle** | Chiffre les échanges entre les pods du cluster et donne une identité à chacun |
| **Version** | Istio 1.30.0, en mode ambient |
| **Installation** | Quatre charts Helm, lancés par `make istio` |
| **Prérequis** | Limite `inotify` de l'ordinateur d'au moins 1024 instances, relevée par `make inotify` |
| **Adresse en local** | Aucune interface : il travaille à l'intérieur du cluster |

## Description

Istio est un **maillage de services** (*service mesh*) open source. Il s'insère entre les applications d'un cluster
Kubernetes pour chiffrer et contrôler leurs échanges, sans modifier leur code.

**Le problème : le trafic interne d'un cluster circule en clair.**
Dans un cluster, les pods se parlent en HTTP simple, comme les vues d'un même programme. Quiconque prend le contrôle
d'un pod voit alors passer les échanges des autres. Chiffrer chaque service un par un demande de gérer des certificats
dans chaque application. Un maillage de services fait ce travail à leur place.

**Le mTLS : chaque côté prouve son identité.**
Le **mTLS** (TLS mutuel) chiffre une connexion, comme le TLS d'HTTPS. Mais en plus, le serveur et le client présentent
chacun un certificat. Une application ne se contente donc plus de savoir qu'elle parle à quelqu'un : elle sait à qui.
Istio donne à chaque pod une **identité** (au format SPIFFE), émise par son plan de contrôle, **istiod**.

**Le mode ambient : aucun proxy ajouté dans les pods.**
Historiquement, un maillage ajoutait un conteneur proxy dans chaque pod. Cela coûte de la mémoire et oblige à
redémarrer les pods. Le mode ambient évite cela : un petit proxy par nœud, **ztunnel**, intercepte les connexions des pods
du maillage et les chiffre. Les pods ne changent pas. Un agent par nœud, **istio-cni**, redirige leur trafic vers ztunnel.

```d2
vars: {
  d2-config: {
    layout-engine: elk
    theme-id: 5
    pad: 8
  }
}
direction: right

classes: {
  boite: {
    style: {
      font-size: 24
      border-radius: 12
    }
  }
}

a: "Pod A\nHTTP simple" {class: boite}
za: "ztunnel\ndu nœud" {class: boite}
zb: "ztunnel\ndu nœud" {class: boite}
b: "Pod B\nHTTP simple" {class: boite}

a -> za: "clair"
za -> zb: "mTLS"
zb -> b: "clair"
```

**Un namespace entre dans le maillage par un label.**
Le projet enrôle le namespace `pme` avec le label `istio.io/dataplane-mode: ambient`. Le namespace de Traefik reçoit le
même label, sans quoi l'ingress ne pourrait plus joindre les services. Le mode **strict** (`PeerAuthentication`) refuse
ensuite toute connexion qui n'arrive pas en mTLS. Un pod extérieur au maillage ne peut plus appeler les services.

**Une identité par compte de service, donc ici une seule.**
L'identité d'un pod dépend de son compte de service Kubernetes. Les pods du projet utilisent tous le compte `default` :
ils partagent donc la même identité, `spiffe://cluster.local/ns/pme/sa/default`. Le chiffrement n'en souffre pas, mais
le maillage ne distingue pas encore l'API de Prometheus ou d'Adminer. Pour écrire des règles du type « seule l'API peut
joindre PostgreSQL », il faudrait créer un compte de service par composant, puis ajouter des politiques
d'autorisation.

**Ce que le maillage ne change pas.**
Les connexions vers PostgreSQL et NATS étaient déjà chiffrées en TLS par les applications. Elles le restent, et le
maillage ajoute une seconde couche autour d'elles. Le trajet entre le navigateur et l'ingress reste en HTTPS, géré par
[cert-manager](cert-manager.md) et [Traefik](traefik.md). Les certificats d'identité du maillage, eux, ne viennent pas
de cert-manager : istiod les émet et les renouvelle seul, avec une durée de vie courte.

**Définitions**

| Terme | Définition |
|---|---|
| **istio-cni** | Agent installé sur chaque nœud, qui redirige le trafic des pods du maillage vers ztunnel. |
| **istiod** | Plan de contrôle d'Istio. Il émet les certificats d'identité et distribue la configuration. |
| **Maillage de services** | Couche qui chiffre et contrôle les échanges entre les applications d'un cluster. |
| **mTLS** | TLS mutuel : le client et le serveur présentent chacun un certificat. |
| **SPIFFE** | Standard d'identité des programmes. L'identité d'un pod prend la forme `spiffe://cluster.local/ns/pme/sa/default`. |
| **ztunnel** | Proxy installé sur chaque nœud, qui chiffre en mTLS les échanges des pods du maillage. |

## Rôle dans le projet

Istio chiffre le trafic interne qui circulait jusque-là en clair : tous les échanges entre les pods du namespace `pme`,
et ceux de l'ingress vers ces pods. Les journaux de ztunnel montrent par exemple des connexions de Traefik vers l'API et
de Prometheus vers l'API, chacune avec l'identité de sa source et de sa destination. Le mode strict refuse les
connexions de tout pod extérieur au maillage.

Sans lui, ces échanges repassent en HTTP simple. L'application continue de fonctionner, mais la limite « trafic
interne du site en HTTP » du [chiffrement](../securite/chiffrement.md) réapparaît.

## Fichiers et dossiers principaux

| Fichier ou dossier | Description |
|---|---|
| `k8s/istio/` | Réglages des charts Helm : plan de contrôle, agent réseau et ztunnel, avec des ressources réduites pour Minikube. Contient aussi le namespace `istio-system` et le profil seccomp de l'agent réseau. |
| `k8s/namespace.yaml` | Porte le label qui enrôle le namespace `pme` dans le maillage. |
| `k8s/16-mesh-mtls.yaml` | Impose le mode strict : toute connexion hors mTLS est refusée. |
| `Makefile` (cibles `inotify`, `istio`, `istio-scan` et `mesh-check`) | Relève la limite `inotify`, installe le maillage et enrôle Traefik, analyse ses images, puis vérifie le chiffrement. |

## Commandes essentielles

À lancer dans un terminal, depuis le dossier du projet, le cluster démarré et Traefik installé.

| Commande | Description |
|---|---|
| `make inotify` | Relève la limite `inotify` de l'ordinateur si elle est trop basse (mot de passe `sudo` demandé). Lancée automatiquement par `make istio`. |
| `make istio` | Installe Istio en mode ambient et enrôle le namespace de Traefik. |
| `make istio-scan` | Analyse les trois images d'Istio avec Trivy : affiche les failles HIGH, échoue sur une faille CRITICAL corrigeable. |
| `make mesh-check` | Vérifie qu'un pod hors du maillage est refusé et montre des échanges portant des identités. |
| `kubectl -n istio-system get pods` | Affiche le plan de contrôle, l'agent réseau et ztunnel. |
| `kubectl -n istio-system logs ds/ztunnel --tail=500 \| grep src.identity` | Affiche les connexions vues par ztunnel, avec l'identité de la source et de la destination. |

1. `make minikube-up` crée le cluster et installe Istio après Traefik.
2. `kubectl -n istio-system get pods` : attendre que `ztunnel` soit en `1/1 Running`.
3. `make deploy` déploie la plateforme. Le mode strict suppose Istio installé : la commande échoue sinon.
4. `make mesh-check` confirme que le pod extérieur est refusé. Utiliser ensuite la plateforme (connexion, création
   d'une annonce), puis chercher les identités dans les journaux de ztunnel.

Une connexion chiffrée par le maillage se reconnaît dans ces journaux à l'adresse de destination, qui utilise le port
**15008** (le tunnel entre nœuds), et à des identités de la forme `spiffe://cluster.local/ns/pme/sa/default`. La dernière
ligne affichée par `make mesh-check` ne suffit pas : elle peut ne montrer que l'identité de ztunnel lui-même.

!!! note "À savoir"
Sur un cluster existant, `make istio` suffit, sans le recréer. La commande doit passer avant `make deploy`,
car la règle du mode strict utilise une ressource que seule l'installation d'Istio déclare.

!!! note "Limite `inotify` de l'ordinateur"
Ztunnel surveille ses certificats avec le mécanisme `inotify` de Linux. Minikube partage le noyau de l'ordinateur,
dont la limite par défaut (128 instances) est vite atteinte : ztunnel plante alors avec l'erreur
`Too many open files`. `make inotify` porte la limite à 1024 et la rend permanente dans
`/etc/sysctl.d/99-inotify.conf`. Le réglage concerne Linux ; sous un autre système, il faut ajuster la limite
équivalente à la main.

!!! warning "Ne déployer qu'une fois ztunnel prêt"
`make deploy` enrôle `pme` et applique le mode strict. Si ztunnel n'est pas prêt, les pods de `pme` perdent leur
réseau (le journal d'istio-cni indique `no ztunnel connection`) et l'application cesse de répondre. Pour revenir en
arrière : `kubectl -n pme delete peerauthentication default`, puis
`kubectl label namespace pme istio.io/dataplane-mode-`. Corriger ensuite la cause (voir la limite `inotify`
ci-dessus), et relancer `make deploy`.

!!! warning "Attention"
Istio ajoute trois composants, d'un poids modeste (istiod occupe environ 45 Mo). Si le cluster manque de place, augmenter `MINIKUBE_MEMORY`
dans le `Makefile` avant de recréer le cluster. Un namespace enrôlé en mode strict dont le trafic ne passe pas par
le maillage devient inaccessible : c'est le cas de Traefik s'il n'est pas enrôlé.

## Pour aller plus loin

- [Documentation du mode ambient](https://istio.io/latest/docs/ambient/)
- [Installation du mode ambient avec Helm](https://istio.io/latest/docs/ambient/install/helm/)
- [Fiche Traefik du projet](traefik.md)
- [Page Chiffrement des échanges](../securite/chiffrement.md)