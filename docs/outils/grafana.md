# Grafana

## Fiche d'identité

| Information | Détail |
|---|---|
| **Rôle** | Affiche les mesures des services sous forme de tableaux de bord |
| **Version** | Grafana 11.3.1 |
| **Adresse en local** | <http://grafana.localhost> |

## Description

Grafana est un outil libre de visualisation. Il se connecte à une source de données, comme Prometheus. Il transforme
les mesures en graphiques regroupés dans des tableaux de bord. Il s'utilise dans un navigateur et demande une
connexion par identifiant et mot de passe. Il enregistre ses propres réglages dans une base de données.

**Définitions**

- **Tableau de bord** : page qui regroupe plusieurs graphiques sur un même sujet.
- **Panneau** : un graphique ou un indicateur d'un tableau de bord.
- **Source de données** : service que Grafana interroge pour obtenir les mesures.
- **Provisionnement** : chargement automatique de la configuration au démarrage, sans saisie dans l'interface.
- **Percentile 95** : durée en dessous de laquelle se situent 95 % des réponses.

## Rôle dans le projet

- Il affiche l'état des services, le nombre de requêtes par route et la durée des réponses.
- Il affiche les erreurs 4xx et 5xx, l'usage du processeur et de la mémoire.
- Il lit les mesures dans Prometheus.
- Il charge son tableau de bord et sa source de données au démarrage.
- Il enregistre ses réglages dans la base `grafana` de PostgreSQL.
- Sans lui, les mesures restent consultables dans Prometheus, mais sans graphiques.

## Fichiers et dossiers principaux

| Fichier ou dossier | Description |
|---|---|
| `k8s/10-grafana.yaml` | Déploie Grafana dans Minikube. |
| `k8s/config/grafana-datasource.yml` | Déclare Prometheus comme source de données. |
| `k8s/config/grafana-dashboards.yml` | Indique à Grafana où lire les tableaux de bord. |
| `k8s/config/grafana-dashboard-pme.json` | Décrit le tableau de bord des services. |
| `k8s/config/postgres-init.sh` | Crée la base de Grafana au premier démarrage. |
| `.env` | Contient l'identifiant et le mot de passe de connexion. |

## Commandes essentielles

À lancer dans un terminal, depuis le dossier du projet, Minikube démarré.

| Commande | Description |
|---|---|
| `make deploy` | Installe Grafana avec le reste de la plateforme. |
| `make grafana` | Ouvre Grafana dans le navigateur. |
| `make create-grafana-db` | Crée la base de Grafana sur un cluster déjà installé. |
| `make pods` | Indique si Grafana est prêt. |

!!! tip "Astuce"
Les identifiants se définissent dans le fichier `.env`, avec `GRAFANA_ADMIN` et `GRAFANA_ADMIN_PASSWORD`. Après un
changement, relancer `make deploy`.

!!! note "À savoir"
Le tableau de bord fourni ne peut pas être enregistré depuis l'interface. Pour le modifier, éditer le fichier JSON,
puis lancer `make deploy`.

## Pour aller plus loin

- [Site officiel de Grafana](https://grafana.com/)
- [Documentation officielle](https://grafana.com/docs/grafana/latest/)
- [Documentation du provisionnement](https://grafana.com/docs/grafana/latest/administration/provisioning/)