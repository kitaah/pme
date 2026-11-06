# metrics-server

## Fiche d'identité

| Information | Détail |
|---|---|
| **Rôle** | Mesure la charge des pods pour que le cluster ajuste leur nombre automatiquement |
| **Version** | Addon « metrics-server » de Minikube |
| **Adresse en local** | Aucune interface : il travaille dans le cluster |

## Description

metrics-server est un composant libre de Kubernetes. Il relève l'utilisation du processeur et de la mémoire de chaque
pod. Il met ces mesures à la disposition du cluster. Un autoscaler s'en sert pour augmenter ou réduire le nombre de
pods d'une application selon la charge.

**Définitions**

- **Pod** : plus petite unité qui fait tourner une application dans le cluster.
- **Réplica** : copie d'un pod. Plusieurs réplicas se partagent les requêtes reçues.
- **Autoscaler (HPA)** : ressource qui ajuste le nombre de réplicas selon la charge mesurée.
- **PodDisruptionBudget** : règle qui garde un nombre minimal de pods disponibles pendant une maintenance.
- **Service sans adresse (headless)** : service dont le nom DNS renvoie l'adresse de chaque pod, au lieu d'une adresse unique.

## Rôle dans le projet

- Il fournit à l'autoscaler la charge de l'API, de la modération et du front.
- Chaque application tourne avec au moins 2 pods, et jusqu'à 4 quand la charge dépasse 70 % du processeur demandé.
- Le PodDisruptionBudget garde au moins un pod disponible pendant une mise à jour ou une maintenance.
- Sans lui, l'autoscaler affiche `<unknown>` et le nombre de pods ne change jamais.

## Fichiers et dossiers principaux

| Fichier ou dossier | Description |
|---|---|
| `k8s/11-autoscaling.yaml` | Déclare l'autoscaler et le budget de disponibilité de chaque application. |
| `k8s/04-api.yaml` | Décrit l'API, avec son service sans adresse. |
| `k8s/05-moderation.yaml` | Décrit la modération, avec son service sans adresse. |
| `k8s/config/prometheus.yml` | Interroge chaque pod séparément pour ses mesures. |
| `Makefile` | Contient les commandes d'activation et de suivi. |

## Commandes essentielles

À lancer dans un terminal, depuis le dossier du projet, Minikube démarré.

| Commande | Description |
|---|---|
| `make metrics-server` | Active l'addon et attend qu'il soit prêt. |
| `make hpa` | Suit la charge, la cible et le nombre de pods. |
| `make pods` | Affiche tous les pods et leur état. |

!!! tip "Astuce"
    `make minikube-up` active déjà l'addon. Sur un cluster existant, `make metrics-server` suffit, sans le recréer.

!!! tip "Astuce"
    Les premières mesures arrivent environ une minute après l'activation. Pendant ce temps, `make hpa` affiche
    `<unknown>` : c'est normal.

!!! note "À savoir"
    La limite de débit de l'API est comptée en mémoire dans chaque pod. Avec plusieurs pods, la limite effective est
    multipliée par leur nombre. Un compteur partagé (par exemple Redis) la rendrait exacte.

!!! note "À savoir"
    PostgreSQL, NATS et Keycloak restent à un seul pod : ils ne sont pas répliqués dans le projet.

## Pour aller plus loin

- [Documentation de Kubernetes sur l'autoscaler horizontal](https://kubernetes.io/fr/docs/tasks/run-application/horizontal-pod-autoscale/)
- [Documentation de Kubernetes sur les budgets de disponibilité](https://kubernetes.io/fr/docs/tasks/run-application/configure-pdb/)
