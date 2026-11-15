# Kustomize

## Fiche d'identité

| Information | Détail |
|---|---|
| **Version** | Celle intégrée à `kubectl` (option `-k`), plus le binaire autonome pour `make lint-k8s` |
| **Rôle** | Assemble les vingt-trois manifestes de `k8s/` en un seul déploiement, applique le namespace et les étiquettes communes, et génère les ConfigMaps à partir des fichiers de configuration |
| **Catégorie** | Déploiement |
| **Utilisé par** | `make deploy`, `make lint-k8s` |
| **Alternative écartée** | Helm pour les composants du projet : des gabarits à trous pour un seul environnement |
| **Documentation** | [kubectl.docs.kubernetes.io/references/kustomize](https://kubectl.docs.kubernetes.io/references/kustomize/) |

## Description

Les composants du projet sont décrits par vingt-trois fichiers dans `k8s/`. Les appliquer un par un, dans le bon
ordre, en répétant le namespace et les étiquettes communes dans chacun, serait aussi fastidieux qu'imprécis.

**Le problème : des manifestes séparés partagent beaucoup de choses.**
Tous appartiennent au namespace `pme`, tous portent l'étiquette `app.kubernetes.io/part-of: pme`, et plusieurs
dépendent de fichiers de configuration — `nats.conf`, `realm-pme.json`, les tableaux de bord Grafana — qu'il faudrait
recopier dans des ConfigMaps à la main. Chaque répétition est une occasion de se tromper.

**La réponse : un fichier d'assemblage, sans gabarit.**
`k8s/kustomization.yaml` liste les manifestes, fixe le namespace, pose l'étiquette commune et déclare les ConfigMaps à
construire depuis `k8s/config/`. Les manifestes restent du YAML Kubernetes lisible tel quel, sans variable ni
accolade : on peut en ouvrir un et comprendre ce qui sera déployé, ce qui n'est pas le cas d'un gabarit Helm.

**Un atout discret : le suffixe de hachage des ConfigMaps.**
Kustomize ajoute à chaque ConfigMap généré un suffixe calculé sur son contenu. Modifier `realm-pme.json` change donc
le nom du ConfigMap, ce qui modifie le pod qui le référence, ce qui déclenche son redémarrage. Sans cela, un
changement de configuration resterait sans effet jusqu'au prochain redémarrage manuel — le genre de piège qui coûte
une demi-heure.

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

manifestes: "k8s/*.yaml\n23 manifestes" {class: boite}
config: "k8s/config/\nfichiers de configuration" {class: boite}
kustomization: "kustomization.yaml\nnamespace, étiquettes, ConfigMaps" {class: boite}
rendu: "Manifestes finaux\nnamespace pme, étiquettes posées" {class: boite}
cluster: "Cluster\nkubectl apply -k" {class: boite}
lint: "kubeconform\nmake lint-k8s" {class: boite}

manifestes -> kustomization
config -> kustomization: ConfigMaps générés\navec suffixe de hachage
kustomization -> rendu
rendu -> cluster
rendu -> lint: validation hors ligne
```

**Définitions**

| Terme | Définition |
|---|---|
| **Kustomization** | Fichier qui décrit l'assemblage : quels manifestes, quel namespace, quelles étiquettes, quels ConfigMaps. |
| **ConfigMap généré** | ConfigMap que Kustomize construit à partir d'un fichier du dépôt, avec un suffixe calculé sur son contenu. |
| **Rendu** | Le YAML final produit par Kustomize, avant envoi au cluster. `kustomize build k8s` l'affiche. |
| **Overlay** | Variante d'un assemblage pour un environnement donné. Le projet n'en a qu'un, il n'en utilise pas. |

## Rôle dans le projet

- Il applique l'ensemble de la plateforme en une commande : `kubectl apply -k k8s/`, derrière `make deploy`.
- Il fixe le namespace `pme` pour toutes les ressources : aucun manifeste ne le répète.
- Il pose l'étiquette `app.kubernetes.io/part-of: pme` sur les ressources et les modèles de pods, sans toucher aux
  sélecteurs, qui sont immuables.
- Il génère treize ConfigMaps depuis `k8s/config/` : configuration de NATS, de Garage, de Prometheus, de Loki, d'Alloy et du front,
  realm et thème de connexion Keycloak, sources de données et tableaux de bord Grafana, script d'initialisation et règles d'accès de
  PostgreSQL.
- Il produit le rendu que `make lint-k8s` envoie à kubeconform : les manifestes sont validés tels qu'ils seront
  déployés, et non tels qu'ils sont écrits.
- Il prépare la chaîne de livraison : `kustomize edit set image pme-api=<registre>/pme-api:<sha>` suffirait à pointer
  vers une image publiée par la pipeline, sans toucher aux manifestes.

!!! note "À savoir"
    Les manifestes sont numérotés — `01-postgres.yaml`, `03-keycloak.yaml`, `04-api.yaml` — dans leur ordre de
    dépendance. Kustomize n'applique pourtant rien dans cet ordre : il envoie tout au cluster d'un coup, et chaque
    composant attend ce dont il a besoin. La numérotation sert à la lecture, pas à l'exécution.

## Fichiers et dossiers principaux

| Fichier ou dossier | Description |
|---|---|
| **`k8s/kustomization.yaml`** | L'assemblage : liste des manifestes, namespace, étiquettes, ConfigMaps, images. |
| **`k8s/*.yaml`** | Les manifestes, numérotés dans leur ordre de dépendance. |
| **`k8s/config/`** | Les fichiers de configuration transformés en ConfigMaps. |

## Commandes essentielles

À lancer dans un terminal, depuis le dossier du projet, le cluster démarré.

| Commande | Description |
|---|---|
| **`make deploy`** | Chiffre les secrets si besoin, puis applique tout l'assemblage. |
| **`make lint-k8s`** | Valide le rendu contre les schémas officiels de Kubernetes. |
| **`kustomize build k8s`** | Affiche le rendu sans rien déployer. |
| **`kubectl apply -k k8s/`** | Ce que `make deploy` lance, sans ses vérifications préalables. |
| **`make undeploy`** | Supprime le namespace `pme` et ses volumes, et attend la fin de la suppression. |

!!! warning "Attention"
    Le namespace est écrit en dur dans `k8s/kustomization.yaml`. La variable `NS` du `Makefile` ne sert qu'aux
    commandes `kubectl` d'observation : la changer ne déploiera pas ailleurs, elle fera seulement regarder dans un
    namespace vide.

!!! tip "Astuce"
    Avant un déploiement qui inquiète, comparer le rendu à ce qui tourne :
    `kustomize build k8s | kubectl diff -f -`. La sortie ne montre que les différences, ce qui est bien plus lisible
    qu'un `apply` suivi d'un `rollout status`.

## Pour aller plus loin

- [Référence de Kustomize](https://kubectl.docs.kubernetes.io/references/kustomize/)
- [Générateurs de ConfigMaps](https://kubectl.docs.kubernetes.io/references/kustomize/kustomization/configmapgenerator/)
- [Helm, pour les composants tiers](helm.md)
- [Architecture de la plateforme](../architecture.md)
