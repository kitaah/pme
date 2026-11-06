# Alloy

## Fiche d'identité

| Information | Détail |
|---|---|
| **Rôle** | Lit les journaux des services et les envoie à Loki |
| **Version** | Alloy 1.21.0 |
| **Adresse en local** | <https://alloy.localhost> |

## Description

Alloy est un outil libre de collecte de données de supervision. Il remplace Promtail, l'ancien outil de Loki, qui
n'est plus maintenu. Alloy demande à Kubernetes la liste des services en cours d'exécution. Il lit ensuite leurs
journaux, y ajoute des étiquettes, écarte ceux qui ne servent à rien et les envoie à Loki. Sa configuration décrit cette
chaîne étape par étape.

**Définitions**

- **Collecteur** : outil qui lit des données à la source et les transmet à un autre outil.
- **Étiquette** : mot-clé attaché à un journal pour le retrouver, comme le nom du service.
- **Rôle d'accès** : liste des droits donnés à un outil dans Kubernetes. Celui d'Alloy permet seulement de lire.
- **Sonde** : requête que Kubernetes envoie à un service à intervalles réguliers pour vérifier qu'il fonctionne.
- **Composant** : étape de la chaîne de collecte, comme la découverte des pods, l'ajout d'étiquettes ou l'envoi à Loki.

## Rôle dans le projet

- Il lit les journaux de tous les services de la plateforme.
- Il ajoute à chaque ligne le nom du service et du pod.
- Il écarte les lignes sans intérêt : les sondes de Kubernetes dans les journaux d'Adminer.
- Il envoie les journaux à Loki.
- Il suit seul les nouveaux pods créés par l'autoscaling.
- Son interface web montre l'état de chaque composant et le trajet des journaux. Elle passe par l'ingress.
- Sans lui, Loki ne reçoit aucun journal.

## Fichiers et dossiers principaux

| Fichier ou dossier | Description |
|---|---|
| `k8s/13-alloy.yaml` | Déploie Alloy, lui donne le droit de lire les pods et l'expose par un service. |
| `k8s/08-ingress.yaml` | Rend l'interface accessible sur `alloy.localhost`. |
| `k8s/config/alloy.alloy` | Décrit la chaîne de collecte : lecture, étiquettes, filtrage, envoi. |

## Commandes essentielles

À lancer dans un terminal, depuis le dossier du projet, Minikube démarré.

| Commande | Description |
|---|---|
| `make deploy` | Installe Alloy avec le reste de la plateforme. |
| `make alloy` | Ouvre l'interface d'Alloy dans le navigateur. |
| `make pods` | Indique si Alloy est prêt. |

!!! note "À savoir"
    Alloy est le seul outil de supervision qui a besoin de parler à Kubernetes. Son rôle d'accès est limité au
    namespace du projet, en lecture seule.

!!! note "À savoir"
    Le filtrage se fait à deux endroits. Les sondes du front sont écartées à la source (`access_log off` dans
    `frontend/nginx.conf`). Celles d'Adminer, dont le serveur journalise tout, sont écartées dans `alloy.alloy`, avec une
    règle par cas. Les vraies requêtes d'Adminer, qui arrivent de l'ingress, restent dans Loki.

!!! warning "Attention"
    L'interface d'Alloy n'a pas d'authentification, comme celles de Prometheus et d'Adminer. Elle convient à un poste
    local. En production, elle serait placée derrière une authentification.

## Pour aller plus loin

- [Site officiel d'Alloy](https://grafana.com/oss/alloy-opentelemetry-collector/)
- [Documentation officielle](https://grafana.com/docs/alloy/latest/)
