# Sealed Secrets

## Fiche d'identité

| Information | Détail |
|---|---|
| **Rôle** | Chiffre les secrets du projet pour pouvoir les versionner dans Git |
| **Version** | Sealed Secrets 0.41.2 (contrôleur et outil `kubeseal`) |
| **Adresse en local** | aucune |

## Description

Un Secret Kubernetes ne protège rien par lui-même : son contenu est seulement encodé en base64, que n'importe qui peut
décoder. Le versionner dans Git reviendrait donc à publier les mots de passe.

Sealed Secrets règle ce problème. Un contrôleur installé dans le cluster détient une clé privée. L'outil `kubeseal`
chiffre les secrets avec la clé publique correspondante. Le fichier obtenu, un SealedSecret, peut être versionné sans
risque : seul le contrôleur de ce cluster sait le déchiffrer et recréer le Secret.

**Définitions**

- **Secret** : objet Kubernetes qui porte un mot de passe ou une clé, lu par les pods.
- **SealedSecret** : version chiffrée d'un Secret, sûre à publier dans Git.
- **Contrôleur** : programme du cluster qui déchiffre les SealedSecrets.
- **`kubeseal`** : outil en ligne de commande qui chiffre un Secret.
- **base64** : simple encodage de texte, qui ne protège rien.

## Rôle dans le projet

- Il protège les 8 valeurs du secret `pme-secrets` : identifiants et mots de passe de PostgreSQL, NATS, Keycloak et Grafana.
- Le fichier chiffré `k8s/14-pme-secrets-sealed.yaml` est versionné et déployé avec le reste des manifestes.
- Un dépôt public ou une fuite de Git n'expose aucun mot de passe.
- Sans lui, le Secret devrait être recréé à la main depuis un fichier local, hors de Git et hors de la chaîne CI/CD.

## Pourquoi pas Vault

| Critère | Sealed Secrets | HashiCorp Vault |
|---|---|---|
| **Mise en place** | Un contrôleur et un outil en ligne de commande. | Un service à installer, initialiser, desceller et sauvegarder. |
| **Ressources** | Quasi nulles. | Un serveur supplémentaire à exploiter. |
| **Secrets** | Statiques, fixés au chiffrement. | Dynamiques, avec rotation et expiration. |
| **Pratique GitOps** | Natif : le secret chiffré vit dans Git. | Demande un opérateur d'intégration. |
| **Adapté au POC** | Oui. | Disproportionné pour 8 valeurs de démonstration. |

!!! note "À savoir"
    Vault devient pertinent quand il faut faire tourner les secrets, les distribuer à beaucoup d'applications ou les
    auditer. Pour un POC à huit valeurs, Sealed Secrets suffit et reste simple à expliquer.

## Hygiène des secrets sur le poste

| Règle | Application dans le projet |
|---|---|
| **Secrets hors de Git** | `.env` contient les identifiants et les mots de passe. Il est exclu de Git et créé avec les droits `600`. Seul `env.example` est versionné. |
| **Aucune valeur en argument de commande** | `make seal` lit les valeurs dans l'environnement. Elles n'apparaissent ni dans la liste des processus ni dans l'historique. |
| **Fichier temporaire privé** | Il est créé avec les droits `600` et supprimé à la fin de la commande. |
| **Historique du shell** | Avec `HISTCONTROL=ignorespace`, une commande tapée avec un espace au début n'est pas enregistrée. |

Pour activer le dernier réglage, ajouter cette ligne au fichier `~/.bashrc` :

```bash
export HISTCONTROL=ignoreboth
```

`ignoreboth` combine `ignorespace` (commande précédée d'un espace) et `ignoredups` (doublons).

!!! warning "Attention"
    Même avec ces précautions, ne jamais écrire un mot de passe directement dans une commande. Le placer dans
    `.env`, qui doit avoir les droits `600` (`chmod 600 .env`).

## Mise en place

Une seule fois par poste et par cluster :

1. Installer `kubeseal` en version 0.41.2, la même que le contrôleur, depuis la page des versions du dépôt Sealed Secrets.
2. Lancer une commande `make` : le fichier `.env` est créé automatiquement depuis `env.example`, sans jamais être écrasé. Remplacer chaque `CHANGE_ME` par un mot de passe : `make seal` refuse de chiffrer le modèle tel quel.
3. Déployer avec `make deploy`. Au premier lancement, la commande installe le contrôleur et génère `k8s/14-pme-secrets-sealed.yaml`.
4. Versionner `k8s/14-pme-secrets-sealed.yaml`.

Pour changer un mot de passe, modifier `.env` puis lancer `make seal`, qui re-chiffre le fichier. `make deploy` ne le régénère jamais s'il existe.

!!! note "Pourquoi un kustomization séparé"
    Le contrôleur vit dans `kube-system`, alors que le kustomization principal force le namespace `pme` sur toutes ses
    ressources. De plus, la définition `SealedSecret` doit exister avant le fichier chiffré. Le contrôleur est donc
    installé à part, par `make sealed-secrets`, avec sa version épinglée dans `k8s/sealed-secrets/`.

!!! warning "Attention"
    La clé privée vit dans le cluster. Après `minikube delete`, une nouvelle clé est créée : l'ancien fichier chiffré ne
    se déchiffre plus. Relancer alors `make sealed-secrets` puis `make seal`, et versionner le nouveau fichier.

## Fichiers et dossiers principaux

| Fichier ou dossier | Description |
|---|---|
| `k8s/14-pme-secrets-sealed.yaml` | Contient les secrets chiffrés, à versionner. |
| `.env` | Contient les identifiants et les mots de passe, non versionné. |
| `env.example` | Sert de modèle pour `.env`, versionné. |
| `Makefile` | Définit les commandes `sealed-secrets` et `seal`. |
| `k8s/kustomization.yaml` | Ajoute le SealedSecret aux manifestes déployés. |
| `k8s/sealed-secrets/kustomization.yaml` | Épingle la version du contrôleur, installé séparément. |

## Commandes essentielles

| Commande | Description |
|---|---|
| `make deploy` | Déploie l'application. Génère le fichier chiffré s'il manque. |
| `make seal` | Re-chiffre `.env` après un changement de secret. |
| `make sealed-secrets` | Installe le contrôleur seul (fait aussi par `seal` s'il manque). |
| `kubectl -n pme get secret pme-secrets` | Vérifie que le contrôleur a recréé le Secret. |
| `kubectl -n pme get sealedsecret` | Affiche l'état du SealedSecret. |

## Pour aller plus loin

- [Dépôt de Sealed Secrets](https://github.com/bitnami-labs/sealed-secrets)
- [Fiche Minikube du projet](minikube.md)
