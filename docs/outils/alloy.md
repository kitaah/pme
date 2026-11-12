# Alloy

## Fiche d'identité

| Information | Détail |
|---|---|
| **Rôle** | Lit les journaux de tous les pods du projet, les étiquette, écarte le bruit et les envoie à Loki |
| **Version** | Alloy 1.21.2 |
| **Adresse en local** | <https://alloy.localhost> |

## Description

Alloy est un **collecteur** open source, publié par Grafana. Il remplace Promtail, l'ancien collecteur de
[Loki](loki.md), qui n'est plus maintenu.

**Pourquoi un collecteur séparé ?**
Les journaux écrits par une application ne vont nulle part d'eux-mêmes : ils restent dans le conteneur et disparaissent
avec lui. Deux solutions existent. La première consiste à modifier chaque application pour qu'elle envoie ses lignes
à Loki ; il faudrait alors adapter tous les composants, y compris ceux que l'équipe n'a pas écrits, comme PostgreSQL
ou Keycloak. La seconde, retenue ici, consiste à placer un collecteur à côté : il lit les journaux à la source, sans
qu'aucune application n'ait à le savoir.

**La chaîne de collecte, étape par étape.**
La configuration d'Alloy décrit un enchaînement d'étapes, chacune alimentant la suivante.

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

decouverte: "1. Découverte\ndes pods" {class: boite}
etiquettes: "2. Étiquettes\nservice, pod" {class: boite}
lecture: "3. Lecture\ndes journaux" {class: boite}
filtrage: "4. Filtrage\ndu bruit" {class: boite}
envoi: "5. Envoi\nà Loki" {class: boite}

decouverte -> etiquettes -> lecture -> filtrage -> envoi
```

1. **Découverte.** Alloy demande à Kubernetes la liste des pods du namespace du projet. Il n'a donc rien à savoir
   d'avance : un exemplaire créé par l'autoscaler est pris en compte sans modification de configuration.
2. **Étiquettes.** Chaque ligne reçoit le nom du service, celui du pod et celui du conteneur, qui serviront à filtrer
   les recherches.
3. **Lecture.** Les journaux sont lus par l'intermédiaire de Kubernetes, exactement comme le ferait la commande
   `kubectl logs`. Alloy n'accède pas aux fichiers de la machine.
4. **Filtrage.** Les lignes sans intérêt sont écartées avant l'envoi, afin de ne conserver que ce qui sert.
5. **Envoi.** Les lignes retenues partent vers Loki, qui les conserve.

**Filtrer avant de stocker.**
Un exemple concret justifie cette étape. Adminer journalise chaque requête reçue, y compris les sondes de santé que
Kubernetes lui adresse toutes les dix à vingt secondes. Ces lignes n'apprennent rien et représenteraient l'essentiel du
volume stocké. Alloy les écarte, en reconnaissant l'adresse interne d'où elles proviennent, tandis que les vraies
consultations, qui arrivent par l'ingress, restent journalisées. La règle est documentée dans la configuration : une
règle, un cas, et sa justification.

**Il ne lit que ce qu'on l'autorise à lire.**
Alloy est le seul outil de supervision qui dialogue avec Kubernetes. Ses droits sont donc réduits au strict
nécessaire : la lecture seule, et seulement dans le namespace du projet. Il ne peut ni modifier ni supprimer quoi que
ce soit, et ne voit rien des autres namespaces.

**Définitions**

| Terme | Définition |
|---|---|
| **Collecteur** | Outil qui lit des données à la source et les transmet à un autre outil, ici Loki. |
| **Composant** | Étape de la chaîne de collecte, par exemple la découverte des pods ou l'envoi à Loki. |
| **Découverte** | Fait d'obtenir automatiquement la liste des pods à surveiller, au lieu de l'écrire à la main. |
| **Étiquette** | Mot-clé attaché à un journal pour le retrouver, par exemple le nom du service. |
| **Rôle d'accès** | Liste des droits accordés à un outil dans Kubernetes. Celui d'Alloy se limite à la lecture. |

## Rôle dans le projet

- Il lit les journaux de tous les composants de la plateforme, y compris ceux que l'équipe n'a pas écrits.
- Il attache à chaque ligne les étiquettes qui permettront de la retrouver.
- Il écarte le bruit connu avant l'envoi, ce qui allège le stockage de Loki.
- Il suit seul les exemplaires ajoutés ou retirés par l'autoscaler.
- Son interface web montre l'état de chaque étape et le trajet des journaux, ce qui aide au diagnostic.
- Sans lui, Loki ne reçoit rien et le tableau de bord des journaux reste vide.

## Fichiers et dossiers principaux

| Fichier ou dossier | Description |
|---|---|
| **`k8s/config/alloy.alloy`** | Décrit la chaîne de collecte, étape par étape. |
| **`k8s/13-alloy.yaml`** | Déploie Alloy et lui accorde le droit de lire les pods du namespace. |
| **`k8s/08-ingress.yaml`** | Rend l'interface accessible sur `alloy.localhost`. |
| **`k8s/12-loki.yaml`** | Déploie Loki, destinataire des journaux. |

## Commandes essentielles

À lancer dans un terminal, depuis le dossier du projet, le cluster démarré.

| Commande | Description |
|---|---|
| **`make deploy`** | Installe Alloy avec le reste de la plateforme. |
| **`make alloy`** | Ouvre l'interface d'Alloy dans le navigateur. |
| **`make grafana`** | Ouvre Grafana, pour vérifier que les journaux arrivent bien. |
| **`make pods`** | Indique si Alloy est prêt. |

!!! note "À savoir"
    La configuration d'Alloy est fournie par le cluster. La modifier et redéployer suffit : Alloy redémarre
    automatiquement pour prendre en compte le nouveau fichier.

!!! note "À savoir"
    Alloy n'a pas de volume persistant : son état (la position de lecture des logs) est volontairement éphémère, comme
    dans le chart Helm officiel. S'il redémarre, il peut manquer quelques lignes de logs pendant l'arrêt, sans aucune
    perte de données métier. Un volume ne s'impose que si Alloy tourne en DaemonSet et lit les fichiers de chaque
    nœud : on utilise alors un `hostPath`.

!!! warning "Attention"
    L'interface d'Alloy ne demande aucune authentification, comme celles de Prometheus et d'Adminer. C'est acceptable
    sur un cluster local, mais une mise en production imposerait de la protéger ou de ne pas l'exposer.

!!! tip "Astuce"
    Lorsque le tableau de bord des journaux reste vide, l'interface d'Alloy indique où la chaîne s'interrompt : une
    étape en erreur y apparaît immédiatement, ce qui évite de chercher du côté de Loki sans raison.

## Pour aller plus loin

- [Site officiel d'Alloy](https://grafana.com/oss/alloy-opentelemetry-collector/)
- [Documentation d'Alloy](https://grafana.com/docs/alloy/latest/)
- [Fiche Loki du projet](loki.md)
