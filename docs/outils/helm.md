# Helm

## Fiche d'identité

| Information | Détail |
|---|---|
| **Version** | 4.3.0 (`HELM_VERSION` dans le `Makefile`) |
| **Rôle** | Installe dans le cluster les composants tiers livrés sous forme de chart : Traefik et les quatre briques d'Istio |
| **Catégorie** | Déploiement |
| **Utilisé par** | `make helm`, `make ingress`, `make istio` |
| **Alternative écartée** | Appliquer à la main les manifestes publiés par chaque projet |
| **Documentation** | [helm.sh/docs](https://helm.sh/docs/) |

## Description

Un composant tiers comme Traefik ne se résume pas à un fichier : il demande un déploiement, un service, des comptes,
des droits, des définitions de ressources personnalisées, et une quinzaine de réglages qui dépendent du cluster
d'accueil. Les recopier à la main, c'est accepter de les tenir à jour à chaque version.

**Le problème : un composant tiers n'est pas un fichier, c'est une famille de fichiers liés.**
Installer Traefik à la main suppose de récupérer une dizaine de manifestes, de vérifier qu'ils correspondent bien
entre eux, puis de recommencer à la version suivante. Rien ne signale qu'un fichier a été oublié : le composant
démarre et se comporte mal.

**La réponse : un chart, c'est-à-dire un paquet paramétrable.**
Un chart rassemble tous les manifestes d'un composant sous forme de gabarits, et expose les réglages que l'on a le
droit de changer. Helm prend le chart, applique les valeurs du projet et produit les manifestes finaux. Le projet ne
versionne donc que ses propres valeurs — `k8s/traefik/values.yaml`, `k8s/istio/*.yaml` — et non les centaines de
lignes générées.

**La version est épinglée, comme partout dans le projet.**
`TRAEFIK_CHART_VERSION` et `ISTIO_VERSION` figurent en tête du `Makefile`. Une installation lancée aujourd'hui ou dans
six mois pose exactement les mêmes versions : un cluster recréé reproduit la plateforme à l'identique.

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

chart: "Chart publié\ntraefik/traefik, istio/*" {class: boite}
valeurs: "Valeurs du projet\nk8s/traefik/values.yaml" {class: boite}
helm: "Helm\nupgrade --install" {class: boite}
cluster: "Composant installé\ndans son namespace" {class: boite}

chart -> helm
valeurs -> helm
helm -> cluster
```

**Définitions**

| Terme | Définition |
|---|---|
| **Chart** | Paquet qui rassemble les manifestes d'un composant sous forme de gabarits, avec la liste de ses réglages. |
| **Valeurs** | Fichier qui fournit les réglages d'un chart pour une installation précise (`values.yaml`). |
| **Release** | Une installation nommée d'un chart dans un cluster. `traefik` et `istiod` en sont deux. |
| **Dépôt de charts** | Serveur qui publie des charts, ajouté par `helm repo add`. |

## Rôle dans le projet

- Il installe Traefik, l'entrée unique de la plateforme, avec les réglages de `k8s/traefik/values.yaml` : redirection
  HTTP vers HTTPS, ports du nœud, log d'accès.
- Il installe les quatre briques d'Istio dans l'ordre : `base` (définitions des ressources), `istiod` (plan de
  contrôle), `cni` (agent par nœud) et `ztunnel` (proxy qui chiffre).
- Il sert aussi bien à installer qu'à mettre à jour : `helm upgrade --install` fait l'un ou l'autre selon l'état du
  cluster, ce qui permet de relancer `make ingress` ou `make istio` sans précaution.
- Il n'intervient **pas** sur les composants du projet lui-même : ceux-là sont décrits dans `k8s/` et appliqués par
  [Kustomize](kustomize.md). Helm ne s'occupe que du tiers.

!!! note "À savoir"
    L'option `--wait` est utilisée partout. Sans elle, la commande rendrait la main avant que le composant soit prêt,
    et un `make deploy` lancé dans la foulée échouerait : les ressources Traefik (`Middleware`) ou les identités
    d'Istio n'existeraient pas encore.

## Fichiers et dossiers principaux

| Fichier ou dossier | Description |
|---|---|
| **`k8s/traefik/values.yaml`** | Les réglages de Traefik : ports, redirection, log d'accès, plugin de validation des jetons, stratégie de mise à jour. |
| **`k8s/istio/istiod-values.yaml`** | Les réglages du plan de contrôle d'Istio. |
| **`k8s/istio/cni-values.yaml`** | Les réglages de l'agent réseau par nœud. |
| **`k8s/istio/ztunnel-values.yaml`** | Les réglages du proxy qui chiffre les échanges. |
| **`Makefile`** | `HELM_VERSION`, `TRAEFIK_CHART_VERSION`, `ISTIO_VERSION` et les cibles qui appellent Helm. |

## Commandes essentielles

À lancer dans un terminal, depuis le dossier du projet.

| Commande | Description |
|---|---|
| **`make helm`** | Installe Helm sur l'ordinateur s'il est absent. Demande le mot de passe administrateur. |
| **`make ingress`** | Installe ou met à jour Traefik dans son namespace. |
| **`make istio`** | Installe ou met à jour les quatre briques d'Istio. |
| **`helm list -A`** | Liste les installations présentes dans le cluster, tous namespaces confondus. |
| **`helm search repo istio/istiod --versions`** | Affiche les versions disponibles d'un chart. |

!!! warning "Attention"
    `make istio` doit être lancé **après** `make ingress` : il enrôle le namespace de Traefik dans le maillage. Sans
    cet enrôlement, l'ingress ne peut plus joindre les services, car le namespace `pme` refuse les connexions qui ne
    viennent pas du maillage.

!!! tip "Astuce"
    Pour voir ce qu'un chart produira sans rien installer, ajouter `--dry-run --debug` à la commande `helm upgrade`.
    Les manifestes finaux s'affichent, valeurs du projet appliquées : c'est le moyen le plus rapide de vérifier qu'un
    réglage de `values.yaml` est bien pris en compte.

## Pour aller plus loin

- [Documentation de Helm](https://helm.sh/docs/)
- [Chart de Traefik](https://github.com/traefik/traefik-helm-chart)
- [Charts d'Istio](https://istio.io/latest/docs/setup/install/helm/)
- [Kustomize, pour les manifestes du projet](kustomize.md)
