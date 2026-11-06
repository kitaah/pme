# Loki

## Fiche d'identité

| Information | Détail |
|---|---|
| **Rôle** | Conserve les journaux des services et permet de les rechercher |
| **Version** | Loki 3.7.1 |
| **Adresse en local** | Aucune, Loki se consulte depuis Grafana |

## Description

Loki est un outil libre de gestion des journaux. Un journal est le texte qu'un service écrit pour raconter ce qu'il
fait. Loki reçoit ces lignes, les enregistre avec leur date et les range par service. Il ne lit pas le texte à
l'avance : il retient seulement les étiquettes de chaque service. Il reste ainsi léger. Il propose le langage LogQL
pour retrouver une ligne.

**Définitions**

- **Journal** : suite de lignes de texte écrites par un service, comme une erreur ou une requête reçue.
- **Étiquette** : mot-clé attaché à un journal pour le retrouver, comme le nom du service.
- **LogQL** : langage de requête de Loki.
- **Rétention** : durée pendant laquelle Loki conserve les journaux.
- **Compactor** : composant de Loki qui supprime les journaux plus anciens que la rétention.

## Rôle dans le projet

- Il conserve les journaux de tous les services de la plateforme.
- Il les conserve pendant 24 heures.
- Il complète Prometheus : Prometheus indique qu'un problème existe, Loki permet d'en lire la cause.
- Il est interrogé par Grafana.
- Sans lui, les journaux restent lisibles avec `make logs-api`, mais seulement pour un service à la fois.

## Fichiers et dossiers principaux

| Fichier ou dossier | Description |
|---|---|
| `k8s/12-loki.yaml` | Déploie Loki dans Minikube. |
| `k8s/config/loki.yml` | Règle le stockage et la durée de conservation. |
| `k8s/config/grafana-datasource-loki.yml` | Déclare Loki comme source de données de Grafana. |
| `k8s/config/grafana-dashboard-logs.json` | Décrit le tableau de bord des journaux. |

## Commandes essentielles

À lancer dans un terminal, depuis le dossier du projet, Minikube démarré.

| Commande | Description |
|---|---|
| `make deploy` | Installe Loki avec le reste de la plateforme. |
| `make grafana` | Ouvre Grafana, où les journaux s'affichent. |
| `make pods` | Indique si Loki est prêt. |

!!! tip "Astuce"
    Dans Grafana, ouvrir « Explore », choisir la source « Loki », puis saisir `{app="pme-api"}` pour afficher les
    journaux de l'API.

!!! note "À savoir"
    Les journaux ne sont pas écrits sur un volume. Ils disparaissent quand le conteneur Loki redémarre.

## Pour aller plus loin

- [Site officiel de Loki](https://grafana.com/oss/loki/)
- [Documentation officielle](https://grafana.com/docs/loki/latest/)
- [Documentation de LogQL](https://grafana.com/docs/loki/latest/query/)
