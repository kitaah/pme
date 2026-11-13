# Architecture

## Fiche d'identité

| Information | Détail |
|---|---|
| **Style** | Deux services applicatifs séparés, qui communiquent par messages plutôt qu'en s'appelant directement |
| **Périmètre** | Le parcours d'un membre : connexion, dépôt d'une annonce, prise en charge par le service de modération |
| **Composants déployés** | Onze dans le namespace `pme`, plus Traefik dans son propre namespace, sur un cluster Minikube |
| **Point d'entrée unique** | Traefik, qui termine le HTTPS, limite le débit et contrôle les jetons sous `/api/v1`, puis répartit selon le nom d'hôte et le chemin |
| **Bases de données** | Une seule instance PostgreSQL, quatre bases : `pme`, `moderation`, `keycloak`, `grafana` |
| **Messagerie** | NATS JetStream, flux `LISTINGS`, sujet `listing.submitted` |
| **Déploiement** | `kubectl apply -k k8s/` (Kustomize), ordre imposé par les préfixes numériques des manifestes |

## Description

« La Petite Maison de l'Épouvante » est une place de marché d'objets d'épouvante entre particuliers. Un membre dépose
une annonce ; celle-ci n'est pas publiée immédiatement, mais placée dans une file que des modérateurs examinent. Ce
POC ne cherche pas à être une boutique complète : il sert à éprouver une chaîne technique de bout en bout, du bouton
cliqué dans le navigateur jusqu'au message consommé par un service séparé.

**Le problème : un dépôt d'annonce ne doit pas dépendre de la modération.**
Si l'API appelait directement le service de modération pour chaque annonce, le dépôt échouerait dès que ce service
serait lent, redémarré ou saturé. Le membre attendrait pour rien, et une annonce pourrait être perdue entre les deux
appels.

**La réponse : un événement, pas un appel.**
L'API enregistre l'annonce en base avec le statut « en attente de modération », publie un événement dans NATS, puis
répond au membre. Le service de modération consomme cet événement à son rythme. Les deux services ne se connaissent
pas : ils ne partagent qu'un nom de sujet et la forme du message. L'un peut être arrêté sans empêcher l'autre de
fonctionner, et les messages publiés pendant son absence l'attendent dans le flux.

**La contrepartie : il faut garantir que l'événement part.**
Une annonce enregistrée dont l'événement n'aurait pas été publié resterait invisible pour toujours : aucun modérateur
ne la verrait. L'API traite donc ce cas explicitement. Si la publication échoue malgré ses tentatives, elle efface
l'annonce qu'elle venait d'écrire et répond `503` au membre, avec un message qui l'invite à réessayer. Mieux vaut un
dépôt refusé qu'une annonce fantôme.

### Le périmètre du POC

Le POC démontre qu'un parcours métier réel fonctionne de bout en bout sur les technologies retenues. Chaque étape
s'appuie sur des briques précises :

| Étape | Ce que l'on montre | Briques |
|---|---|---|
| **Connexion** | Le membre est redirigé vers la page de connexion de Keycloak, s'authentifie, puis revient sur l'interface où son nom d'utilisateur et son rôle « Membre » s'affichent. | Keycloak, React |
| **Dépôt de l'annonce** | Le membre remplit le formulaire (titre, description, état). Traefik limite le débit et vérifie le jeton, puis l'API revérifie le jeton, le rôle et les données, et l'annonce s'affiche dans « Mes annonces » au statut « En attente de modération ». | Traefik, React, NestJS |
| **Prise en charge par la modération** | L'API répond sans attendre la modération. L'événement « annonce soumise » est conservé dans le flux JetStream, et le service de modération, séparé de l'API, le consomme (visible dans ses logs). | NATS, NestJS |
| **Tout le parcours** | Les composants tournent ensemble sur Minikube. | Minikube |

Le parcours s'arrête à la prise en charge : la décision du modérateur (approuver ou rejeter) n'en fait pas partie.

### Les composants et leurs échanges

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
  donnee: {
    style: {
      font-size: 24
      border-radius: 12
      stroke-dash: 3
    }
  }
}

navigateur: "Navigateur\nmembre ou modérateur" {class: boite}

cluster: "Cluster Minikube" {
  style.font-size: 22

  entree: "Namespace traefik" {
    style.font-size: 22
    traefik: "Traefik\nHTTPS, limite de débit,\ncontrôle des jetons" {class: boite}
  }

  pme: "Namespace pme" {
    style.font-size: 22

    applicatif: "Applicatif" {
      style.font-size: 22
      frontend: "Interface React\npme.localhost/" {class: boite}
      api: "API NestJS\n/api/v1" {class: boite}
      moderation: "Service de modération\n/api/v1/moderation" {class: boite}
    }

    socle: "Socle" {
      style.font-size: 22
      keycloak: "Keycloak\nidentités et jetons" {class: boite}
      nats: "NATS JetStream\nflux LISTINGS" {class: boite}
      postgres: "PostgreSQL\nbases pme, moderation,\nkeycloak, grafana" {class: donnee}
    }

    applicatif.api -> socle.nats: publie listing.submitted
    socle.nats -> applicatif.moderation: consomme
    applicatif.api -> socle.postgres
    applicatif.moderation -> socle.postgres
    socle.keycloak -> socle.postgres
  }

  entree.traefik -> pme.applicatif.frontend
  entree.traefik -> pme.applicatif.api
  entree.traefik -> pme.applicatif.moderation
  entree.traefik -> pme.socle.keycloak: connexion et clés\nde vérification
}

navigateur -> cluster.entree.traefik: HTTPS
```

Traefik, l'API et le service de modération lisent chacun les clés publiques de Keycloak pour vérifier les jetons : le schéma ne
trace que la flèche de Traefik, qui est la seule à traverser un namespace.

Cinq composants d'exploitation, dans le namespace `pme`, complètent le tableau : **Prometheus** collecte les mesures de l'API et de la
modération, **Grafana** les affiche, **Alloy** ramasse les logs que **Loki** conserve, et **Adminer** donne un
accès direct aux bases. Tous sont joignables sur leur propre nom d'hôte, sauf Loki, qui n'est interrogé que par
Grafana depuis l'intérieur du cluster. Ils sont décrits dans leurs fiches respectives et n'interviennent pas dans le
trajet d'une annonce.

### Le trajet d'une annonce

```d2
vars: {
  d2-config: {
    layout-engine: elk
    theme-id: 5
    pad: 8
  }
}
direction: down

classes: {
  boite: {
    style: {
      font-size: 24
      border-radius: 12
    }
  }
}

connexion: "1. Le membre se connecte sur Keycloak\net revient avec un jeton signé" {class: boite}
depot: "2. Le membre remplit le formulaire\net valide" {class: boite}
entree: "3. POST /api/v1/listings arrive à Traefik\nqui limite le débit (429 sinon)\net vérifie le jeton (401 sinon)" {class: boite}
controle: "4. L'API revérifie le jeton, le rôle « membre »\net valide chaque champ" {class: boite}
ecriture: "5. L'annonce est écrite en base\nstatut « en attente de modération »" {class: boite}
publication: "6. L'API publie listing.submitted\ndans le flux LISTINGS" {class: boite}
reponse: "7. L'API répond 201 au membre\nsans attendre la modération" {class: boite}
consommation: "8. Le service de modération consomme\nle message et le range dans sa file" {class: boite}
file: "9. La file se consulte\nGET /api/v1/moderation/queue" {class: boite}
compensation: "L'annonce est effacée,\nle membre reçoit un 503" {class: boite}

connexion -> depot -> entree -> controle -> ecriture -> publication
publication -> reponse: publication réussie
publication -> compensation: broker injoignable
reponse -> consommation -> file
```

**Définitions**

| Terme | Définition |
|---|---|
| **Événement** | Message qui signale un fait déjà survenu (« une annonce a été déposée »), sans attendre de réponse. |
| **Producteur / consommateur** | Le composant qui publie un message, et celui qui le lit. Ils ne se connaissent que par le sujet. |
| **Compensation** | Action qui défait une écriture déjà validée, lorsqu'une étape suivante échoue. |
| **Namespace** | Cloison logique d'un cluster Kubernetes, qui regroupe des composants et leur applique des règles communes. |
| **Idempotence** | Propriété d'un traitement qui, rejoué sur le même message, produit le même résultat sans doublon. |

## Les choix structurants

| Choix | Raison | Conséquence assumée |
|---|---|---|
| **Deux services séparés plutôt qu'une seule application** | Montrer une communication asynchrone réelle entre deux déploiements indépendants. | Deux images, deux bases, deux jeux de tests : plus de code pour un POC de cette taille. |
| **Messages plutôt qu'appel direct** | Le dépôt d'annonce survit à une modération arrêtée ou lente. | Il faut gérer le rejeu, les doublons et les messages invalides (flux d'échec). |
| **Une instance PostgreSQL, quatre bases** | Économiser la mémoire d'un cluster local. | Un seul compte partagé : aucune séparation des droits, limite connue de la [sécurité](securite/durcissement.md). |
| **Identités déléguées à Keycloak** | L'API ne stocke aucun mot de passe ; elle ne garde que le `sub` du membre. | Keycloak devient indispensable au démarrage de la plateforme. |
| **Jeton contrôlé à l'entrée, puis dans chaque service** | Traefik refuse tôt toute requête sans jeton valide. Chaque service revérifie le jeton et décide des rôles. | Traefik open source n'a pas ce contrôle en natif : un plugin communautaire est téléchargé à son démarrage, en version épinglée. |
| **Débit limité à l'entrée** | Traefik plafonne à 200 requêtes par minute et par adresse, avant même l'API. | Le plafond de l'API, par exemplaire, reste en seconde barrière. |
| **Statut porté par l'annonce, pas par un workflow** | Un simple champ `status` suffit à l'usage du POC. | Le circuit d'approbation ou de rejet est hors périmètre : la file se consulte, elle ne se traite pas. |
| **Un seul namespace `pme`** | Toutes les règles de sécurité s'appliquent au même endroit. | Le namespace est écrit en dur dans `k8s/kustomization.yaml` : il ne se change pas par une variable. |

!!! note "À savoir"
    Les manifestes de `k8s/` sont numérotés dans leur ordre de dépendance : PostgreSQL (`01`) avant Keycloak (`03`),
    qui attend sa base, avant l'API (`04`), qui attend Keycloak et NATS. Kustomize applique l'ensemble en une fois,
    sans garantir cet ordre, mais chaque composant attend ce dont il dépend : l'ordre des préfixes sert d'abord à la
    lecture.

!!! warning "Attention"
    Le service de modération est joignable depuis le navigateur, sur `pme.localhost/api/v1/moderation`, mais il n'est
    pas appelé par l'API : les deux ne se parlent que par NATS. Une annonce absente de la file vient donc d'un
    problème de messagerie, jamais d'un appel manqué entre les deux services.

!!! tip "Astuce"
    Pour suivre une annonce de bout en bout, ouvrir le tableau de bord « Services » de Grafana et déposer une annonce :
    la requête apparaît dans les mesures de l'API, puis le message dans celles du service de modération quelques
    instants plus tard. Un écart durable entre les deux signale un consommateur arrêté.

## Pour aller plus loin

- [Sécurité de la plateforme](securite/index.md)
- [Authentification et autorisation](securite/authentification.md)
- [Traefik, le point d'entrée](outils/traefik.md)
- [NATS, le flux et ses garanties](outils/nats.md)
- [NestJS, la structure des deux services](outils/nestjs.md)
- [Kustomize, l'assemblage des manifestes](outils/kustomize.md)
- [Les douze facteurs d'une application moderne](https://12factor.net/fr/)
