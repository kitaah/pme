# Loki

## Fiche d'identité

| Information | Détail |
|---|---|
| **Rôle** | Rassemble les journaux de tous les services et permet de les rechercher au même endroit |
| **Version** | Loki 3.7.1 |
| **Adresse en local** | Aucune : Loki se consulte depuis [Grafana](grafana.md) |

## Description

Loki est un outil open source de gestion des **journaux**. Un journal est la suite de lignes qu'un service écrit pour
raconter ce qu'il fait : une requête reçue, une erreur rencontrée, un message traité.

**Pourquoi les rassembler ?**
Lire les journaux d'un service à la fois convient lorsqu'on sait déjà où chercher. Ce n'est plus le cas dès que la
plateforme compte une dizaine de composants, dont certains fonctionnent en plusieurs exemplaires : il faudrait ouvrir
chaque exemplaire pour reconstituer ce qui s'est passé. Loki rassemble toutes les lignes en un seul endroit,
consultable par une recherche unique.

```d2
vars: {
  d2-config: {
    layout-engine: elk
    theme-id: 5
    pad: 8
  }
}
direction: right

# Mise en forme commune : texte lisible à la largeur de la page, angles arrondis
classes: {
  boite: {
    style: {
      font-size: 24
      border-radius: 12
    }
  }
}

pods: "Pods\nécrivent\nleurs journaux" {class: boite}
alloy: "Alloy\nlit et étiquette" {class: boite}
loki: "Loki\nconserve 24 heures" {class: boite}
grafana: "Grafana\nrecherche et affiche" {class: boite}

pods -> alloy
alloy -> loki
loki -> grafana
```

**Il indexe les étiquettes, pas le texte.**
C'est le choix de conception qui distingue Loki des autres outils du domaine. Il n'analyse pas le contenu des lignes à
l'avance : il ne retient que quelques **étiquettes**, comme le nom du service et celui de l'exemplaire, et conserve le
texte tel quel. La recherche se fait donc en deux temps : les étiquettes réduisent d'abord l'ensemble à examiner, puis
le texte est parcouru. L'outil en devient beaucoup plus léger, ce qui lui permet de fonctionner sur un ordinateur, au
prix de recherches plein texte un peu plus lentes.

**Il complète Prometheus, il ne le remplace pas.**
Les deux outils répondent à des questions différentes et se consultent dans cet ordre.
[Prometheus](prometheus.md) montre qu'un problème existe : les erreurs augmentent à 14 h 32. Loki en donne la cause :
les lignes écrites à cet instant précis indiquent que la base ne répondait plus. L'un signale, l'autre explique.

**Définitions**

| Terme | Définition |
|---|---|
| **Compactor** | Composant de Loki qui supprime les journaux plus anciens que la durée de conservation. |
| **Étiquette** | Mot-clé attaché à un journal pour le retrouver, par exemple le nom du service. |
| **Journal** | Suite de lignes de texte écrites par un service pour décrire son activité. |
| **LogQL** | Langage de requête de Loki, proche de PromQL dans sa syntaxe. |
| **Rétention** | Durée pendant laquelle les journaux sont conservés, ici 24 heures. |

## Rôle dans le projet

- Il conserve les journaux de tous les composants de la plateforme pendant 24 heures.
- Il permet de suivre un incident à travers plusieurs services, sans ouvrir chaque exemplaire un par un.
- Il alimente le tableau de bord « Logs » de Grafana, qui filtre par service et par mot recherché.
- Il reçoit ses lignes d'[Alloy](alloy.md), seul composant à lire les journaux des pods.
- Sans lui, les journaux restent lisibles avec `make logs-api`, mais pour un seul service à la fois, et ils
  disparaissent dès qu'un pod est remplacé.

Les étiquettes attachées à chaque ligne sont volontairement peu nombreuses :

| Étiquette | Contenu | Usage |
|---|---|---|
| **`app`** | Nom du service, par exemple `pme-api`. | Filtrer sur un composant. |
| **`pod`** | Nom de l'exemplaire. | Distinguer les exemplaires créés par l'autoscaler. |
| **`container`** | Nom du conteneur dans le pod. | Séparer les conteneurs d'un même pod. |
| **`namespace`** | Toujours `pme`. | Garantir l'origine des lignes. |

!!! note "À savoir"
    Multiplier les étiquettes paraît pratique, mais chaque combinaison crée un ensemble distinct à stocker. Une
    étiquette portant une valeur variable, comme un identifiant d'annonce, ferait croître la mémoire sans limite. La
    règle est donc de n'étiqueter que ce qui sert à filtrer, et de laisser le reste dans le texte.

## Fichiers et dossiers principaux

| Fichier ou dossier | Description |
|---|---|
| **`k8s/12-loki.yaml`** | Déploie Loki dans le cluster. |
| **`k8s/config/loki.yml`** | Règle le stockage et la durée de conservation. |
| **`k8s/config/grafana-datasource-loki.yml`** | Déclare Loki comme source de données de Grafana. |
| **`k8s/config/grafana-dashboard-logs.json`** | Décrit le tableau de bord des journaux. |
| **`k8s/config/alloy.alloy`** | Décrit la chaîne qui alimente Loki. |

## Commandes essentielles

À lancer dans un terminal, depuis le dossier du projet, le cluster démarré.

| Commande | Description |
|---|---|
| **`make deploy`** | Installe Loki avec le reste de la plateforme. |
| **`make grafana`** | Ouvre Grafana, seul moyen de consulter les journaux. |
| **`make alloy`** | Ouvre l'interface d'Alloy, pour vérifier que les journaux sont bien envoyés. |
| **`make pods`** | Indique si Loki est prêt. |

Pour rechercher les journaux d'un service :

1. Ouvrir Grafana avec `make grafana`.
2. Choisir « Explore » dans le menu, puis la source de données « Loki ».
3. Saisir `{app="pme-api"}` pour afficher les journaux de l'API.
4. Ajouter `|= "erreur"` à la suite pour ne garder que les lignes contenant ce mot.

!!! warning "Attention"
    Les journaux ne sont pas écrits sur un volume persistant : ils disparaissent au redémarrage du conteneur. Pour
    conserver la trace d'un incident, copier les lignes utiles avant de redéployer.

!!! tip "Astuce"
    Le tableau de bord « Logs » évite ces requêtes : il propose un menu déroulant par service et un champ de recherche.
    L'onglet « Explore » reste utile pour une recherche inhabituelle.

## Pour aller plus loin

- [Site officiel de Loki](https://grafana.com/oss/loki/)
- [Documentation de Loki](https://grafana.com/docs/loki/latest/)
- [Documentation de LogQL](https://grafana.com/docs/loki/latest/query/)
