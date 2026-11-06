# Minikube

## Fiche d'identité

| Information | Détail |
|---|---|
| **Rôle** | Fait tourner la plateforme dans un cluster Kubernetes local, sur un seul ordinateur |
| **Version** | Minikube 1.39.0 |
| **Adresse en local** | Aucune : les applications sont jointes par l'ingress |

## Description

Minikube est un outil libre. Il crée un cluster Kubernetes local, à l’intérieur de Docker.
Chaque application est fabriquée sous forme d’image Docker, décrite dans un Dockerfile.
Kubernetes lit les manifestes du projet, puis démarre chaque application dans un conteneur.
Il surveille ces conteneurs et les relance s’ils s’arrêtent. Minikube permet ainsi de faire tourner
toute la plateforme sur un ordinateur.

**Définitions**

- **Cluster** : groupe de serveurs reliés entre eux, qui fonctionnent comme un seul système pour exécuter des applications.
- **Conteneur** : environnement isolé qui contient une application et tout ce dont elle a besoin pour fonctionner.
- **Docker** : outil libre qui crée et fait fonctionner des conteneurs sur un ordinateur.
- **Dockerfile** : fichier qui décrit, étape par étape, comment fabriquer une image Docker.
- **Hadolint** : outil libre qui contrôle les Dockerfile avant la fabrication des images, au début de la chaîne CI/CD.
  Il garantit que les images respectent les bonnes pratiques de sécurité et de fiabilité.
- **Image Docker** : modèle figé d’une application, à partir duquel Docker crée des conteneurs.
- **Kubernetes** : système libre qui gère les conteneurs d’un cluster. Il les démarre, les surveille, les relance en cas d’arrêt et répartit la charge entre eux.
- **Manifeste** : fichier de configuration qui décrit ce que Kubernetes doit faire tourner.

## Rôle dans le projet

- Il sert d'orchestrateur : il exécute et supervise tous les composants de la plateforme.
- Il constitue l'environnement d'exécution local de l'équipe, sans serveur ni abonnement à un service cloud.
- Il relance automatiquement un composant qui s'arrête.
- Il repose sur les mêmes concepts que Kubernetes en production, sans en avoir la complexité d'installation.

## Fichiers et dossiers principaux

| Fichier ou dossier | Description |
|---|---|
| `Makefile` | Les commandes pour démarrer le cluster et déployer la plateforme. |
| `k8s/` | Les manifestes : un fichier par composant à déployer. |
| `k8s/kustomization.yaml` | Liste les composants à déployer ensemble. |
| `k8s/namespace.yaml` | Crée l'espace « pme », qui regroupe tous les composants. |
| `k8s/config/` | Les fichiers de configuration fournis aux composants. |
| `api/Dockerfile` | Décrit comment fabriquer l'image de l'API. |
| `moderation-service/Dockerfile` | Décrit comment fabriquer l'image du service de modération. |
| `frontend/Dockerfile` | Décrit comment fabriquer l'image de l'interface. |
| `.hadolint.yaml` | Règle la sévérité des contrôles de Hadolint. |
| `.env` | Contient les mots de passe de démonstration, transmis au cluster sous forme de secret. |

## Commandes essentielles

À lancer dans un terminal, depuis le dossier du projet, Docker démarré.

| Commande | Description |
|---|---|
| `make minikube-up` | Démarre le cluster, publie les ports 80 et 443, active l'ingress et installe cert-manager. |
| `make image` | Construit les images des applications dans le cluster. |
| `make lint-docker` | Repère les erreurs et les mauvaises pratiques dans les Dockerfile, avec Hadolint. |
| `make deploy` | Déploie toute la plateforme. |
| `make pods` | Affiche l'état de chaque composant. |
| `make redeploy` | Applique une modification du code. |
| `make undeploy` | Supprime la plateforme et ses données. |
| `make minikube-down` | Arrête le cluster. |

!!! warning "Attention"
`make undeploy` efface aussi les données (annonces, comptes). À n'utiliser que pour repartir de zéro.

## Pour aller plus loin

- [Site officiel de Minikube](https://minikube.sigs.k8s.io/)
- [Documentation de Kubernetes](https://kubernetes.io/fr/docs/home/)
- [Site officiel de Hadolint](https://github.com/hadolint/hadolint)