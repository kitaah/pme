# Prometheus

## Fiche d'identité

| Information | Détail |
|---|---|
| **Rôle** | Relève et conserve les mesures de fonctionnement des services : trafic, durées, erreurs, ressources |
| **Version** | Prometheus 3.13.5, version à support long |
| **Adresse en local** | <https://prometheus.localhost> |

## Description

Prometheus est un outil open source de **supervision**. Il relève à intervalle régulier des **mesures** auprès des
services, les conserve avec leur date, et permet de les interroger.

**Mesurer, pour savoir avant les utilisateurs.**
Sans mesure, un problème se découvre quand quelqu'un se plaint. Avec des mesures, une dégradation se voit à l'avance :
les réponses s'allongent, les erreurs augmentent, la mémoire grimpe. Prometheus répond à des questions précises :
combien de requêtes par seconde, quelle durée de réponse, quelle proportion d'erreurs, et depuis quand.

**C'est Prometheus qui vient chercher les mesures.**
Les applications n'envoient rien : chacune publie l'état de ses compteurs à une adresse dédiée, et Prometheus les
interroge toutes les quinze secondes. Ce fonctionnement, appelé **collecte active**, a deux avantages. Une application
ne sait pas si elle est supervisée, ce qui évite d'y mêler une configuration de supervision. Et une cible qui ne
répond plus est immédiatement repérée comme indisponible, alors qu'un service qui aurait cessé d'émettre passerait
inaperçu.

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

prometheus: "Prometheus\nrelève toutes les 15 s\nconserve 6 heures" {class: boite}

cibles: "Cibles, un exemplaire à la fois" {
  class: boite
  api: "Pods de l'API\n/api/metrics" {class: boite}
  moderation: "Pods de la modération\n/api/metrics" {class: boite}
}

grafana: "Grafana\naffiche les courbes" {class: boite}

prometheus -> cibles: interroge
prometheus -> grafana: fournit
```

**Chaque exemplaire est interrogé séparément.**
Une application fonctionne en plusieurs exemplaires. Prometheus les interroge un par un, et relit la liste toutes les
trente secondes pour suivre les ajouts et les retraits décidés par l'autoscaler. S'il passait par l'adresse commune du
service, chaque relevé tomberait sur un exemplaire différent et les compteurs se mélangeraient, produisant des
courbes incohérentes.

**Les mesures ne sortent pas du cluster.**
L'adresse qui publie les mesures n'est pas exposée par l'[ingress](ingress-nginx.md) : seul Prometheus, à l'intérieur
du cluster, peut la lire. Ces pages révéleraient sinon le détail du fonctionnement interne de la plateforme.

**Définitions**

| Terme | Définition |
|---|---|
| **Centile 95** | Durée en dessous de laquelle se situent 95 % des réponses. Plus représentative qu'une moyenne, que quelques valeurs extrêmes faussent. |
| **Cible** | Service interrogé par Prometheus. Elle est indiquée comme disponible tant qu'elle répond. |
| **Collecte** | Interrogation d'une cible pour lire l'état de ses compteurs. |
| **Histogramme** | Mesure qui répartit des durées par tranches, ce qui permet de calculer des centiles. |
| **Mesure** | Valeur numérique qui décrit le fonctionnement d'un service, par exemple le nombre de requêtes reçues. |
| **PromQL** | Langage de requête de Prometheus. |
| **Rétention** | Durée pendant laquelle les mesures sont conservées. |
| **Série** | Suite de valeurs d'une même mesure dans le temps, pour une combinaison d'étiquettes donnée. |

## Rôle dans le projet

- Il relève les mesures de l'API et du service de modération toutes les quinze secondes, exemplaire par exemplaire.
- Il se surveille lui-même : sa propre ligne dans la page des cibles confirme que la collecte fonctionne.
- Il conserve les mesures pendant six heures, ce qui suffit à analyser un test de charge ou un incident en séance.
- Il alimente les tableaux de bord de [Grafana](grafana.md).
- Il rend visible l'état du disjoncteur de la base (voir [opossum](opossum.md)).
- Sans lui, les graphiques de Grafana restent vides et aucune dégradation ne se repère avant la plainte d'un
  utilisateur.

Les mesures principales sont les suivantes :

| Mesure | Ce qu'elle indique |
|---|---|
| `http_request_duration_seconds` | Durée des requêtes, par méthode, route et code de réponse. Elle sert aussi à compter les requêtes et les erreurs. |
| `circuit_breaker_state` | État du disjoncteur devant PostgreSQL : fermé, semi-ouvert ou ouvert. |
| `nodejs_eventloop_lag_seconds` | Retard de la boucle d'exécution de Node : il révèle un service saturé. |
| `process_resident_memory_bytes` | Mémoire occupée par le service. |
| `up` | Disponibilité de chaque cible, relevée à chaque collecte. |

!!! note "À savoir"
    L'étiquette `route` enregistre le modèle de la route, par exemple `/api/v1/listings`, et jamais l'adresse réelle
    appelée. Sans cette précaution, chaque identifiant d'annonce créerait une série distincte et la mémoire de
    Prometheus croîtrait sans fin.

## Fichiers et dossiers principaux

| Fichier ou dossier | Description |
|---|---|
| `k8s/09-prometheus.yaml` | Déploie Prometheus dans le cluster et fixe sa durée de conservation. |
| `k8s/config/prometheus.yml` | Liste les cibles à interroger et la fréquence de collecte. |
| `api/src/metrics/metrics.ts` | Définit les mesures de l'API et chronomètre chaque requête. |
| `api/src/metrics/metrics.controller.ts` | Publie les mesures de l'API sur le chemin `/api/metrics`. |
| `moderation-service/src/metrics/metrics.ts` | Définit les mesures du service de modération. |
| `k8s/08-ingress.yaml` | N'expose que `/api/v1` : les mesures restent internes au cluster. |

## Commandes essentielles

À lancer dans un terminal, depuis le dossier du projet, le cluster démarré.

| Commande | Description |
|---|---|
| `make deploy` | Installe Prometheus avec le reste de la plateforme. |
| `make prometheus` | Ouvre la page des cibles dans le navigateur. |
| `make grafana` | Ouvre les tableaux de bord construits à partir de ces mesures. |
| `make pods` | Indique si Prometheus est prêt. |

!!! warning "Attention"
    Les mesures ne sont pas écrites sur un volume persistant : elles disparaissent au redémarrage du conteneur. Pour
    conserver un résultat de test de charge, exporter le graphique ou relever les valeurs avant de redéployer.

!!! tip "Astuce"
    La page des cibles est le premier endroit à consulter en cas de graphique vide : elle indique, pour chaque
    exemplaire, s'il répond et quand il a été interrogé pour la dernière fois.

## Pour aller plus loin

- [Site officiel de Prometheus](https://prometheus.io/)
- [Documentation de Prometheus](https://prometheus.io/docs/introduction/overview/)
- [Documentation de PromQL](https://prometheus.io/docs/prometheus/latest/querying/basics/)
