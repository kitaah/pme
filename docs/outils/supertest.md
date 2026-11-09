# Supertest

## Fiche d'identité

| Information | Détail |
|---|---|
| **Rôle** | Envoie de vraies requêtes HTTP à l'API et au service de modération pendant les tests d'intégration |
| **Version** | Supertest 7 |
| **Adresse en local** | Aucune : utilisé par les tests |

## Description

Supertest est une bibliothèque open source qui permet de **tester une application web en lui envoyant des requêtes
HTTP**, comme le ferait un navigateur ou un autre service, puis de lire la réponse : code de statut, contenu, en-têtes.

**Le problème : tester une route sans démarrer le service.**
Pour vérifier qu'une route répond correctement, on peut lancer l'application, ouvrir un outil comme `curl` et regarder
la réponse à la main. Ce n'est ni répétable ni automatisable. Supertest évite ce détour : il prend l'application
directement dans le test, la fait écouter sur un port libre choisi au hasard, lui envoie la requête, puis la referme. Le
test peut ainsi vérifier un parcours complet, du jeton d'authentification jusqu'à la base, en quelques lignes.

**Comment il fonctionne.**
Le test construit d'abord l'application avec les outils de test de [NestJS](nestjs.md), puis la confie à Supertest. Une
requête s'écrit en chaîne : la méthode et l'adresse, les en-têtes, le corps. La réponse est ensuite examinée par les
vérifications habituelles de [Jest](jest.md).

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

test: "Test Jest" {class: boite}
supertest: "Supertest\nenvoie la requête" {class: boite}
app: "Application\nNestJS" {class: boite}
base: "PostgreSQL\nde test" {class: boite}

test -> supertest
supertest -> app: "HTTP"
app -> base
```

**Définitions**

| Terme | Définition |
|---|---|
| **Code de statut** | Nombre qui résume la réponse : 200 pour un succès, 401 pour une personne non identifiée, 403 pour un accès refusé. |
| **En-tête** | Information jointe à une requête, comme le jeton d'authentification. |
| **Requête HTTP** | Message envoyé à un service web pour lui demander une ressource ou une action. |
| **Route** | Adresse d'un service web associée à une action, par exemple le dépôt d'une annonce. |

## Rôle dans le projet

- Il envoie les requêtes des tests d'intégration de l'API et du service de modération.
- Il vérifie les codes de réponse : 201 pour un dépôt valide, 400 pour une saisie invalide, 401 et 403 pour les accès refusés.
- Il joint aux requêtes des jetons signés par le faux Keycloak, pour tester la sécurité pour de vrai.
- Il ne sert que dans les tests d'intégration : les tests unitaires n'ont pas besoin de HTTP.
- Sans lui, les routes ne seraient testées que par les scripts manuels, après le déploiement.

!!! note "À savoir"
    Supertest n'occupe pas le port 3000 ou 3001 : il choisit un port libre à chaque test. Un test d'intégration peut donc
    tourner pendant que l'API ou le service de modération fonctionne déjà sur l'ordinateur.

## Fichiers et dossiers principaux

| Fichier ou dossier | Description |
|---|---|
| **`api/test/integration/`**<br>**`listings.integration-spec.ts`** | Envoie les requêtes de dépôt et de lecture des annonces. |
| **`api/test/integration/`**<br>**`listings-broker.integration-spec.ts`** | Envoie des dépôts et vérifie leur publication dans NATS. |
| **`moderation-service/test/integration/`**<br>**`moderation.integration-spec.ts`** | Interroge la file de modération selon le rôle. |
| **`*/test/support/jwt-helper.ts`** | Fabrique les jetons signés qui accompagnent les requêtes. |

## Commandes essentielles

Supertest n'a pas de commande propre : il se lance avec [Jest](jest.md), Docker démarré, depuis le dossier `api` ou
`moderation-service`.

| Commande | Description |
|---|---|
| **`npm run test:integration`** | Lance les tests d'intégration du module. |
| **`make test-integration`** | Les lance pour les deux modules, depuis la racine du projet. |

!!! warning "Attention"
    Ces tests démarrent de vrais conteneurs : sans Docker, ils échouent dès le démarrage. Vérifier que Docker fonctionne
    avant de chercher une erreur dans le code.

!!! tip "Astuce"
    Pour comprendre un test qui échoue, afficher le contenu de la réponse. Le corps renvoyé par l'API suit la norme
    RFC 9457 : son champ `detail` explique la cause du refus.

## Pour aller plus loin

- [Dépôt officiel de Supertest](https://github.com/ladjs/supertest)
- [Fiche Testcontainers du projet](testcontainers.md)
- [Page des tests d'intégration de la pipeline](../pipeline/tests-integration.md)
