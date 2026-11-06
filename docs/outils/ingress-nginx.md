# Ingress-nginx

## Fiche d'identité

| Information | Détail |
|---|---|
| **Rôle** | Reçoit les requêtes web et les dirige vers le bon service du cluster |
| **Version** | Addon « ingress » de Minikube (ingress-nginx) |
| **Adresse en local** | <https://pme.localhost> |

## Description

Ingress-nginx est le contrôleur d'ingress de la communauté Kubernetes. Il s'appuie sur le serveur web NGINX. Il lit les
règles d'ingress déclarées dans le cluster. Il lit le nom d'hôte de chaque requête reçue. Il envoie ensuite la requête
au service qui correspond à ce nom. Il déchiffre aussi les échanges HTTPS, avec un certificat fourni par cert-manager. Un seul point d'entrée suffit alors pour plusieurs services.

**Définitions**

- **Ingress** : règle Kubernetes qui associe un nom d'hôte à un service du cluster.
- **Contrôleur d'ingress** : programme qui applique les règles d'ingress et achemine les requêtes.
- **Nom d'hôte** : adresse lue dans le navigateur, par exemple `keycloak.localhost`.
- **Tunnel** : liaison qui rend l'ingress du cluster accessible depuis l'ordinateur.
- **Terminaison TLS** : l'ingress déchiffre les échanges HTTPS, puis transmet la requête en HTTP aux services.
- **Fichier hosts** : fichier de l'ordinateur qui associe un nom d'hôte à une adresse IP.

## Rôle dans le projet

- Il est le point d'entrée des interfaces web du cluster.
- Il dirige chaque nom d'hôte vers son service, selon le tableau ci-dessous.
- Il chiffre les échanges avec le navigateur et redirige le HTTP vers le HTTPS.
- Il évite d'ouvrir un accès séparé pour chaque service.
- Sans lui, chaque interface devrait être jointe par une redirection de port distincte.

| Adresse | Service | Port | Rôle |
|---|---|---|---|
| <https://pme.localhost> | `pme-frontend` | 8080 | Site React servi par nginx |
| <https://keycloak.localhost> | `keycloak` | 8080 | Connexion et gestion des comptes |
| <https://adminer.localhost> | `adminer` | 8080 | Consultation des bases de données |
| <https://grafana.localhost> | `grafana` | 3000 | Tableaux de bord |
| <https://prometheus.localhost> | `prometheus` | 9090 | Collecte des métriques |

Sur l'adresse de l'application, l'ingress distingue trois chemins. Le chemin `/api/v1/moderation` mène au service de
modération. Le chemin `/api/v1` mène à l'API. Tout le reste mène au site. Les chemins `/api/metrics` et `/api/health`
ne sont pas exposés.

Le chiffrement HTTPS s'arrête à l'ingress. Derrière lui, les échanges restent en HTTP dans le cluster.

## Fichiers et dossiers principaux

| Fichier ou dossier | Description |
|---|---|
| `k8s/08-ingress.yaml` | Déclare les noms d'hôte, les services visés et le certificat. |
| `k8s/08-certificate.yaml` | Demande le certificat des cinq noms d'hôte. |
| `k8s/03-keycloak.yaml` | Fixe l'adresse publique de Keycloak. |
| `k8s/config/realm-pme.json` | Liste les adresses de retour autorisées après la connexion. |
| `k8s/config/frontend-config.js` | Indique au front l'adresse de Keycloak. |
| `Makefile` | Contient les noms d'hôte, les commandes de l'ingress et le réglage de la compression. |
| `/etc/hosts` | Associe les noms d'hôte à l'adresse de l'ordinateur. |

## Commandes essentielles

À lancer dans un terminal, depuis le dossier du projet.

| Commande | Description |
|---|---|
| `make minikube-up` | Crée le cluster avec les ports 80 et 443 publiés sur l'ordinateur. |
| `make ingress` | Active l'ingress dans Minikube, attend qu'il soit prêt et active la compression. |
| `make cert-manager` | Installe cert-manager, qui fournit le certificat HTTPS. |
| `make hosts` | Affiche la ligne à ajouter au fichier hosts de l'ordinateur. |
| `make deploy` | Installe les règles d'ingress et le certificat avec le reste de la plateforme. |
| `make app` | Ouvre l'application dans le navigateur. |
| `make ca-cert` | Écrit l'autorité locale dans `pme-ca.crt`, à importer dans le navigateur. |
| `make tunnel` | Redirige les ports 80 et 443 vers l'ingress, pour un cluster créé sans publication des ports. |

!!! tip "Astuce"
Le cluster publie les ports 80 et 443 sur l'ordinateur dès sa création. L'ingress est alors joignable sans autre
commande. Le port 80 redirige vers le HTTPS sur le port 443.

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
Le certificat est signé par une autorité locale. Le navigateur affiche un avertissement tant que le fichier
`pme-ca.crt` n'est pas importé dans ses réglages. Voir la fiche cert-manager.

!!! note "À savoir"
Les noms d'hôte se terminent par `.localhost`. Les navigateurs les traitent comme des adresses sûres.
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