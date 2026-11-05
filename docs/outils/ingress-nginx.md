# Ingress-nginx

## Fiche d'identité

| Information | Détail |
|---|---|
| **Rôle** | Reçoit les requêtes web et les dirige vers le bon service du cluster |
| **Version** | Addon « ingress » de Minikube (ingress-nginx) |
| **Adresse en local** | <http://pme.localhost> |

## Description

Ingress-nginx est le contrôleur d'ingress de la communauté Kubernetes. Il s'appuie sur le serveur web NGINX. Il lit les
règles d'ingress déclarées dans le cluster. Il lit le nom d'hôte de chaque requête reçue. Il envoie ensuite la requête
au service qui correspond à ce nom. Un seul point d'entrée suffit alors pour plusieurs services.

**Définitions**

- **Ingress** : règle Kubernetes qui associe un nom d'hôte à un service du cluster.
- **Contrôleur d'ingress** : programme qui applique les règles d'ingress et achemine les requêtes.
- **Nom d'hôte** : adresse lue dans le navigateur, par exemple `keycloak.localhost`.
- **Tunnel** : liaison qui rend l'ingress du cluster accessible depuis l'ordinateur.
- **Fichier hosts** : fichier de l'ordinateur qui associe un nom d'hôte à une adresse IP.

## Rôle dans le projet

- Il est le point d'entrée des interfaces web du cluster.
- Il dirige chaque nom d'hôte vers son service : application, Keycloak, Adminer, Grafana et Prometheus.
- Il évite d'ouvrir un accès séparé pour chaque service.
- Sans lui, chaque interface devrait être jointe par une redirection de port distincte.

## Fichiers et dossiers principaux

| Fichier ou dossier | Description |
|---|---|
| `k8s/08-ingress.yaml` | Déclare les noms d'hôte et les services visés. |
| `k8s/03-keycloak.yaml` | Fixe l'adresse publique de Keycloak. |
| `k8s/config/realm-pme.json` | Liste les adresses de retour autorisées après la connexion. |
| `k8s/config/frontend-config.js` | Indique au front l'adresse de Keycloak. |
| `Makefile` | Contient les noms d'hôte et les commandes de l'ingress. |
| `/etc/hosts` | Associe les noms d'hôte à l'adresse de l'ordinateur. |

## Commandes essentielles

À lancer dans un terminal, depuis le dossier du projet.

| Commande | Description |
|---|---|
| `make minikube-up` | Crée le cluster avec les ports 80 et 443 publiés sur l'ordinateur. |
| `make ingress` | Active l'ingress dans Minikube et attend qu'il soit prêt. |
| `make hosts` | Affiche la ligne à ajouter au fichier hosts de l'ordinateur. |
| `make deploy` | Installe les règles d'ingress avec le reste de la plateforme. |
| `make app` | Ouvre l'application dans le navigateur. |
| `make tunnel` | Redirige le port 80 vers l'ingress, pour un cluster créé sans publication des ports. |

!!! tip "Astuce"
    Le cluster publie les ports 80 et 443 sur l'ordinateur dès sa création. L'ingress est alors joignable sans autre
    commande.

!!! tip "Astuce"
    La commande `make hosts` affiche la ligne à ajouter au fichier hosts. Elle associe les cinq noms à l'adresse
    `127.0.0.1`, celle de l'ordinateur lui-même. Elle s'ajoute une seule fois.

    ```
    127.0.0.1 pme.localhost keycloak.localhost adminer.localhost grafana.localhost prometheus.localhost
    ```

    Le fichier hosts se trouve dans `/etc/hosts` sous Linux et macOS. Sous Windows, il se trouve dans
    `C:\Windows\System32\drivers\etc\hosts`. Il se modifie avec les droits administrateur.

!!! note "À savoir"
    L'adresse de Minikube, donnée par `minikube ip`, n'est pas utilisée. Elle change d'un ordinateur à l'autre. Le
    cluster publie ses ports sur l'ordinateur, donc l'adresse `127.0.0.1` suffit partout.

!!! note "À savoir"
    Les noms d'hôte se terminent par `.localhost`. Les navigateurs les traitent comme des adresses sûres, même en HTTP.
    La connexion avec Keycloak en a besoin. Ils les envoient aussi toujours vers l'ordinateur lui-même (127.0.0.1),
    d'où la publication du port 80 par le cluster.

!!! note "À savoir"
    Le projet ingress-nginx a été arrêté en mars 2026. Il convient à un cluster local. En production, Traefik ou une
    passerelle d'API (API Gateway) prendront sa place.

!!! note "À savoir"
    Les noms d'hôte sont aussi écrits dans la configuration de Keycloak, de l'API et du front. Pour en changer un,
    modifier tous ces fichiers ensemble.

## Pour aller plus loin

- [Documentation d'ingress-nginx](https://kubernetes.github.io/ingress-nginx/)
- [Documentation de Kubernetes sur les ingress](https://kubernetes.io/fr/docs/concepts/services-networking/ingress/)
