# NestJS

## Fiche d'identité

| Information | Détail |
|---|---|
| **Rôle** | Construit le back-end de la plateforme : il reçoit les demandes de l'interface, applique les règles de gestion et renvoie les réponses |
| **Version** | NestJS 12.4.0, exécuté sur Node 24 |
| **Langage** | TypeScript |
| **Adresse en local** | <https://pme.localhost/api/v1> |

## Description

NestJS est un **framework** open source destiné au back-end d'une application web. Il est écrit en **TypeScript**, le
langage JavaScript enrichi d'un contrôle des types.

**Back-end et front-end.**
Une application web se compose de deux parties. Le **front-end** est ce que l'utilisateur voit dans son navigateur :
les pages, les formulaires, les boutons. Le **back-end** est le programme qui s'exécute sur le serveur, hors de vue :
il reçoit les demandes du front-end, vérifie qui les envoie, applique les règles de gestion, enregistre les données et
renvoie une réponse. Le front-end ne parle jamais directement à la base de données : il passe toujours par le back-end,
qui reste seul juge de ce qui est autorisé.

**Pourquoi un framework ?**
Tout back-end doit résoudre les mêmes problèmes : lire une requête HTTP, vérifier une identité, contrôler les données
reçues, dialoguer avec une base, renvoyer une erreur compréhensible. Un framework fournit ces mécanismes, éprouvés et
documentés, ainsi qu'une organisation du code que tout développeur du métier reconnaît. L'équipe n'écrit donc que ce
qui est propre au projet : les règles des annonces et de la modération.

**Deux applications construites avec NestJS.**
Le projet en compte deux, bâties sur le même socle, mais aux responsabilités distinctes :

- l'**API** (dossier `api/`) reçoit les demandes de l'interface : dépôt d'une annonce, consultation de ses annonces ;
- le **service de modération** (dossier `moderation-service/`) ne reçoit rien du navigateur. Il écoute les événements
  publiés dans [NATS](nats.md) et constitue la file des annonces à relire.

Les séparer permet de les faire évoluer et de les redémarrer indépendamment : une modération interrompue n'empêche pas
le dépôt d'une annonce.

Le schéma suivant montre le trajet d'une demande à l'intérieur d'une application NestJS, de son arrivée jusqu'à la base
de données.

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

requete: "Requête du navigateur\nPOST /api/v1/listings" {class: boite}

app: "Application NestJS" {
  class: boite

  controles: "Contrôles d'entrée" {
    label.near: bottom-left
    class: boite
    debit: "1. Débit\npar adresse" {class: boite}
    jeton: "2. Jeton\nKeycloak" {class: boite}
    role: "3. Rôle\ndu membre" {class: boite}
    donnees: "4. Données\nde l'annonce" {class: boite}
  }

  module: "Module « annonces »" {
    label.near: bottom-left
    class: boite
    controleur: "Contrôleur\nreçoit et répond" {class: boite}
    service: "Service\nrègles de gestion" {class: boite}
    entite: "Entité\nlignes de la base" {class: boite}
  }

  controles -> module
}

postgres: "PostgreSQL" {class: boite}
nats: "NATS" {class: boite}

requete -> app.controles
app.module -> postgres
app.module -> nats
```

**Les trois briques de NestJS.**
Le code est toujours organisé de la même façon, ce qui permet de s'y retrouver sans connaître le projet :

| Brique | Rôle | Exemple du projet |
|---|---|---|
| **Module** | Regroupe tous les fichiers consacrés à un même sujet. | `listings/` rassemble tout ce qui concerne les annonces. |
| **Contrôleur** | Associe une adresse web à une action, lit la demande et renvoie la réponse. Il ne contient aucune règle de gestion. | `listings.controller.ts` reçoit `POST /api/v1/listings`. |
| **Service** | Contient les règles de gestion. C'est la seule brique qui décide. | `listings.service.ts` enregistre l'annonce, puis publie l'événement. |

Le contrôleur ne fabrique pas lui-même le service dont il a besoin : il le déclare, et NestJS le lui fournit au
démarrage. Ce mécanisme s'appelle l'**injection de dépendances**. Il permet, dans les tests, de remplacer la vraie base
de données par une imitation, sans modifier le code contrôlé.

**Les contrôles d'entrée.**
Avant qu'une demande atteigne le module, elle traverse quatre contrôles, toujours dans cet ordre. Le premier qui échoue
interrompt le traitement et renvoie une erreur :

1. **Le débit.** Une même adresse réseau ne peut envoyer qu'un nombre limité de requêtes par minute, 200 par défaut.
   Cette limite protège la plateforme d'un afflux anormal, volontaire ou non. Les sondes de santé et les mesures en
   sont dispensées.
2. **Le jeton.** Chaque demande doit présenter un **jeton** délivré par [Keycloak](keycloak.md). L'API vérifie sa
   signature, l'émetteur attendu et l'application qui l'a demandé. Sans jeton valide, la réponse est une erreur 401. Traefik refuse déjà ces requêtes à
   l'entrée du cluster ; l'API revérifie quand même, sans faire confiance à l'ingress.
   Le refus est le comportement par défaut : une route n'est publique que si elle le déclare explicitement.
3. **Le rôle.** Le jeton indique les rôles de l'utilisateur. Déposer une annonce exige le rôle `membre`, consulter la
   file de modération le rôle `moderateur`. Sans le bon rôle, la réponse est une erreur 403.
4. **Les données.** Le contenu de la demande est comparé au modèle attendu : champs obligatoires, longueurs maximales,
   valeurs autorisées. Un champ inconnu fait échouer la demande au lieu d'être ignoré, ce qui évite qu'une donnée
   inattendue se glisse dans la base. En cas d'écart, la réponse est une erreur 400 qui énumère les champs fautifs.

**Le dépôt d'une annonce, étape par étape.**
Cette opération illustre la principale règle de fiabilité du projet. L'API enregistre d'abord l'annonce avec le statut
« en attente de modération », puis publie un événement dans NATS pour prévenir le service de modération. Elle répond
alors au membre sans attendre que la modération soit faite.

Le risque est connu : l'annonce peut être enregistrée alors que la publication de l'événement échoue, parce que NATS
est injoignable. L'annonce resterait indéfiniment en attente, sans que personne ne la voie passer. L'API applique donc
une **compensation** : elle retire l'annonce qu'elle vient d'enregistrer, puis répond au membre que le dépôt n'a pas
abouti et qu'il peut réessayer. Mieux vaut un échec explicite qu'une annonce oubliée.

**Des erreurs lisibles et toujours de la même forme.**
Quelle que soit la panne, l'API répond au format **Problem Details**, une norme publique (RFC 9457) : un objet qui
contient le type de problème, un message lisible et, pour une erreur de saisie, la liste des champs en cause.
L'interface peut ainsi afficher un message utile sans deviner la structure de la réponse.

**Définitions**

| Terme | Définition |
|---|---|
| **API REST** | Manière répandue d'exposer un service sur le web : chaque donnée a une adresse, et le verbe HTTP (`GET`, `POST`) indique l'action demandée. |
| **Back-end** | Partie d'une application qui s'exécute sur le serveur : règles de gestion, accès aux données, sécurité. |
| **Code HTTP** | Nombre qui résume le résultat d'une demande : 200 et 201 en cas de succès, 400 pour une saisie invalide, 401 sans identité, 403 sans droit, 503 si le service est momentanément indisponible. |
| **Contrôleur** | Classe qui associe une adresse web à une action et renvoie la réponse. |
| **Entité** | Classe qui décrit une table de la base : chaque champ correspond à une colonne. |
| **Framework** | Ensemble d'outils et de règles d'organisation qui fournit la structure d'une application, pour éviter de réécrire les mécanismes communs. |
| **Front-end** | Partie d'une application qui s'exécute dans le navigateur de l'utilisateur. |
| **Injection de dépendances** | Mécanisme par lequel le framework fournit à une classe les objets dont elle a besoin, au lieu qu'elle les crée elle-même. |
| **Jeton (JWT)** | Fichier texte signé, délivré après la connexion, qui prouve l'identité et les rôles de l'utilisateur. Sa signature empêche toute modification. |
| **Migration** | Fichier qui décrit une modification du schéma de la base, par exemple l'ajout d'une table. Les migrations sont jouées dans l'ordre au démarrage. |
| **Module** | Ensemble de fichiers regroupés autour d'un même sujet. |
| **ORM** | Programme qui fait correspondre les classes du code et les tables de la base. Le projet utilise TypeORM. |
| **Problem Details** | Format normalisé de réponse d'erreur (RFC 9457), identique pour toutes les erreurs de l'API. |
| **Service** | Classe qui contient les règles de gestion. |
| **Sonde de santé** | Adresse interrogée régulièrement par Kubernetes pour savoir si l'application est vivante et prête à recevoir du trafic. |
| **TypeScript** | Langage dérivé de JavaScript, qui ajoute un contrôle des types et signale de nombreuses erreurs avant l'exécution. |

## Rôle dans le projet

- Il constitue le back-end de la plateforme, exposé sous forme d'API REST sous l'adresse `/api/v1`.
- Il est séparé du front-end : les deux parties ne communiquent que par cette API. Chacune peut donc évoluer et être
  redéployée sans toucher à l'autre.
- Il applique les règles de gestion et vérifie les droits de chaque utilisateur, à partir du jeton délivré par
  [Keycloak](keycloak.md). L'API ne gère ni compte ni mot de passe.
- Il assure la fiabilité du dépôt d'une annonce :
    - **Compensation** : une annonce enregistrée mais jamais annoncée au service de modération est retirée, avec sa photo,
      et le membre reçoit une erreur explicite.
    - **Disjoncteur** : lorsque PostgreSQL ne répond plus, l'API cesse d'attendre et répond immédiatement en 503, au
      lieu de laisser les demandes s'accumuler (voir [Opossum](opossum.md)).
    - **Reprise** : si la base n'est pas encore disponible au démarrage, l'API retente la connexion dix fois avant
      d'abandonner. L'ordre de démarrage des composants n'a donc pas à être garanti.
- Il expose ce qu'il faut pour être supervisé : deux sondes de santé et une page de mesures lue par
  [Prometheus](prometheus.md). Ces adresses ne sont jamais accessibles depuis l'extérieur du cluster.
- Il se connecte à [PostgreSQL](postgresql.md) et à [NATS](nats.md) par des connexions chiffrées, en vérifiant le
  certificat du serveur (voir [cert-manager](cert-manager.md)).
- Sans lui, l'interface n'a plus d'interlocuteur : aucune annonce ne peut être déposée ni consultée.

Les adresses exposées sont les suivantes :

| Adresse | Qui peut l'appeler | Description |
|---|---|---|
| **`POST /api/v1/listings`** | Rôle `membre` | Dépose une annonce, avec une photo facultative (`multipart/form-data`), et la place en attente de modération. |
| **`GET /api/v1/listings/mine`** | Rôle `membre` | Renvoie les annonces du membre, les plus récentes d'abord, 50 par défaut et 100 au maximum. |
| **`GET /api/v1/moderation/queue`** | Rôle `moderateur` | Renvoie la file des annonces à relire. Cette adresse appartient au service de modération. |
| **`GET /api/health/liveness`** | Kubernetes | Indique que l'application est vivante. |
| **`GET /api/health/readiness`** | Kubernetes | Indique qu'elle est prête, c'est-à-dire que la base répond. |
| **`GET /api/metrics`** | Prometheus | Fournit les mesures de l'application. Jamais exposée à l'extérieur. |

La configuration est lue dans des variables d'environnement, fournies par Kubernetes :

| Variable | Valeur par défaut | Rôle |
|---|---|---|
| **`PORT`** | 3000 pour l'API, 3001 pour la modération | Port d'écoute de l'application. |
| **`THROTTLE_LIMIT`** | 200 | Nombre de requêtes autorisées par minute et par adresse réseau. |
| **`DB_POOL_SIZE`** | 10 | Nombre maximal de connexions ouvertes vers PostgreSQL par exemplaire de l'application. |
| **`DB_SSL_CA`** | absente | Fichier de l'autorité de certification. Absente, la connexion à la base n'est pas chiffrée. |
| **`NATS_TLS_CA`** | absente | Même principe pour la connexion à NATS. |
| **`KEYCLOAK_ISSUER`** | obligatoire | Émetteur attendu dans le jeton. |
| **`KEYCLOAK_JWKS_URI`** | obligatoire | Adresse à laquelle l'API récupère les clés publiques de Keycloak. |
| **`S3_ENDPOINT`** | `http://localhost:3900` | Adresse du stockage des photos, utilisée par l'API pour écrire (voir [Garage](garage.md)). |
| **`S3_PUBLIC_ENDPOINT`** | celle de `S3_ENDPOINT` | Adresse que voit le navigateur : l'URL signée est calculée pour elle. |
| **`S3_BUCKET`**, **`S3_REGION`** | `pme-photos`, `garage` | Bucket et région du stockage. |
| **`S3_ACCESS_KEY`**, **`S3_SECRET_KEY`** | absentes | Clé d'accès de l'API. Sans elles, le dépôt avec photo répond 503. |
| **`S3_URL_TTL`** | 300 | Durée de validité d'une URL signée, en secondes. |

!!! note "À savoir"
    Le schéma de la base n'est jamais déduit du code : il est décrit par des migrations, jouées au démarrage. Une
    colonne ne peut donc pas apparaître ou disparaître à l'insu de l'équipe, et la même suite de migrations produit la
    même base sur tous les environnements.

## Fichiers et dossiers principaux

| Fichier ou dossier | Description |
|---|---|
| **`api/src/main.ts`** | Point d'entrée de l'API : démarre l'application et règle sa sécurité. |
| **`api/src/app.module.ts`** | Module principal : assemble les autres modules, la connexion à la base et les contrôles d'entrée. |
| **`api/src/listings/`** | Module des annonces : réception (JSON ou multipart), contrôle, enregistrement et publication de l'événement. |
| **`api/src/storage/`** | Stockage des photos : ré-encodage, enregistrement dans Garage, suppression et URL signées. |
| **`api/src/auth/`** | Module d'authentification : il branche les gardes du module commun. |
| **`api/src/common/`** | Disjoncteur de la base. |
| **`libs/common/`** | Module commun `@pme/common`, partagé avec la modération : vérification du jeton et des rôles, mise en forme des erreurs (RFC 9457), mesures, client NATS et lecture de la configuration. |
| **`api/src/config/configuration.ts`** | Lit la configuration dans les variables d'environnement et refuse de démarrer si l'une manque. |
| **`api/src/health/`** | Sondes de santé interrogées par Kubernetes. |
| **`api/src/metrics/`** | Route qui expose les mesures à Prometheus. |
| **`api/src/migrations/`** | Modifications successives du schéma de la base. |
| **`moderation-service/src/moderation/`** | Lecture des événements NATS et constitution de la file de modération. |
| **`api/package.json`** | Liste les dépendances et les commandes de l'API. |
| **`api/Dockerfile`** | Décrit la fabrication de l'image Docker de l'API. |

## Commandes essentielles

À lancer dans un terminal, depuis le dossier du projet. `Ctrl+C` arrête une commande en cours.

| Commande | Description |
|---|---|
| **`make install`** | Installe les dépendances : un seul `npm ci` à la racine pour le module commun, l'API et la modération, puis un autre pour l'interface. |
| **`make api`** | Démarre l'API sur l'ordinateur et la redémarre à chaque modification du code. |
| **`make moderation`** | Démarre le service de modération de la même façon. |
| **`make test`** | Lance les tests unitaires des trois applications. |
| **`make test-integration`** | Lance les tests avec une vraie base et un vrai broker, démarrés pour l'occasion par Docker. |
| **`make lint`** | Signale les erreurs probables, les fonctions trop complexes et les erreurs de type, comme le job `lint:code` de la pipeline. |
| **`make format-check`** | Vérifie la mise en forme du code (Prettier), comme le job `lint:code`. |
| **`make image-api`** | Construit l'image Docker de l'API dans le cluster. |
| **`make logs-api`** | Affiche le log de l'API, mis à jour en direct. |

Pour travailler sur l'API en local, l'enchaînement est le suivant :

1. `make install` installe les dépendances.
2. `make ca-cert` extrait le certificat de l'autorité locale.
3. `make port-forward` rend joignables depuis l'ordinateur la base, NATS et Keycloak, qui s'exécutent dans le cluster.
4. `make api` démarre l'API.

!!! note "À savoir"
    Les trois applications exigent Node 24 ou une version plus récente, celle des images Docker. Avec nvm :
    `nvm install 24`, puis `nvm alias default 24`.

!!! warning "Attention"
    `make api` ne démarre que l'API : la base, NATS et Keycloak doivent déjà être accessibles, d'où l'étape
    `make port-forward`. Sans elle, l'API tente sa connexion dix fois, puis s'arrête.

!!! tip "Astuce"
    NestJS 12 est publié au format ESM. Les tests sont donc lancés avec l'option `--experimental-vm-modules`. Dans
    WebStorm, ajouter cette option aux options de Node de la configuration Jest, sans quoi les tests ne démarrent pas.

## Pour aller plus loin

- [Site officiel de NestJS](https://nestjs.com/)
- [Documentation de NestJS](https://docs.nestjs.com/)
- [Documentation de TypeORM](https://typeorm.io/)
- [Norme RFC 9457 sur les réponses d'erreur](https://www.rfc-editor.org/rfc/rfc9457.html)
- [Fiche Jest du projet](jest.md), [Supertest](supertest.md) et [Testcontainers](testcontainers.md), pour les tests
