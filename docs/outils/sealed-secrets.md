# Sealed Secrets

## Fiche d'identité

| Information | Détail |
|---|---|
| **Rôle** | Chiffre les mots de passe du projet pour qu'ils puissent être versionnés dans Git sans risque |
| **Version** | Sealed Secrets 0.41.2, contrôleur et outil `kubeseal` |
| **Adresse en local** | Aucune |

## Description

Sealed Secrets est un outil open source qui résout un problème précis : comment conserver les mots de passe d'une
application à côté de son code, sans les exposer.

**Un Secret Kubernetes ne protège rien.**
Kubernetes range les mots de passe dans des objets appelés **Secrets**. Le nom induit en erreur : leur contenu n'est
pas chiffré, seulement **encodé en base64**, une transformation réversible que n'importe qui peut annuler en une
commande. Versionner un Secret dans Git reviendrait donc à publier les mots de passe en clair.

**Le principe : deux clés, une seule capable de déchiffrer.**
Le contrôleur installé dans le cluster détient une **clé privée**, qu'il ne communique à personne, et publie la
**clé publique** correspondante. L'outil `kubeseal` chiffre les valeurs avec la clé publique. Le fichier obtenu, un
**SealedSecret**, ne peut être déchiffré que par le contrôleur de ce cluster précis. Il peut donc être versionné et
relu par toute l'équipe : sans la clé privée, il reste illisible.

```d2
vars: {
  d2-config: {
    layout-engine: elk
    theme-id: 5
    pad: 8
  }
}
direction: right

# Mise en forme commune : texte lisible à la largeur de la page, angles arrondis
classes: {
  boite: {
    style: {
      font-size: 24
      border-radius: 12
    }
  }
}

env: "Fichier .env\nsur l'ordinateur,\njamais versionné" {class: boite}
scelle: "SealedSecret\nchiffré,\nversionné dans Git" {class: boite}
secret: "Secret du cluster\nlu par les pods" {class: boite}

env -> scelle: "kubeseal\nclé publique"
scelle -> secret: "contrôleur\nclé privée"
```

**Ce que cela change au quotidien.**
Les manifestes du projet sont complets : un développeur qui clone le dépôt et déploie obtient une plateforme qui
fonctionne, mots de passe compris, sans qu'aucun fichier confidentiel n'ait circulé par courriel ou par messagerie.
C'est le principe du **GitOps** : le dépôt décrit l'état attendu du cluster, dans son intégralité.

**Définitions**

| Terme | Définition |
|---|---|
| **base64** | Encodage de texte, lisible par tous, qui ne protège rien. |
| **Clé privée** | Clé qui déchiffre. Elle reste dans le cluster et n'en sort jamais. |
| **Clé publique** | Clé qui chiffre. Elle peut être diffusée sans risque. |
| **Contrôleur** | Programme installé dans le cluster, qui déchiffre les SealedSecrets et recrée les Secrets. |
| **GitOps** | Pratique qui consiste à décrire dans Git l'intégralité de l'état attendu d'un cluster. |
| **`kubeseal`** | Outil en ligne de commande qui chiffre un Secret avec la clé publique du cluster. |
| **SealedSecret** | Version chiffrée d'un Secret, que l'on peut versionner sans risque. |
| **Secret** | Objet Kubernetes qui porte un mot de passe ou une clé, et que les pods peuvent lire. |

## Rôle dans le projet

- Il protège les huit valeurs du secret `pme-secrets` : identifiants et mots de passe de PostgreSQL, NATS, Keycloak et
  Grafana.
- Il permet de versionner le fichier chiffré avec les autres manifestes, et donc de le déployer par la même commande.
- Il garantit qu'une fuite du dépôt n'expose aucun mot de passe.
- Il évite de recréer le Secret à la main sur chaque poste, étape oubliée tôt ou tard.
- Sans lui, les mots de passe vivraient hors de Git, transmis d'une personne à l'autre par des moyens peu sûrs.

Le projet applique par ailleurs quelques règles d'hygiène, qui valent indépendamment de l'outil :

| Règle | Application dans le projet |
|---|---|
| **Les secrets restent hors de Git** | Le fichier `.env` est exclu de Git et créé avec des droits restreints. Seul `env.example` est versionné. |
| **Aucune valeur en argument de commande** | `make seal` lit les valeurs dans l'environnement : elles n'apparaissent ni dans la liste des processus ni dans l'historique du terminal. |
| **Fichier temporaire privé** | Il est créé avec des droits restreints et supprimé à la fin de la commande, même en cas d'interruption. |
| **Historique du terminal** | Le réglage `HISTCONTROL=ignoreboth` dans `~/.bashrc` permet qu'une commande précédée d'un espace ne soit pas enregistrée. |

!!! note "À savoir"
    Vault gère des secrets dynamiques, leur rotation et leur audit, au prix d'un service supplémentaire à installer,
    initialiser, desceller et sauvegarder. Pour huit valeurs fixes de démonstration, Sealed Secrets suffit et tient en
    deux commandes. Vault deviendrait pertinent si les secrets devaient tourner régulièrement ou être distribués à de
    nombreuses applications.

!!! warning "Attention"
    La clé privée vit dans le cluster. Après un `minikube delete`, une nouvelle clé est créée : l'ancien fichier
    chiffré devient indéchiffrable. Il faut alors relancer `make sealed-secrets`, puis `make seal`, et versionner le
    nouveau fichier.

## Fichiers et dossiers principaux

| Fichier ou dossier | Description |
|---|---|
| `k8s/14-pme-secrets-sealed.yaml` | Contient les huit valeurs chiffrées. C'est le fichier versionné. |
| `.env` | Contient les identifiants et les mots de passe en clair. Ce fichier est exclu de Git. |
| `env.example` | Sert de modèle pour `.env`. Il est versionné et ne contient aucune vraie valeur. |
| `k8s/sealed-secrets/kustomization.yaml` | Épingle la version du contrôleur, installé séparément. |
| `k8s/kustomization.yaml` | Ajoute le fichier chiffré aux manifestes déployés. |
| `Makefile` | Définit les commandes `sealed-secrets` et `seal`. |

## Commandes essentielles

À lancer dans un terminal, depuis le dossier du projet.

| Commande | Description |
|---|---|
| `make deploy` | Déploie la plateforme et génère le fichier chiffré s'il manque. |
| `make seal` | Chiffre à nouveau le contenu de `.env` après un changement de mot de passe. |
| `make sealed-secrets` | Installe le contrôleur seul. |
| `kubectl -n pme get secret pme-secrets` | Vérifie que le contrôleur a bien recréé le Secret. |
| `kubectl -n pme get sealedsecret` | Affiche l'état du fichier chiffré. |

La mise en place se fait une fois par poste et par cluster :

1. Installer `kubeseal` en version 0.41.2, la même que le contrôleur.
2. Lancer n'importe quelle commande `make` : le fichier `.env` est créé à partir de `env.example`, sans jamais écraser
   un fichier existant.
3. Remplacer chaque valeur `CHANGE_ME` par un vrai mot de passe. `make seal` refuse de chiffrer le modèle tel quel.
4. Lancer `make deploy`, qui installe le contrôleur et génère le fichier chiffré.
5. Versionner `k8s/14-pme-secrets-sealed.yaml`.

!!! note "À savoir"
    Le contrôleur vit dans un autre namespace que la plateforme, et la définition d'un SealedSecret doit exister avant
    le fichier chiffré. Il est donc installé à part, par `make sealed-secrets`, avec sa version épinglée.

!!! tip "Astuce"
    Pour changer un mot de passe, modifier `.env` puis lancer `make seal`, qui chiffre de nouveau le fichier.
    `make deploy` ne le régénère jamais s'il existe déjà : un fichier à jour n'est donc pas écrasé par mégarde.

## Pour aller plus loin

- [Dépôt de Sealed Secrets](https://github.com/bitnami-labs/sealed-secrets)
- [Documentation de Kubernetes sur les Secrets](https://kubernetes.io/fr/docs/concepts/configuration/secret/)
- [Fiche Minikube du projet](minikube.md)
