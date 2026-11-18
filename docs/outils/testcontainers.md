# Testcontainers

## Fiche d'identité

| Information | Détail |
|---|---|
| **Rôle** | Démarre de vrais PostgreSQL et NATS jetables pour les tests d'intégration, puis les supprime |
| **Version** | Testcontainers 12, avec ses modules PostgreSQL et NATS |
| **Adresse en local** | Aucune : les conteneurs prennent un port libre choisi au hasard |

## Description

Testcontainers est une bibliothèque open source qui **démarre des conteneurs Docker depuis un test**, les attend, puis les
supprime quand le test est fini. Un conteneur est une boîte logicielle qui embarque un programme prêt à l'emploi, ici
une base de données ou un broker de messages.

**Le problème : des tests qui mentent.**
Un test unitaire remplace la base de données par une doublure, c'est-à-dire un faux composant. C'est rapide, mais cela ne
prouve pas que les vraies requêtes SQL fonctionnent, ni que le vrai broker conserve les messages comme prévu. À l'inverse,
tester contre une base installée sur l'ordinateur donne des résultats qui dépendent de ce qu'elle contient déjà : un test
peut réussir chez une personne et échouer chez une autre.

**La solution : un environnement neuf à chaque fois.**
Avec Testcontainers, chaque série de tests démarre sa propre base et son propre broker, vides, dans leur version exacte.
Les tests s'y exécutent, puis tout est détruit : aucun reste, aucune dépendance entre deux exécutions. Même si un test
plante en cours de route, un conteneur de nettoyage supprime les restes.

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

test: "Test Jest\ndemande un\nenvironnement" {class: boite}
tc: "Testcontainers\npilote Docker" {class: boite}
docker: "Docker\ndémarre les\nconteneurs" {class: boite}
env: "PostgreSQL 18\net NATS 2.14\njetables" {class: boite}

test -> tc
tc -> docker
docker -> env
```

**Définitions**

| Terme | Définition |
|---|---|
| **Conteneur** | Boîte logicielle isolée qui contient un programme et tout ce dont il a besoin pour fonctionner. |
| **Docker** | Logiciel qui crée et fait fonctionner les conteneurs. |
| **Docker-in-Docker** | Service qui fournit Docker à un job de la pipeline, détruit à la fin du job. |
| **JetStream** | Fonction de NATS qui conserve les messages sur disque. Elle doit être activée explicitement dans les tests. |
| **Test d'intégration** | Test qui fait travailler plusieurs composants réels ensemble. |

## Rôle dans le projet

- Il démarre PostgreSQL et NATS pour les 35 tests d'intégration : 25 pour l'API et 10 pour le service de modération.
- Il utilise les mêmes versions que le cluster, ce qui évite les différences entre les tests et la production.
- Il permet de vérifier des scénarios réels : un message conservé pendant l'arrêt du service de modération, un rejeu sans
  doublon, une panne du broker.
- Dans la pipeline, il s'appuie sur Docker-in-Docker, fourni par GitLab le temps du job.
- Sans lui, ces scénarios devraient être contrôlés à la main sur le cluster.

Les conteneurs démarrés sont les suivants :

| Conteneur | Image | Particularité |
|---|---|---|
| **PostgreSQL** | `postgres:18-alpine` | Une base vide, créée au nom du service testé. |
| **NATS** | `nats:2.14-alpine` | JetStream activé, identifiants `test` et `test`. |

!!! note "À savoir"
    La première exécution est la plus longue : Docker télécharge les images. Les suivantes les réutilisent. C'est la
    raison du délai de 180 secondes accordé aux tests d'intégration, contre quelques secondes pour les tests unitaires.

## Fichiers et dossiers principaux

| Fichier ou dossier | Description |
|---|---|
| **`api/test/support/infrastructure.ts`** | Fonctions qui démarrent PostgreSQL et NATS, et attendent qu'une condition soit vraie. |
| **`moderation-service/test/support/`**<br>**`infrastructure.ts`** | Les mêmes fonctions pour le service de modération. |
| **`*/test/support/jest-setup.ts`** | Fixe à 180 secondes le délai accordé aux tests. |
| **`*/test/support/jwt-helper.ts`** | Faux Keycloak qui signe les jetons de test, sans conteneur. |

## Commandes essentielles

Testcontainers se lance avec [Jest](jest.md), Docker démarré.

| Commande | Description |
|---|---|
| **`make test-integration`** | Lance les tests d'intégration des deux services depuis la racine du projet. |
| **`npm run test:integration`** | Les lance pour un seul module, depuis son dossier. |
| **`docker ps`** | Montre les conteneurs de test en cours d'exécution, le temps de la série. |

Les tests d'intégration s'exécutent l'un après l'autre (option `--runInBand`) : chaque fichier démarre ses propres
conteneurs, et les lancer en parallèle saturerait l'ordinateur.

!!! warning "Attention"
    Docker doit être démarré avant de lancer les tests. S'il est arrêté, l'erreur apparaît dès le premier test, avec un
    message qui parle de connexion à Docker et non du code testé.

!!! tip "Astuce"
    Sans Docker, il reste une solution de repli pour PostgreSQL : définir la variable `TEST_DB_HOST` pour utiliser
    un PostgreSQL déjà lancé. Les variables `TEST_DB_PORT`, `TEST_DB_USER`, `TEST_DB_PASSWORD` et `TEST_DB_NAME` ajustent
    sa connexion.

## Pour aller plus loin

- [Site officiel de Testcontainers pour Node](https://node.testcontainers.org/)
- [Fiche Supertest du projet](supertest.md)
- Fiches [PostgreSQL](postgresql.md) et [NATS](nats.md) du projet
- [Page des tests d'intégration de la pipeline](../pipeline/tests-integration.md)
