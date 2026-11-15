# Adminer

## Fiche d'identité

| Information | Détail |
|---|---|
| **Rôle** | Permet de consulter et d'interroger les bases PostgreSQL depuis un navigateur, sans ligne de commande |
| **Version** | Adminer 6.3.0, image officielle sur PHP 8.4 |
| **Adresse en local** | <https://adminer.localhost> |

## Description

Adminer est un outil open source d'administration de bases de données, qui tient dans un seul fichier. Il affiche les
tables, leurs colonnes et leur contenu, et permet d'exécuter des requêtes **SQL**.

**À quoi il sert concrètement.**
Il répond à la question qui revient sans cesse pendant le développement : « la donnée est-elle vraiment enregistrée ? »
Après un dépôt d'annonce, il permet de vérifier en quelques clics la ligne créée, son statut de modération et sa date.
Sans lui, la même vérification passerait par des commandes SQL tapées dans un terminal, ce qui suppose d'en connaître
la syntaxe.

**Il ne détient aucun compte.**
Adminer ne gère pas d'utilisateurs : il se connecte à PostgreSQL avec l'identifiant et le mot de passe saisis sur sa
page d'accueil. Il n'a donc aucun droit propre, et ce qu'il peut voir dépend entièrement du compte utilisé.

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

navigateur: "Navigateur\nadminer.localhost" {class: boite}
adminer: "Adminer\naucun compte propre" {class: boite}

postgres: "PostgreSQL" {
  style.font-size: 22
  pme: "pme\nannonces" {class: boite}
  moderation: "moderation\nfile d'attente" {class: boite}
  keycloak: "keycloak\nidentités" {class: boite}
  grafana: "grafana\ntableaux de bord" {class: boite}
}

navigateur -> adminer: HTTPS
adminer -> postgres: identifiants saisis\npar l'utilisateur
```

**Définitions**

| Terme | Définition |
|---|---|
| **Requête SQL** | Instruction écrite en langage SQL pour lire ou modifier des données. |
| **Schéma** | Organisation interne d'une base : ses tables et leurs colonnes. |
| **Table** | Tableau de données : chaque ligne est un enregistrement, chaque colonne une information. |

## Rôle dans le projet

- Il permet de vérifier le contenu des quatre bases sans ligne de commande.
- Il sert à contrôler qu'une annonce déposée depuis l'interface est bien enregistrée, avec le bon statut.
- Il aide à comprendre la structure des données pendant une démonstration ou une relecture.
- Il est réservé au développement et aux démonstrations : il n'a pas sa place dans un environnement de production.
- Sans lui, les bases restent consultables avec `make db-listings` et `make db-moderation`, mais seulement pour les
  requêtes déjà prévues.

Les quatre bases accessibles sont les suivantes :

| Base | Contenu |
|---|---|
| **`pme`** | Les annonces déposées par les membres. |
| **`moderation`** | La file des annonces à relire. |
| **`keycloak`** | Les comptes, les rôles et les sessions. |
| **`grafana`** | Les réglages des tableaux de bord. |

!!! note "À savoir"
    Adminer permet aussi de modifier et de supprimer des lignes. Une modification faite directement dans la base
    contourne l'API : elle n'est pas validée et ne publie aucun événement vers la modération. Pour observer, il vaut
    mieux se limiter à l'onglet « Requête SQL » avec des requêtes de lecture.

!!! warning "Attention"
    Adminer n'a aucune authentification propre : toute personne qui atteint son adresse arrive sur une page de
    connexion à la base. Il ne doit donc jamais être exposé en dehors de l'ordinateur de l'équipe.

## Fichiers et dossiers principaux

| Fichier ou dossier | Description |
|---|---|
| **`k8s/07-adminer.yaml`** | Déploie Adminer dans le cluster. |
| **`k8s/08-ingress.yaml`** | Rend l'interface accessible sur `adminer.localhost`. |
| **`.env`** | Contient l'identifiant et le mot de passe à saisir sur la page de connexion. |

## Commandes essentielles

À lancer dans un terminal, depuis le dossier du projet, le cluster démarré.

| Commande | Description |
|---|---|
| **`make deploy`** | Installe Adminer avec le reste de la plateforme. |
| **`make adminer`** | Ouvre Adminer dans le navigateur. |
| **`make db-listings`** | Affiche les annonces enregistrées, sans passer par le navigateur. |
| **`make pods`** | Indique si Adminer est prêt. |

Pour se connecter :

1. Lancer `make adminer`.
2. Choisir le système « PostgreSQL ». Le champ « Serveur » est déjà rempli.
3. Saisir l'identifiant et le mot de passe d'administration (`POSTGRES_USER` et `POSTGRES_PASSWORD` du fichier `.env`).
4. Indiquer la base souhaitée : `pme`, `moderation`, `keycloak` ou `grafana`.

Les comptes de service (`pme_api`, `pme_moderation`, `pme_keycloak`, `pme_grafana`) fonctionnent aussi, avec leur mot
de passe `DB_*_PASSWORD` du fichier `.env`, mais chacun n'ouvre que sa propre base. Seul le compte d'administration
peut ouvrir les quatre.

!!! tip "Astuce"
    La table `listings` de la base `pme` est celle à ouvrir pour suivre une annonce. Sa colonne de statut montre le
    passage de « en attente de validation » à l'état suivant.

## Pour aller plus loin

- [Site officiel d'Adminer](https://www.adminer.org/)
- [Fiche PostgreSQL du projet](postgresql.md)
