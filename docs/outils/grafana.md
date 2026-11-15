# Grafana

## Fiche d'identité

| Information | Détail |
|---|---|
| **Rôle** | Rassemble mesures et logs dans des tableaux de bord, pour voir d'un coup d'œil l'état de la plateforme |
| **Version** | Grafana 12.4.13 |
| **Adresse en local** | <https://grafana.localhost> |

## Description

Grafana est un outil open source de **visualisation**. Il ne stocke aucune mesure : il interroge des **sources de
données** et transforme leurs réponses en graphiques, regroupés dans des **tableaux de bord**.

**Pourquoi un outil d'affichage séparé ?**
[Prometheus](prometheus.md) sait déjà tracer une courbe, et [Loki](loki.md) renvoyer des lignes de log. Mais
diagnostiquer un incident suppose de croiser les deux, au même instant : une hausse des erreurs, puis les lignes
écrites à ce moment-là. Grafana réunit ces sources dans une même page, avec la même période affichée, ce qui évite de
passer d'un outil à l'autre en recopiant des horaires.

**Deux tableaux de bord, chargés au démarrage.**
Les tableaux de bord ne sont pas construits à la main dans l'interface : ils sont décrits dans des fichiers du dépôt
et chargés automatiquement au démarrage. Cette pratique, appelée **provisionnement**, garantit que chacun voit les
mêmes écrans, et qu'un cluster recréé les retrouve à l'identique.

**Ce que montre chaque écran.**
Le tableau « Services » répond à la question « est-ce que tout va bien ? » :

| Panneau | Ce qu'il montre |
|---|---|
| **État des cibles** | Les services qui répondent, et ceux qui ne répondent plus. |
| **Requêtes HTTP par seconde** | Le trafic reçu, par service. |
| **Durée des requêtes (centile 95)** | La durée en dessous de laquelle se situent 95 % des réponses. |
| **Réponses en erreur par seconde** | Les erreurs 4xx, dues aux demandes, et 5xx, dues aux services. |
| **Processeur et mémoire** | Les ressources consommées par chaque service. |
| **Retard de la boucle d'exécution** | Un retard qui grimpe signale un service saturé. |

Le tableau « Logs » répond à la question suivante, « que s'est-il passé ? » : nombre de lignes écrites, lignes en
erreur et en alerte, répartition par service, et les cent dernières lignes, filtrables par service et par mot
recherché.

**Les deux écrans partagent la même période.**
Changer l'intervalle affiché sur l'un le change sur l'autre. C'est ce qui permet de passer d'une courbe anormale aux
logs correspondants sans rien ressaisir.

```d2
vars: {
  d2-config: {
    layout-engine: elk
    theme-id: 5
    pad: 8
  }
}
direction: down

# Mise en forme commune : texte lisible à la largeur de la page, angles arrondis
classes: {
  boite: {
    style: {
      font-size: 24
      border-radius: 12
    }
  }
}

services: "API et modération\n/metrics et logs" {class: boite}

collecte: "Collecte" {
  style.font-size: 22
  prometheus: "Prometheus\nmesures chiffrées" {class: boite}
  alloy: "Alloy\nramasse les logs" {class: boite}
  loki: "Loki\nstocke les logs" {class: boite}
  alloy -> loki
}

grafana: "Grafana\nn'écrit rien, interroge" {class: boite}

ecrans: "Tableaux de bord" {
  style.font-size: 22
  pme: "Services\nest-ce que tout va bien ?" {class: boite}
  logs: "Logs\nque s'est-il passé ?" {class: boite}
}

services -> collecte.prometheus
services -> collecte.alloy
collecte.prometheus -> grafana: source de données
collecte.loki -> grafana: source de données
grafana -> ecrans.pme
grafana -> ecrans.logs
ecrans.pme <-> ecrans.logs: même période affichée
```

**Définitions**

| Terme | Définition |
|---|---|
| **Centile 95** | Durée en dessous de laquelle se situent 95 % des réponses. Plus représentative qu'une moyenne. |
| **Panneau** | Un graphique ou un indicateur à l'intérieur d'un tableau de bord. |
| **Provisionnement** | Chargement automatique de la configuration au démarrage, à partir de fichiers versionnés. |
| **Source de données** | Service que Grafana interroge pour obtenir mesures ou logs. |
| **Tableau de bord** | Page qui regroupe plusieurs panneaux sur un même sujet. |

## Rôle dans le projet

- Il affiche l'état de la plateforme : trafic, durées de réponse, erreurs, ressources consommées.
- Il affiche les logs collectés par [Alloy](alloy.md) et conservés par Loki.
- Il relie les deux lectures : une anomalie repérée sur une courbe se confirme dans les logs de la même période.
- Il charge ses sources de données et ses tableaux de bord au démarrage, à partir de fichiers versionnés.
- Il conserve ses propres réglages dans la base `grafana` de [PostgreSQL](postgresql.md), par une connexion chiffrée.
- Il demande une connexion, contrairement aux interfaces de Prometheus et d'Alloy.
- Sans lui, les mesures restent consultables dans Prometheus, mais sans vue d'ensemble ni accès aux logs.

Ses sources de données sont les suivantes :

| Source | Contenu | Conservation |
|---|---|---|
| **Prometheus** | Les mesures de fonctionnement des services. | 6 heures |
| **Loki** | Les logs de tous les composants. | 24 heures |

!!! note "À savoir"
    Les courbes sont tracées par exemplaire : la légende indique le service et l'adresse du pod. Après un
    redéploiement, les anciens exemplaires restent visibles jusqu'à la fin de la période affichée, quinze minutes par
    défaut. Ce n'est pas une anomalie.

## Fichiers et dossiers principaux

| Fichier ou dossier | Description |
|---|---|
| **`k8s/10-grafana.yaml`** | Déploie Grafana dans le cluster. |
| **`k8s/config/grafana-datasource.yml`** | Déclare Prometheus comme source de données. |
| **`k8s/config/grafana-datasource-loki.yml`** | Déclare Loki comme source de données. |
| **`k8s/config/grafana-dashboards.yml`** | Indique à Grafana où lire les tableaux de bord. |
| **`k8s/config/grafana-dashboard-pme.json`** | Décrit le tableau de bord « Services ». |
| **`k8s/config/grafana-dashboard-logs.json`** | Décrit le tableau de bord « Logs ». |
| **`k8s/config/postgres-init.sh`** | Crée à la première initialisation du volume la base de Grafana et son compte `pme_grafana`. |
| **`.env`** | Contient l'identifiant et le mot de passe de connexion. Ce fichier est exclu de Git. |

## Commandes essentielles

À lancer dans un terminal, depuis le dossier du projet, le cluster démarré.

| Commande | Description |
|---|---|
| **`make deploy`** | Installe Grafana avec le reste de la plateforme. |
| **`make grafana`** | Ouvre Grafana dans le navigateur. |
| **`make pods`** | Indique si Grafana est prêt. |

!!! warning "Attention"
    Un tableau de bord fourni par le dépôt ne peut pas être enregistré depuis l'interface : la modification serait
    perdue au redémarrage. Pour le faire évoluer, modifier le fichier JSON, puis relancer `make deploy`.

!!! tip "Astuce"
    Les identifiants se définissent dans `.env`, avec `GRAFANA_ADMIN` et `GRAFANA_ADMIN_PASSWORD`. Après un
    changement, relancer `make seal` puis `make deploy` pour que le cluster prenne la nouvelle valeur.

## Pour aller plus loin

- [Site officiel de Grafana](https://grafana.com/)
- [Documentation de Grafana](https://grafana.com/docs/grafana/latest/)
- [Documentation du provisionnement](https://grafana.com/docs/grafana/latest/administration/provisioning/)
