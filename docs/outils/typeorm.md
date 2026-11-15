# TypeORM

## Fiche d'identité

| Information | Détail |
|---|---|
| **Version** | 1.1.2, via `@nestjs/typeorm` 12.0.3 |
| **Rôle** | Relie les classes TypeScript aux tables PostgreSQL, gère le pool de connexions et applique les migrations au démarrage |
| **Catégorie** | Accès aux données |
| **Utilisé par** | L'API (base `pme`) et le service de modération (base `moderation`) |
| **Alternative écartée** | Requêtes SQL écrites à la main : plus de contrôle, mais aucune protection contre l'injection par construction |
| **Documentation** | [typeorm.io](https://typeorm.io/) |

## Description

Les deux services écrivent et lisent dans PostgreSQL. Entre l'objet manipulé par le code et la ligne stockée en base,
il faut une traduction : c'est le rôle de TypeORM.

**Le problème : une requête construite à la main est une faille en puissance.**
Assembler du SQL par concaténation de chaînes, c'est ouvrir la porte à l'injection dès qu'une valeur vient d'un
membre. Et c'est répéter, à chaque requête, la même conversion entre colonnes `snake_case` et propriétés
`camelCase`.

**La réponse : des entités et un dépôt.**
Une classe annotée décrit la table — `Listing` pour les annonces, `ModerationItem` pour la file. TypeORM en déduit le
SQL et passe toujours les valeurs en paramètres, jamais dans le texte de la requête. L'injection SQL n'est donc pas
évitée par vigilance, elle est évitée par construction.

**Le schéma n'est jamais deviné : il est versionné.**
`synchronize` est à `false` dans les deux services. TypeORM sait modifier une base pour la faire ressembler aux
entités, mais cette commodité est dangereuse : elle peut supprimer une colonne devenue inutile, donc des données. Le
schéma est décrit par des migrations, dans `src/migrations/`, appliquées au démarrage (`migrationsRun: true`). Chaque
migration porte un `up` et un `down` : l'historique est rejouable, et un cluster neuf reproduit la même base.

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

service: "Service NestJS\nListingsService" {class: boite}
depot: "Dépôt TypeORM\nsave, find, insert" {class: boite}
sql: "SQL paramétré\nvaleurs jamais concaténées" {class: boite}
pool: "Pool de connexions\n10 pour l'API, 5 pour la modération" {class: boite}
base: "PostgreSQL\nTLS, certificat vérifié" {class: boite}

migrations: "Migrations\nsrc/migrations/" {class: boite}
schema: "Schéma de la base\ntables, index, contraintes" {class: boite}

service -> depot
depot -> sql
sql -> pool
pool -> base
migrations -> schema: au démarrage
schema -> base
```

**Définitions**

| Terme | Définition |
|---|---|
| **ORM** | Bibliothèque qui fait correspondre des objets du code et des lignes d'une base relationnelle. |
| **Entité** | Classe annotée qui décrit une table : ses colonnes, leurs types, ses index. |
| **Dépôt** | Objet fourni par TypeORM pour lire et écrire les lignes d'une entité, sans écrire de SQL. |
| **Migration** | Script versionné qui fait passer le schéma d'un état au suivant, avec son inverse. |
| **Pool de connexions** | Réserve de connexions ouvertes à la base, partagées par les requêtes d'un même service. |

## Rôle dans le projet

- Il décrit les deux tables du projet : `listings` côté API, `moderation_queue` côté modération.
- Il protège contre l'injection SQL : toutes les valeurs passent en paramètres, y compris celles qui viennent du
  formulaire de dépôt.
- Il applique les migrations au démarrage de chaque service : un cluster recréé obtient le même schéma sans geste
  manuel.
- Il plafonne les connexions : `DB_POOL_SIZE` vaut 10 pour l'API et 5 pour la modération. Ce plafond est **par pod** ;
  il évite que l'autoscaler, en ajoutant des exemplaires, sature PostgreSQL.
- Il chiffre la connexion à la base dès que l'autorité de certification est fournie, et vérifie que le certificat du
  serveur a bien été émis pour le nom `postgres`.
- Il remonte l'erreur de clé dupliquée (`23505`) au service de modération, qui s'en sert pour ignorer un message
  rejoué : c'est ce qui rend le traitement idempotent.

!!! note "À savoir"
    Les deux migrations portent le même horodatage, `1730000000000`, parce qu'elles vivent dans deux bases
    différentes et ne se croisent jamais. Une migration ajoutée dans un service devra en revanche porter un
    horodatage supérieur à celui de la précédente du **même** service : c'est cet ordre qui décide de l'exécution.

## Fichiers et dossiers principaux

| Fichier ou dossier | Description |
|---|---|
| **`api/src/listings/listing.entity.ts`** | L'entité `Listing` : colonnes, index, statut par défaut. |
| **`api/src/migrations/`** | Les migrations qui créent la table `listings` et son index, puis la font évoluer, dont la table de référence `categories`. |
| **`moderation-service/src/moderation/moderation-item.entity.ts`** | L'entité de la file de modération. |
| **`moderation-service/src/migrations/`** | La migration qui crée la table de la file. |
| **`api/src/app.module.ts`** | La configuration : TLS, entités, migrations, pool, tentatives de reconnexion. |
| **`libs/common/src/config/env.ts`** | La lecture des variables d'environnement, dont `DB_POOL_SIZE`. |

## Commandes essentielles

À lancer dans un terminal, depuis le dossier du projet.

| Commande | Description |
|---|---|
| **`make test`** | Tests unitaires des quatre modules, dépôts simulés : aucune base nécessaire. |
| **`make test-integration`** | Tests sur une vraie base PostgreSQL lancée par Testcontainers, migrations comprises. |
| **`make adminer`** | Ouvre Adminer pour inspecter les tables créées par les migrations. |
| **`kubectl -n pme logs deploy/pme-api`** | Affiche le démarrage de l'API, dont l'exécution des migrations. |

!!! warning "Attention"
    Ne jamais repasser `synchronize` à `true`, même « juste pour essayer en local ». TypeORM aligne alors la base sur
    les entités sans demander : une colonne renommée dans le code devient une colonne supprimée puis recréée, et les
    données qu'elle contenait disparaissent. Toute évolution du schéma passe par une migration.

!!! tip "Astuce"
    Pour voir le SQL réellement envoyé pendant un test, ajouter `logging: true` à la configuration TypeORM du test.
    C'est le moyen le plus rapide de comprendre pourquoi une requête `find` ramène trop de lignes : le `take` et le
    `where` apparaissent tels qu'ils sont traduits.

## Pour aller plus loin

- [Documentation de TypeORM](https://typeorm.io/)
- [Migrations avec TypeORM](https://typeorm.io/migrations)
- [PostgreSQL dans le projet](postgresql.md)
- [Défenses applicatives](../securite/application.md)
