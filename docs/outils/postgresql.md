# PostgreSQL

## Fiche d'identité

| Information | Détail |
|---|---|
| **Rôle** | Conserve toutes les données de la plateforme : annonces, file de modération, comptes et tableaux de bord |
| **Version** | PostgreSQL 18 |
| **Chiffrement** | TLS 1.3 obligatoire pour toute connexion venant du réseau, en plus du mTLS du maillage [Istio](istio.md) |
| **Adresse en local** | `localhost:5432`, après `make port-forward` |

## Description

PostgreSQL est un **système de gestion de bases de données** open source, parmi les plus utilisés au monde. Il range
les données dans des **tables**, c'est-à-dire des tableaux composés de lignes et de colonnes, et se pilote avec le
langage **SQL**.

**Pourquoi une base de données plutôt que des fichiers ?**
Une base apporte trois garanties qu'un simple fichier n'offre pas. Elle contrôle la forme des données : une annonce
sans titre est refusée à l'écriture. Elle gère les accès simultanés : deux membres peuvent déposer une annonce au même
instant sans que l'une écrase l'autre. Enfin, elle garantit que chaque modification est enregistrée **en entier ou pas
du tout** : si une panne survient au milieu d'une écriture, la base revient à son état précédent plutôt que de
conserver une donnée à moitié écrite.

**Une instance, quatre bases.**
Un même programme PostgreSQL, appelé **instance**, peut héberger plusieurs bases indépendantes. Le projet en utilise
quatre, qui ne se voient pas entre elles : chaque composant n'accède qu'à la sienne. Une seule instance suffit donc, ce
qui économise la mémoire de l'ordinateur sans mélanger les données.

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

api: "API" {class: boite}
moderation: "Service\nde modération" {class: boite}
keycloak: "Keycloak" {class: boite}
grafana: "Grafana" {class: boite}

postgres: "PostgreSQL : une instance, un volume de 1 Go" {
  class: boite
  pme: "Base pme\nannonces" {class: boite}
  moderation_db: "Base moderation\nfile de relecture" {class: boite}
  keycloak_db: "Base keycloak\ncomptes et rôles" {class: boite}
  grafana_db: "Base grafana\ntableaux de bord" {class: boite}
}

api -> postgres.pme
moderation -> postgres.moderation_db
keycloak -> postgres.keycloak_db
grafana -> postgres.grafana_db
```

**Les connexions sont chiffrées, et le serveur l'impose.**
Toute connexion venant du réseau doit être chiffrée : le serveur refuse les connexions en clair, au lieu de laisser le
choix aux applications. Son certificat est émis par l'autorité locale du cluster (voir
[cert-manager](cert-manager.md)). Les applications vérifient en retour ce certificat et le nom du serveur, réglage
appelé `verify-full` : une machine qui se ferait passer pour la base serait démasquée. Seules deux voies échappent à
cette règle, parce qu'elles ne passent pas par le réseau : les sondes de Kubernetes, qui interrogent le pod sur sa
propre adresse, et les commandes lancées à l'intérieur du pod. Le maillage [Istio](istio.md) enveloppe ces connexions
d'une seconde couche de chiffrement, sans les remplacer : le serveur continue d'imposer son propre TLS, et les
applications de vérifier son certificat. Le maillage n'ouvre en outre le port 5432 qu'à cinq composants : l'API, le
service de modération, Keycloak, Grafana et Adminer.

**Les données survivent au redémarrage, pas à la suppression.**
Un conteneur est éphémère : tout ce qu'il écrit disparaît avec lui. Les données de PostgreSQL sont donc rangées sur un
**volume persistant** de 1 Go, séparé du conteneur. Le pod peut être relancé ou remplacé sans perte. En revanche, le
volume appartient au namespace : il disparaît avec lui.

**Le schéma des tables est décrit par des migrations.**
Les tables ne sont pas créées à la main. Chaque modification du schéma est écrite dans un fichier de **migration**,
versionné avec le code et joué au démarrage de l'application. Deux développeurs obtiennent ainsi exactement la même
base, et le passage d'une version à l'autre est reproductible.

**Définitions**

| Terme | Définition |
|---|---|
| **Base de données** | Espace qui regroupe les tables d'une même application. |
| **Connexion** | Canal ouvert entre une application et la base. Leur nombre est limité, car chacune consomme de la mémoire. |
| **Instance** | Programme PostgreSQL en fonctionnement. Il héberge une ou plusieurs bases. |
| **Migration** | Fichier qui décrit une modification du schéma, par exemple l'ajout d'une table ou d'une colonne. |
| **`pg_hba.conf`** | Fichier qui décide qui peut se connecter, depuis où et avec quelles exigences. |
| **Schéma** | Description de la structure d'une base : ses tables, leurs colonnes et leurs contraintes. |
| **SQL** | Langage qui sert à lire et à modifier les données d'une base. |
| **Table** | Tableau de données : chaque ligne est un enregistrement, chaque colonne une information. |
| **TLS** | Technique qui chiffre une connexion et prouve l'identité du serveur. |
| **Transaction** | Groupe de modifications appliquées ensemble : soit toutes réussissent, soit aucune. |
| **`verify-full`** | Réglage du client qui exige le chiffrement, vérifie le certificat du serveur et son nom. |
| **Volume persistant** | Espace de stockage dont le contenu survit à l'arrêt ou au remplacement d'un pod. |

## Rôle dans le projet

- Il conserve toutes les données durables de la plateforme. Chaque composant a sa base :
    - `pme` : les annonces déposées par les membres ;
    - `moderation` : la file des annonces à relire ;
    - `keycloak` : les comptes, les rôles et les sessions ;
    - `grafana` : les tableaux de bord et leurs réglages.
- Il garantit la cohérence des données : une annonce incomplète ou en double est refusée par la base elle-même, et non
  seulement par le code de l'API.
- Il n'accepte du réseau que des connexions chiffrées, avec un certificat émis par cert-manager.
- Il limite le nombre de connexions ouvertes, afin qu'aucune application ne puisse à elle seule saturer le serveur.
- Sans lui, plus rien n'est conservé : les annonces disparaissent, les comptes ne sont plus reconnus et ni l'API ni
  Keycloak ne démarrent.

Le serveur accepte 100 connexions au maximum. Chaque composant dispose d'un plafond, calculé pour que le total reste
sous cette limite même lorsque l'autoscaler ajoute des exemplaires :

| Composant | Plafond par exemplaire | Exemplaires au maximum | Total |
|---|---|---|---|
| **API** | 10 | 4 | 40 |
| **Service de modération** | 5 | 4 | 20 |
| **Keycloak** | 10 au total | 1 | 10 |
| **Grafana** | 10 au total | 1 | 10 |
| **Total** | | | **80** |

!!! note "À savoir"
    Les 20 connexions restantes servent aux déploiements, pendant lesquels d'anciens et de nouveaux pods coexistent, et
    aux consultations ponctuelles avec [Adminer](adminer.md). Toute modification d'un plafond ou du nombre maximal
    d'exemplaires impose de refaire ce calcul, détaillé dans `k8s/01-postgres.yaml`.

## Fichiers et dossiers principaux

| Fichier ou dossier | Description |
|---|---|
| **`k8s/01-postgres.yaml`** | Déploie PostgreSQL dans le cluster, avec son volume de données. |
| **`k8s/config/postgres-init.sh`** | Crée les bases supplémentaires à la première initialisation du volume. |
| **`k8s/config/postgres-hba.conf`** | Impose le chiffrement aux connexions venant du réseau. |
| **`k8s/00-internal-tls.yaml`** | Demande à cert-manager le certificat du serveur. |
| **`api/src/migrations/`** | Contient les migrations qui créent et font évoluer les tables des annonces. |
| **`moderation-service/src/migrations/`** | Contient les migrations de la file de modération. |
| **`api/src/config/configuration.ts`** | Lit les paramètres de connexion de l'API, dont le plafond de connexions. |
| **`.env`** | Contient l'identifiant et le mot de passe de la base. Ce fichier est exclu de Git. |

## Commandes essentielles

À lancer dans un terminal, depuis le dossier du projet, le cluster démarré.

| Commande | Description |
|---|---|
| **`make deploy`** | Installe PostgreSQL avec le reste de la plateforme. |
| **`make pods`** | Indique si PostgreSQL est prêt. |
| **`make port-forward`** | Rend la base joignable depuis l'ordinateur, sur le port 5432. |
| **`make db-listings`** | Affiche les annonces enregistrées. |
| **`make db-moderation`** | Affiche les annonces en attente de modération. |
| **`make create-grafana-db`** | Crée la base de Grafana sur un cluster déjà installé. |
| **`make ca-configmap`** | Copie l'autorité locale dans le namespace, pour que les applications vérifient le certificat. |

!!! note "À savoir"
    Le script de création des bases ne s'exécute qu'à la toute première initialisation du volume. Sur un cluster déjà
    installé, une base manquante se crée avec la commande dédiée, par exemple `make create-grafana-db`.

!!! warning "Attention"
    `make undeploy` supprime le namespace, donc le volume : toutes les données sont perdues, annonces et comptes
    compris. Cette commande est à réserver au cas où l'on souhaite repartir de zéro.

!!! tip "Astuce"
    PostgreSQL ne relit son certificat qu'au démarrage. Après un renouvellement, relancer le pod avec
    `kubectl -n pme rollout restart deploy/postgres`, sans quoi il continue de présenter l'ancien certificat.

## Pour aller plus loin

- [Site officiel de PostgreSQL](https://www.postgresql.org/)
- [Documentation de PostgreSQL 18](https://www.postgresql.org/docs/18/)
- [Documentation du fichier `pg_hba.conf`](https://www.postgresql.org/docs/18/auth-pg-hba-conf.html)
