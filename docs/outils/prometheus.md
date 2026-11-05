# Prometheus

## Fiche d'identité

| Information | Détail |
|---|---|
| **Rôle** | Collecte et conserve les mesures de fonctionnement des services |
| **Version** | Prometheus 2.55.1 |
| **Adresse en local** | <http://prometheus.localhost> |

## Description

Prometheus est un outil libre de supervision. Il interroge à intervalle régulier les services à surveiller. Chaque
service répond avec une liste de mesures : nombre de requêtes, durée des réponses, mémoire utilisée. Prometheus
enregistre ces mesures avec leur date. Il propose le langage PromQL pour les interroger.

**Définitions**

- **Mesure** : valeur numérique qui décrit le fonctionnement d'un service, comme le nombre de requêtes reçues.
- **Cible** : service que Prometheus interroge. Elle est dite « UP » quand elle répond.
- **Collecte** : interrogation d'une cible par Prometheus pour lire ses mesures.
- **PromQL** : langage de requête de Prometheus.
- **Histogramme** : mesure qui répartit des durées par tranches, par exemple 5 ms, 10 ms, 25 ms.
- **Rétention** : durée pendant laquelle Prometheus conserve les mesures.

## Rôle dans le projet

- Il collecte les mesures de l'API et du service de modération toutes les 15 secondes.
- Il conserve les mesures pendant 6 heures.
- Il alimente les tableaux de bord de Grafana.
- Il permet de repérer un service arrêté ou des réponses lentes.
- Sans lui, aucune mesure n'est conservée.

## Fichiers et dossiers principaux

| Fichier ou dossier | Description |
|---|---|
| `k8s/09-prometheus.yaml` | Déploie Prometheus dans Minikube. |
| `k8s/config/prometheus.yml` | Liste les cibles à interroger et la fréquence de collecte. |
| `api/src/metrics/metrics.ts` | Définit les mesures de l'API. |
| `api/src/metrics/metrics.controller.ts` | Publie les mesures de l'API sur le chemin `/api/metrics`. |
| `moderation-service/src/metrics/metrics.ts` | Définit les mesures du service de modération. |
| `moderation-service/src/metrics/metrics.controller.ts` | Publie les mesures du service de modération. |
| `frontend/nginx.conf` | Bloque l'accès aux mesures depuis l'extérieur. |

## Commandes essentielles

À lancer dans un terminal, depuis le dossier du projet, Minikube démarré.

| Commande | Description |
|---|---|
| `make deploy` | Installe Prometheus avec le reste de la plateforme. |
| `make prometheus` | Ouvre la page des cibles dans le navigateur. |
| `make pods` | Indique si Prometheus est prêt. |

!!! tip "Astuce"
Dans la page « Graph », saisir `http_request_duration_seconds_count` pour afficher le nombre de requêtes reçues par
chaque service.

!!! note "À savoir"
Les mesures ne sont pas écrites sur un volume. Elles disparaissent quand le conteneur Prometheus redémarre.

## Pour aller plus loin

- [Site officiel de Prometheus](https://prometheus.io/)
- [Documentation officielle](https://prometheus.io/docs/introduction/overview/)
- [Documentation de PromQL](https://prometheus.io/docs/prometheus/latest/querying/basics/)