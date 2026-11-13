# metrics-server

## Fiche d'identité

| Information | Détail |
|---|---|
| **Rôle** | Mesure la charge de chaque pod, afin que le cluster ajuste seul le nombre d'exemplaires des applications |
| **Version** | Addon « metrics-server » de Minikube |
| **Adresse en local** | Aucune interface : il travaille à l'intérieur du cluster |

## Description

metrics-server est un composant open source de Kubernetes. Il relève en continu la consommation de processeur et de
mémoire de chaque pod, puis met ces mesures à la disposition du cluster.

**Pourquoi mesurer la charge ?**
Le nombre d'exemplaires d'une application est un compromis. Trop peu, et le service ralentit dès que l'affluence
augmente. Trop, et des ressources sont immobilisées sans servir. Plutôt que de figer ce nombre, Kubernetes l'ajuste
tout seul grâce à l'**autoscaler**, à condition de disposer d'une mesure de la charge. C'est précisément ce que
fournit metrics-server.

**Comment l'ajustement fonctionne.**
Chaque application déclare la quantité de processeur dont elle a besoin. L'autoscaler compare la consommation réelle,
mesurée par metrics-server, à cette quantité demandée. Au-delà de 70 % en moyenne, il ajoute un exemplaire ; en
dessous, il en retire, sans jamais descendre sous le minimum prévu.

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

pods: "Pods en fonctionnement\n2 au minimum" {class: boite}
mesure: "metrics-server\nrelève le processeur" {class: boite}
autoscaler: "Autoscaler\ncompare au seuil de 70 %" {class: boite}

pods -> mesure
mesure -> autoscaler
autoscaler -> pods: "ajoute ou retire\nun exemplaire"
```

**Une mesure n'est pas une supervision.**
metrics-server ne conserve rien : il ne garde que les relevés les plus récents, juste assez pour que l'autoscaler
décide. Pour suivre une courbe dans le temps, c'est [Prometheus](prometheus.md) qui prend le relais. Les deux outils
coexistent sans se recouvrir : l'un sert à décider, l'autre à observer.

**Toutes les applications ne sont pas concernées.**
Seuls le site, l'API et le service de modération disposent de plusieurs exemplaires. Les autres composants, dont
PostgreSQL, NATS et Keycloak, restent à un exemplaire : les répliquer exigerait de traiter le partage de leurs
données, ce qui dépasse le périmètre du POC. La justification de chaque nombre figure plus bas.

**Définitions**

| Terme | Définition |
|---|---|
| **Autoscaler (HPA)** | Ressource Kubernetes qui ajuste le nombre d'exemplaires d'une application selon la charge mesurée. |
| **Exemplaire (réplica)** | Copie d'un pod. Plusieurs exemplaires se partagent les requêtes reçues. |
| **PodDisruptionBudget** | Règle qui garantit un nombre minimal d'exemplaires disponibles pendant une maintenance. |
| **Ressource demandée** | Quantité de processeur ou de mémoire qu'une application déclare nécessaire. Elle sert de référence au calcul du pourcentage. |
| **Service sans adresse** | Service dont le nom renvoie l'adresse de chaque pod, au lieu d'une adresse unique. Il permet d'interroger les exemplaires un par un. |

## Rôle dans le projet

- Il fournit à l'autoscaler la charge réelle du site, de l'API et du service de modération.
- Il rend possible la montée en charge automatique, que les tests de performance mettent à l'épreuve (voir
  [k6](k6.md)).
- Il permet aussi de consulter la consommation d'un pod à un instant donné, utile pour régler les limites de mémoire.
- Sans lui, l'autoscaler affiche une charge inconnue et le nombre d'exemplaires ne bouge jamais.

Les règles d'ajustement sont les suivantes :

| Application | Minimum | Maximum | Seuil de déclenchement | Disponible en maintenance |
|---|---|---|---|---|
| **Site** | 2 | 3 | 70 % du processeur demandé | 1 au minimum |
| **API** | 2 | 4 | 70 % du processeur demandé | 1 au minimum |
| **Service de modération** | 2 | 3 | 70 % du processeur demandé | 1 au minimum |

**Pourquoi ces nombres d'exemplaires ?**
Le **minimum** est le même partout : avec deux exemplaires, un reste en service quand l'autre est remplacé lors d'une
mise à jour, ou quand son pod s'arrête. C'est le seul choix qui relève de la disponibilité. Le **maximum**, lui, suit
le point qui limite réellement chaque application : ajouter des exemplaires au-delà n'apporterait aucun gain.

| Application | Minimum | Maximum | Ce qui fixe le maximum |
|---|---|---|---|
| **API** | 2 | 4 | Chaque exemplaire ouvre jusqu'à 10 connexions à PostgreSQL. Quatre exemplaires en consomment 40 sur les 100 que le serveur accepte, ce qui laisse de la place aux autres composants (voir [PostgreSQL](postgresql.md)). Au-delà, la base serait saturée avant que l'API ne gagne en capacité. |
| **Service de modération** | 2 | 3 | Il ne fait que lire les messages de la file de [NATS](nats.md), dont le débit dépend du travail des modérateurs. Les exemplaires se partagent les messages sans les dupliquer : au-delà de trois, les nouveaux exemplaires attendraient sans rien traiter. |
| **Site (interface)** | 2 | 3 | Il ne sert que des fichiers statiques : un seul exemplaire répond à un grand nombre de visiteurs. Le deuxième assure la disponibilité, et le troisième absorbe un pic, comme la sortie d'un numéro du fanzine. |

Ces valeurs sont des bornes de dimensionnement, fixées d'après le rôle de chaque application. Elles ne résultent pas
d'une mesure sur le cluster : un test de charge mené sur Kubernetes permettrait de les confirmer ou de les ajuster.

**Pourquoi un seuil de 70 % ?**
Un nouvel exemplaire n'est pas utilisable tout de suite : l'autoscaler constate la charge avec un léger retard, puis
Kubernetes crée le pod et attend qu'il soit prêt. Pendant ce délai, les exemplaires existants continuent de répondre. Le
seuil doit donc laisser une marge :

- **Trop haut (90 % par exemple) :** les exemplaires sont presque saturés quand le renfort est demandé, et le service
  ralentit avant son arrivée.
- **Trop bas (50 % par exemple) :** des exemplaires sont ajoutés pour une charge modérée, ce qui immobilise de la
  mémoire et du processeur sur un cluster aux ressources limitées.

70 % est une valeur courante de départ : elle garde environ 30 % de marge pendant la création du renfort. Elle n'a pas
été mesurée sur le projet, et un test de charge sur le cluster permettrait de l'ajuster. À l'inverse, la réduction du
nombre d'exemplaires est volontairement lente : par défaut, l'autoscaler attend 5 minutes de charge basse avant d'en
retirer, pour éviter les va-et-vient.

Les composants à un seul exemplaire se justifient aussi :

| Composant | Exemplaires | Raison |
|---|---|---|
| **PostgreSQL** | 1 | Un seul volume de données, et un seul serveur peut y écrire. Plusieurs exemplaires exigeraient une réplication entre serveurs. |
| **NATS** | 1 | Un seul volume pour les flux JetStream. Plusieurs exemplaires exigeraient un cluster NATS. |
| **Prometheus** et **Loki** | 1 | Un seul volume de mesures ou de journaux. |
| **Keycloak** | 1 | Mode développement, sans partage de sessions entre exemplaires. |
| **Alloy** | 1 | Un second collecteur enverrait chaque journal deux fois à Loki. |
| **Grafana** et **Adminer** | 1 | Outils d'administration, sans enjeu de disponibilité à cette échelle. |

!!! note "À savoir"
La limitation de débit de l'API est comptée dans la mémoire de chaque pod. Avec plusieurs exemplaires, la limite
réellement appliquée est donc multipliée par leur nombre. Un compteur partagé, par exemple dans Redis, la rendrait
exacte : c'est une limite connue du POC, sans conséquence à cette échelle.

## Fichiers et dossiers principaux

| Fichier ou dossier | Description |
|---|---|
| **`k8s/11-autoscaling.yaml`** | Déclare l'autoscaler et le nombre minimal d'exemplaires de chaque application. |
| **`k8s/04-api.yaml`** | Décrit l'API, ses ressources demandées et son service sans adresse. |
| **`k8s/05-moderation.yaml`** | Décrit le service de modération, sur le même principe. |
| **`k8s/config/prometheus.yml`** | Interroge chaque exemplaire séparément pour relever ses mesures. |
| **`Makefile`** | Contient les commandes d'activation et de suivi. |

## Commandes essentielles

À lancer dans un terminal, depuis le dossier du projet, le cluster démarré.

| Commande | Description |
|---|---|
| **`make metrics-server`** | Active l'addon et attend qu'il soit prêt. |
| **`make hpa`** | Affiche la charge mesurée, le seuil visé et le nombre d'exemplaires. |
| **`make pods`** | Affiche tous les pods et leur état. |
| **`kubectl -n pme top pods`** | Affiche la consommation de processeur et de mémoire de chaque pod. |

!!! note "À savoir"
Les premières mesures arrivent environ une minute après l'activation. Pendant ce délai, `make hpa` affiche une
charge inconnue : c'est normal, il n'y a rien à corriger.

!!! warning "Attention"
Sans metrics-server, l'autoscaler ne reçoit aucune mesure : il ne fait ni erreur ni ajustement, et le nombre de
pods reste figé. Une charge qui monte ne déclenche alors aucun renfort.

!!! tip "Astuce"
`make minikube-up` active déjà l'addon. Sur un cluster existant, `make metrics-server` suffit, sans le recréer.

## Pour aller plus loin

- [Documentation de Kubernetes sur l'autoscaler horizontal](https://kubernetes.io/fr/docs/tasks/run-application/horizontal-pod-autoscale/)
- [Documentation de Kubernetes sur les budgets de disponibilité](https://kubernetes.io/fr/docs/tasks/run-application/configure-pdb/)
- [Dépôt de metrics-server](https://github.com/kubernetes-sigs/metrics-server)