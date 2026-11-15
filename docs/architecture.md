# Architecture

## Fiche d'identité

| Information | Détail |
|---|---|
| **Style** | Deux services applicatifs séparés, qui communiquent par messages plutôt qu'en s'appelant directement |
| **Périmètre** | Le parcours d'un membre : connexion, dépôt d'une annonce, prise en charge par le service de modération |
| **Composants déployés** | Douze dans le namespace `pme`, plus Traefik dans son propre namespace, sur un cluster Minikube |
| **Point d'entrée unique** | Traefik, qui termine le HTTPS, limite le débit et contrôle les jetons sous `/api/v1`, puis répartit selon le nom d'hôte et le chemin |
| **Bases de données** | Une seule instance PostgreSQL, quatre bases : `pme`, `moderation`, `keycloak`, `grafana` |
| **Stockage des fichiers** | Garage (compatible S3), bucket `pme-photos` : une photo par annonce, jamais dans la base |
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
L'API enregistre l'annonce en base avec le statut « en attente de validation », publie un événement dans NATS, puis
répond au membre. Le service de modération consomme cet événement à son rythme. Les deux services ne se connaissent
pas : ils ne partagent qu'un nom de sujet et la forme du message. L'un peut être arrêté sans empêcher l'autre de
fonctionner, et les messages publiés pendant son absence l'attendent dans le flux.

**La contrepartie : il faut garantir que l'événement part.**
Une annonce enregistrée dont l'événement n'aurait pas été publié resterait invisible pour toujours : aucun modérateur
ne la verrait. L'API traite donc ce cas explicitement. Si la publication échoue malgré ses tentatives, elle efface
l'annonce qu'elle venait d'écrire, ainsi que sa photo, et répond `503` au membre, avec un message qui l'invite à réessayer. Mieux vaut un
dépôt refusé qu'une annonce fantôme.

### Le périmètre du POC

Le POC démontre qu'un parcours métier réel fonctionne de bout en bout sur les technologies retenues. Chaque étape
s'appuie sur des briques précises :

| Étape | Ce que l'on montre | Briques |
|---|---|---|
| **Connexion** | Le membre est redirigé vers la page de connexion de Keycloak, s'authentifie, puis revient sur l'interface où son nom d'utilisateur et son rôle « Membre » s'affichent. | Keycloak, React |
| **Dépôt de l'annonce** | Le membre remplit le formulaire : titre, description, type d'annonce (échange, don ou vente), contrepartie souhaitée ou prix selon le type, catégorie, état, lieu de remise et une photo facultative. Traefik limite le débit et la taille du corps de la requête, et vérifie le jeton. L'API revérifie le jeton, le rôle et les données, contrôle et ré-encode la photo, l'enregistre dans le stockage objet, puis écrit l'annonce. Une notification confirme la soumission et le membre est redirigé vers « Mes annonces », où l'annonce apparaît au statut « En attente de validation », photo comprise. | Traefik, React, NestJS, Garage |
| **Prise en charge par la modération** | L'API répond sans attendre la modération. L'événement « annonce soumise » est conservé dans le flux JetStream, et le service de modération, séparé de l'API, le consomme (visible dans ses logs). | NATS, NestJS |
| **Tout le parcours** | Les composants tournent ensemble sur Minikube. | Minikube |

Le parcours s'arrête à la prise en charge : la décision du modérateur (approuver ou rejeter) n'en fait pas partie.

### Les composants et leurs échanges

```d2
vars: {
  d2-config: {
    layout-engine: elk
    theme-id: 5
    pad: 16
  }
}
direction: down

classes: {
  boite: {
    style: {
      font-size: 22
      border-radius: 12
    }
  }
  donnee: {
    style: {
      font-size: 22
      border-radius: 12
      stroke-dash: 3
    }
  }
  lien: {
    style: {
      font-size: 18
    }
  }
}

navigateur: "Navigateur\nmembre ou modérateur" {class: boite}

cluster: "Cluster\nMinikube" {
  style.font-size: 22
  label.near: top-left

  entree: "Namespace\ntraefik" {
    style.font-size: 22
    label.near: top-left
    traefik: "Traefik\nHTTPS, limite de débit,\ncontrôle des jetons" {class: boite}
  }

  pme: "Namespace\npme" {
    style.font-size: 22
    label.near: top-left

    frontend: "Interface React\npme.localhost/" {class: boite}
    api: "API NestJS\n/api/v1" {class: boite}
    moderation: "Service de modération\n/api/v1/moderation" {class: boite}
    keycloak: "Keycloak\nidentités et jetons" {class: boite}
    nats: "NATS JetStream\nflux LISTINGS" {class: boite}
    postgres: "PostgreSQL\nune instance, quatre bases,\nun compte par base" {class: donnee}
    garage: "Garage\nstockage objet S3\nphotos des annonces" {
      class: donnee
      width: 520
    }

    api -> nats: "publie\nlisting.submitted" {class: lien}
    nats -> moderation: "consomme" {class: lien}
    api -> postgres: "annonces\n(base pme)" {class: lien}
    moderation -> postgres: "file\n(base moderation)" {class: lien}
    keycloak -> postgres: "identités\n(base keycloak)" {class: lien}
    api -> garage: "enregistre\nla photo" {class: lien}
  }

  entree.traefik -> pme.frontend: "site" {class: lien}
  entree.traefik -> pme.api: "/api/v1" {class: lien}
  entree.traefik -> pme.moderation: "/api/v1/moderation" {class: lien}
  entree.traefik -> pme.keycloak: "connexion\net clés" {class: lien}
  entree.traefik -> pme.garage: "lecture des photos\n(URL signée)" {class: lien}
}

navigateur -> cluster.entree.traefik: "HTTPS" {class: lien}
```

Traefik, l'API et le service de modération lisent chacun les clés publiques de Keycloak pour vérifier les jetons : le schéma ne
trace que la flèche de Traefik, qui est la seule à traverser un namespace.

**Les photos ne sont pas dans la base.** Une image de plusieurs méga-octets dans une colonne alourdirait chaque
sauvegarde et chasserait les données utiles du cache de PostgreSQL. Elles vont donc dans un stockage objet, le
conteneur « Stockage de fichiers » que prévoyait déjà le niveau 2 du C4 : **Garage**, compatible S3, tient ici le rôle
que jouera un hébergeur européen en production. Seule l'API y écrit ; la base ne garde que le chemin de l'objet.
Le navigateur lit l'image directement, par une URL signée valable cinq minutes que l'API calcule : la photo d'une
annonce en attente de validation n'est donc jamais publique. Dans le POC, cette lecture passe par l'ingress Traefik
(`garage.localhost`, avec sa propre limite de débit), faute de S3 externe ; en production, le navigateur lira directement chez l'hébergeur S3, comme le
montre le C4. Le service de modération n'a aucun accès au stockage,
et les politiques d'Istio comme celles de Calico le lui refusent.

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
depot: "2. Le membre remplit le formulaire\n(type, prix ou contrepartie, photo) et valide" {class: boite}
entree: "3. POST /api/v1/listings arrive à Traefik\nqui limite le débit (429 sinon),\nla taille du corps (413 sinon)\net vérifie le jeton (401 sinon)" {class: boite}
controle: "4. L'API revérifie le jeton, le rôle « membre »\net valide chaque champ" {class: boite}
photo: "5. La photo est contrôlée, ré-encodée\net enregistrée dans Garage" {class: boite}
ecriture: "6. L'annonce est écrite en base\nstatut « en attente de validation »" {class: boite}
publication: "7. L'API publie listing.submitted\ndans le flux LISTINGS" {class: boite}
reponse: "8. L'API répond 201 au membre\nsans attendre la modération" {class: boite}
redirection: "9. L'interface affiche une notification\net ouvre « Mes annonces »" {class: boite}
consommation: "10. Le service de modération consomme\nle message et le range dans sa file" {class: boite}
file: "11. La file se consulte\nGET /api/v1/moderation/queue" {class: boite}
compensation: "L'annonce et sa photo sont effacées,\nle membre reçoit un 503" {class: boite}

connexion -> depot -> entree -> controle -> photo -> ecriture -> publication
publication -> reponse: succès
publication -> compensation: échec
publication -> consommation: message distribué
reponse -> redirection
consommation -> file
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
| **Une instance PostgreSQL, quatre bases, un compte par base** | Économiser la mémoire d'un cluster local, tout en gardant la séparation du C4 : le Cœur et la modération ont chacun leur base et leur compte, sans accès à celle de l'autre. | L'isolation est logique, pas physique : une panne de l'instance touche les quatre bases. En production, chaque service aurait sa propre instance. |
| **Identités déléguées à Keycloak** | L'API ne stocke aucun mot de passe ; elle ne garde que le `sub` du membre. | Keycloak devient indispensable au démarrage de la plateforme. |
| **Jeton contrôlé à l'entrée, puis dans chaque service** | Traefik refuse tôt toute requête sans jeton valide. Chaque service revérifie le jeton et décide des rôles. | Traefik open source n'a pas ce contrôle en natif : un plugin communautaire est téléchargé à son démarrage, en version épinglée. |
| **Débit limité à l'entrée** | Traefik plafonne à 200 requêtes par minute et par adresse, avant même l'API, et à 600 pour la lecture des photos. | Le plafond de l'API, par exemplaire, reste en seconde barrière. |
| **Photos dans un stockage objet, pas dans la base** | Garder PostgreSQL léger et lisible, et reproduire le conteneur « Stockage de fichiers » du C4. | Un composant de plus (Garage) à sécuriser et à sauvegarder ; la photo et l'annonce ne sont pas dans la même transaction. |
| **Lecture des photos par URL signée de cinq minutes** | La photo d'une annonce non modérée n'est jamais publique, et l'API n'a pas à relayer les octets. | L'adresse expire : l'interface la redemande à chaque affichage de la liste. |
| **Photo enregistrée avant l'annonce, supprimée en cas d'échec** | Si le stockage refuse le fichier, rien n'est écrit en base ; si la publication échoue, ni annonce ni fichier orphelin ne restent. | Une panne simultanée du stockage et de la base peut laisser un fichier orphelin, tracé dans les logs. |
| **Statut porté par l'annonce, pas par un workflow** | Un simple champ `status` suffit à l'usage du POC. | Le circuit d'approbation ou de rejet est hors périmètre : la file se consulte, elle ne se traite pas. |
| **Un seul namespace `pme`** | Toutes les règles de sécurité s'appliquent au même endroit. | Le namespace est écrit en dur dans `k8s/kustomization.yaml` : il ne se change pas par une variable. |

!!! note "À savoir"
    Les manifestes de `k8s/` sont numérotés dans leur ordre de dépendance : PostgreSQL (`01`) avant Keycloak (`03`),
    qui attend sa base, avant l'API (`04`), qui attend Keycloak et NATS. Kustomize applique l'ensemble en une fois,
    sans garantir cet ordre, mais chaque composant attend ce dont il dépend : l'ordre des préfixes sert d'abord à la
    lecture. Garage (`03`) démarre vide : `make deploy` le met en service juste après l'application des manifestes
    (`make garage-init`), et tant que ce n'est pas fait, le dépôt d'une annonce avec photo répond `503`.

!!! warning "Attention"
    Le service de modération est joignable depuis le navigateur, sur `pme.localhost/api/v1/moderation`, mais il n'est
    pas appelé par l'API : les deux ne se parlent que par NATS. Une annonce absente de la file vient donc d'un
    problème de messagerie, jamais d'un appel manqué entre les deux services. De même, l'adresse d'une photo expire au
    bout de cinq minutes : une image copiée dans un autre onglet répond `403` ensuite, ce qui est voulu.

!!! tip "Astuce"
    Pour suivre une annonce de bout en bout, ouvrir le tableau de bord « Services » de Grafana et déposer une annonce :
    la requête apparaît dans les mesures de l'API, puis le message dans celles du service de modération quelques
    instants plus tard. Un écart durable entre les deux signale un consommateur arrêté. Pour vérifier la photo, la
    commande `kubectl -n pme exec deploy/garage -- /garage bucket info pme-photos` donne le nombre d'objets du stockage.

## Pour aller plus loin

- [Sécurité de la plateforme](securite/index.md)
- [Authentification et autorisation](securite/authentification.md)
- [Traefik, le point d'entrée](outils/traefik.md)
- [NATS, le flux et ses garanties](outils/nats.md)
- [NestJS, la structure des deux services](outils/nestjs.md)
- [Kustomize, l'assemblage des manifestes](outils/kustomize.md)
- [Les douze facteurs d'une application moderne](https://12factor.net/fr/)
