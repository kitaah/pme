# Conception : dépôt d'annonce avec photo

## Fiche d'identité

| Information | Détail |
|---|---|
| **Objet** | Enrichir le dépôt d'annonce : titre, description, état, photo, puis confirmation par un message et redirection. Le formulaire propose l'échange, le don et la vente, avec les champs propres à chaque type |
| **Périmètre** | Celui du POC : connexion, dépôt, prise en charge par le service de modération. La décision du modérateur est hors périmètre |
| **Conteneur C4 concerné** | « Stockage de fichiers » (stockage objet S3), déjà prévu au C4 niveau 2 : aucun conteneur nouveau. Stockage retenu : Garage (S3 compatible) dans Minikube, en remplacement local de l'hébergeur européen |
| **Photo** | Une seule par annonce, facultative, 5 Mo maximum, formats JPEG, PNG ou WebP |
| **Référentiels** | RGAA 4 (accessibilité), C4 niveau 2 (architecture), Keycloak 26.8.1 |

## Description

Le dépôt d'annonce actuel ne capture pas assez d'informations pour une place de marché : pas de titre séparé, pas de
photo, des états peu conventionnels, pas de prix. Cette évolution complète le formulaire, ajoute le stockage de la photo
dans le conteneur prévu pour cela, et améliore le parcours : message de confirmation puis retour à la liste des annonces.

**Le problème : où mettre la photo ?**
Une image dans PostgreSQL alourdirait la base du cœur et ferait d'elle un stockage de fichiers, alors que le C4 niveau 2
prévoit un conteneur dédié, « Stockage de fichiers », de technologie « Stockage objet S3 (hébergeur européen) ».

**La réponse : un stockage objet, la base ne garde que la clé.**
L'API enregistre le fichier dans le stockage objet et ne conserve en base que `photo_key` et `photo_mime`. L'événement
envoyé sur le bus ne transporte que cette clé, jamais le fichier.

## Décisions prises

| Sujet | Décision | Raison |
|---|---|---|
| **Stockage des photos** | S3 dans un conteneur séparé, pas dans PostgreSQL | Conforme au C4 niveau 2 (relation 25) |
| **Implémentation S3** | Garage | MinIO n'a plus d'image officielle ni de développement actif ; Garage est léger et européen |
| **Nombre de photos** | Une seule | Suffit à démontrer le parcours ; plusieurs photos ajoutent une table sans rien démontrer de plus |
| **Types d'annonce** | Le modèle de données, l'API et le formulaire gèrent Échange, Don et Vente. Échange : contrepartie souhaitée (facultative). Vente : prix obligatoire, de 0,01 à 9 999,99 €. Don : ni prix ni contrepartie | Un seul formulaire pour les trois types ; un prix ne peut accompagner qu'une vente, ce que garantit aussi une contrainte de base |
| **Lecture des photos** | URL signée de courte durée, générée par l'API | La photo d'une annonce non modérée ne doit pas être publique |
| **Photo en attente de validation** | Affichée à son auteur dans « Mes annonces », avec le statut « En attente de validation » ; invisible des autres membres | Le membre doit pouvoir vérifier sa photo sans attendre la modération |
| **États de l'objet** | Quatre états, stockés sous forme de codes anglais (`NEW`, `VERY_GOOD`, `GOOD`, `FAIR`) et affichés en français : Neuf, Très bon état, Bon état, Satisfaisant | Grille des grandes places de marché (Vinted, Amazon, eBay : un état neuf puis trois niveaux d'occasion, le dernier étant une usure marquée sur un objet qui fonctionne). Un objet à réparer n'a pas de niveau à part : le défaut se précise dans la description. Les codes anglais suivent ceux du dépôt |
| **Catégories** | Table de référence `categories` (huit catégories au départ : `FIGURINES`, `FILMS`, `BOOKS`, `POSTERS`, `MUSIC`, `GAMES`, `CLOTHING`, `OTHER`), référencée par une clé étrangère ; « Autres » sert de valeur par défaut | Aide à retrouver une annonce dans un catalogue d'horreur et de pop culture. Les catégories se gèrent comme des données (ajout, retrait, ordre) sans déploiement, et la base garantit qu'une annonce a une catégorie existante |
| **Confirmation** | Toast « Annonce soumise pour validation ! » en haut à droite, sous l'en-tête, 8 secondes, puis redirection vers la liste | Demande du porteur du projet |
| **Langue de Keycloak** | Français seul (`en` retiré de `supportedLocales`), donc plus de sélecteur de langue | Le sélecteur disparaît quand le realm n'a qu'une langue |
| **Thème de connexion Keycloak** | Création d'un thème `pme` (le dépôt n'en contient aucun), qui reprend la palette « Nuit de festival » | La page de connexion doit suivre le reste de l'application |
| **Inscription** | Ouverte : `registrationAllowed` passe à `true`, donc le lien « Créer un compte » de la maquette apparaît sous le formulaire | La maquette le montre ; un compte créé n'a aucun rôle tant que `membre` n'est pas ajouté aux rôles par défaut du realm |
| **Nom de la rubrique** | « Espace membre » | La rubrique couvre l'échange, le don et la vente, pas seulement le troc |
| **Lieu de remise** | Table de référence `handover_places` : les quatre magasins de l'entreprise, ou « à convenir », référencée par une clé étrangère | Sans lieu, une annonce d'échange n'est pas exploitable. Une liste de lieux gérée par l'entreprise ne collecte aucune donnée personnelle, et ouvrir ou fermer un magasin se fait sans déploiement, et la remise en magasin prolonge l'activité de l'enseigne. Une adresse précise serait incohérente : les métadonnées EXIF de la photo, position GPS comprise, sont justement retirées |

## Conformité au C4 niveau 2

| Relation C4 | Rôle dans cette évolution | Conforme |
|---|---|---|
| **24** Cœur → Base du cœur | Écrit l'annonce et la clé de la photo | Oui |
| **25** Cœur → Stockage de fichiers | Écrit la photo (API S3, binaire) | Oui |
| **26** Cœur → Bus | Publie l'événement `listing.submitted` avec la clé de la photo | Oui |
| **31** Bus → Modération | Distribue l'annonce à modérer | Oui |
| **13** App. publique → Stockage de fichiers | Le navigateur lit la photo en HTTPS | Oui |

Deux règles découlent du C4 :

- **Seul le Cœur écrit dans le stockage.** Le navigateur n'écrit jamais directement : l'upload passe par l'API.
- **Le service de modération n'a aucune relation avec le stockage.** Il reçoit la clé de la photo dans l'événement, mais
  ne lit ni n'écrit aucun fichier. Dans le C4 complet, c'est le Cœur qui déplacerait la photo à la réception de la décision
  de modération ; ce circuit est hors périmètre du POC.

Une troisième règle découle aussi du C4 : **la modération a sa propre base**. Elle n'a aucun accès à la base `pme` du
Cœur, et l'API n'en a aucun à la sienne. Chaque base a son compte PostgreSQL (`pme_api`, `pme_moderation`), propriétaire de
cette seule base ; les deux partagent la même instance, par économie de mémoire (voir [PostgreSQL](outils/postgresql.md)).

**Écarts assumés du POC.** Deux écarts avec le niveau 2 sont des simplifications, et aucun n'altère la chaîne démontrée :

- **Pas de Back-office séparé.** Le C4 prévoit un Back-office où le modérateur passe par la Passerelle et le Cœur. Le POC
  n'a qu'une interface React pour tous les rôles, et Traefik expose directement `/api/v1/moderation` : la décision du
  modérateur étant hors périmètre, seule la consultation de la file existe.
- **Une instance PostgreSQL unique.** Les deux bases du C4 sont séparées par leurs comptes et leurs droits, pas par deux
  serveurs. En production, chaque service aurait sa propre instance : seule l'adresse du serveur changerait.

La lecture des photos par le navigateur (relation 13) passe, dans le POC, par l'ingress Traefik : il relaie la requête
sans valider de jeton ni exécuter de code applicatif, comme le ferait l'adresse publique d'un hébergeur S3
(voir [Architecture](architecture.md)).

!!! note "À savoir"
    Dans le POC, la photo reste sous le préfixe `pending/` du bucket : la décision du modérateur n'étant pas
    traitée, rien ne la déplace vers `published/`. Le membre voit sa propre photo par une URL signée fournie par l'API.

## Parcours

1. **Connexion.** Le membre arrive sur la page de connexion Keycloak, en français, sans sélecteur de langue. Le champ
   s'intitule « Nom d'utilisateur ou email ».
2. **Formulaire.** Après connexion, la page « Déposer une annonce » s'affiche : type d'annonce (échange, don ou vente),
   catégorie, état, titre, description, lieu de remise et photo (facultative). Les listes de catégories et de lieux de
   remise sont demandées à l'API (`GET /api/v1/categories` et `GET /api/v1/handover-places`) à l'ouverture de la page. Selon le type, le formulaire montre ce qui
   est recherché en échange (facultatif) ou le prix, et n'affiche rien pour un don.
3. **Envoi.** Le navigateur envoie le formulaire en multipart à `POST /api/v1/listings`, avec le jeton.
4. **Contrôles à l'entrée.** Traefik limite la taille du corps (6 Mo), le débit et vérifie le jeton.
5. **Traitement par l'API.** L'API valide les champs, puis traite la photo : le ré-encodage en WebP est lui-même le
   contrôle, car seul un fichier que la bibliothèque d'images sait décoder passe, et il supprime au passage les
   métadonnées EXIF, dont la position GPS. L'image réduite est enregistrée sous `pending/<identifiant>.webp`, puis
   l'annonce est écrite en base avec le statut « en attente de validation ». Si la base refuse l'annonce, la photo
   déjà enregistrée est supprimée.
6. **Événement.** L'API publie `listing.submitted` dans NATS avec la clé de la photo, puis répond `201`.
7. **Confirmation.** Le navigateur redirige vers la page des annonces et affiche le toast « Annonce soumise pour
   validation ! » en haut à droite, sous l'en-tête pour ne pas masquer le bouton de déconnexion. Les maquettes le présentent
   à part. Sur mobile, il prend toute la largeur sous l'en-tête.
8. **Liste.** La page affiche les annonces du membre avec leur photo, y compris celle de l'annonce qui vient d'être
   déposée et que la modération n'a pas encore traitée (URL signée de 5 minutes), et le statut « En attente de
   modération ».
9. **Modération.** Le service de modération consomme l'événement et place l'annonce dans sa file. La décision est hors
   périmètre.

Si le dépôt échoue (photo refusée, service indisponible), aucun toast de succès n'est affiché : le formulaire reste
ouvert avec un message d'erreur, et la photo éventuellement déjà enregistrée est supprimée.

## Modèle de données

Le schéma montre les quatre tables et leurs deux bases. Dans la base `pme`, `listings` pointe vers les tables de référence `categories` et `handover_places` par des clés étrangères. Le service de modération a sa propre base : il ne garde que le code de la catégorie et du lieu, reçu dans l'événement, et rien ne le relie par une clé étrangère à la base `pme`.

```d2
vars: {
  d2-config: {
    layout-engine: elk
    theme-id: 5
    pad: 8
  }
}
direction: right

classes: {
  table: {
    style: {
      font-size: 20
    }
  }
  lien: {
    style: {
      font-size: 18
    }
  }
}

pme: "Base pme\n(compte pme_api, propriétaire)" {
  style.font-size: 22

  categories: "categories" {
    class: table
    shape: sql_table
    id: smallint {constraint: primary_key}
    code: "varchar(30)" {constraint: unique}
    "label": "varchar(60)"
    sort_order: smallint
    active: boolean
  }

  handover_places: "handover_places" {
    class: table
    shape: sql_table
    id: smallint {constraint: primary_key}
    code: "varchar(30)" {constraint: unique}
    "label": "varchar(60)"
    sort_order: smallint
    active: boolean
  }

  listings: "listings" {
    class: table
    shape: sql_table
    id: uuid {constraint: primary_key}
    owner_id: uuid
    owner_username: "varchar(100)"
    title: "varchar(100)"
    description: "varchar(1000)"
    condition: "varchar(20)"
    category_id: smallint {constraint: foreign_key}
    kind: "varchar(20)"
    price_cents: "integer"
    wanted_in_exchange: "varchar(120)"
    handover_place_id: smallint {constraint: foreign_key}
    photo_key: "varchar(200)"
    photo_mime: "varchar(40)"
    status: "varchar(30)"
    created_at: timestamptz
    updated_at: timestamptz
  }

  listings.category_id -> categories.id: "catégorie" {class: lien}
  listings.handover_place_id -> handover_places.id: "lieu" {class: lien}
}

moderation: "Base moderation\n(compte pme_moderation, propriétaire)" {
  style.font-size: 22

  moderation_queue: "moderation_queue" {
    class: table
    shape: sql_table
    id: uuid {constraint: primary_key}
    listing_id: uuid {constraint: unique}
    owner_id: uuid
    owner_username: "varchar(100)"
    title: "varchar(100)"
    description: "varchar(1000)"
    condition: "varchar(20)"
    category: "varchar(30)"
    kind: "varchar(20)"
    price_cents: "integer"
    wanted_in_exchange: "varchar(120)"
    handover_place: "varchar(30)"
    photo_key: "varchar(200)"
    status: "varchar(20)"
    submitted_at: timestamptz
    received_at: timestamptz
  }
}

moderation.moderation_queue.listing_id -> pme.listings.id: "même annonce, par l'événement\n(aucune clé étrangère entre deux bases)" {
  class: lien
  style.stroke-dash: 4
}
```

Table `listings`, base `pme` :

| Colonne | Type | Règle |
|---|---|---|
| **`title`** | texte | 3 à 100 caractères, obligatoire (inchangé) |
| **`description`** | texte | 1000 caractères maximum, obligatoire (inchangé) |
| **`category_id`** | clé étrangère | Référence `categories.id`, obligatoire. L'API reçoit et renvoie le code (`FIGURINES`…, `OTHER` par défaut) |
| **`condition`** | énumération | `NEW`, `VERY_GOOD`, `GOOD`, `FAIR` (`NEW`, `GOOD`, `FAIR` existent déjà) |
| **`kind`** | énumération | `EXCHANGE` (valeur par défaut), `GIFT`, `SALE` |
| **`wanted_in_exchange`** | texte | Facultatif, 120 caractères maximum, saisi pour un échange |
| **`handover_place_id`** | clé étrangère | Référence `handover_places.id`, obligatoire. L'API reçoit le code (`SHOP_LYON`…, `TO_AGREE` par défaut) et renvoie le code avec son libellé |
| **`price_cents`** | entier | Obligatoire si `SALE` (1 à 999 999), vide sinon, garanti par une contrainte de base. En centimes, jamais en nombre décimal |
| **`photo_key`** | texte | Clé de l'objet dans le bucket (`pending/<identifiant>.webp`), vide si pas de photo |
| **`photo_mime`** | texte | Type de l'image stockée, vide si pas de photo |

Le statut existant (`PENDING_MODERATION`) reste inchangé. Les migrations initiales ne sont pas modifiées : cinq
nouvelles migrations TypeORM, présentes dans l'API ou dans le service de modération (deux bases séparées), font
évoluer les tables.

1. `1763100000000-add-listing-details` ajoute les colonnes du dépôt et remplace la contrainte `CHECK` de `condition`.
2. `1763200000000-remove-for-parts-condition` retire l'état `FOR_PARTS` : les annonces et les éléments de la file qui
   l'avaient passent en `FAIR` (« Satisfaisant »), puis la contrainte est remplacée par les quatre valeurs restantes.
3. `1763300000000-add-listing-category` ajoute la colonne `category`, décrite ci-dessous.
4. `1763400000000-create-categories-table` (API) remplace cette colonne par la table `categories` ; `1763400000000-open-category-code` (modération) en retire la contrainte `CHECK`.
5. `1763500000000-create-handover-places-table` (API) remplace la colonne `handover_place` par la table `handover_places` ; `1763500000000-open-handover-place-code` (modération) en retire la contrainte `CHECK` et porte la colonne à 30 caractères.

Le validateur de l'événement reçu par le service de modération accepte les nouveaux codes.

La migration `1763300000000-add-listing-category` ajoute la colonne `category` (`VARCHAR(30) NOT NULL DEFAULT 'OTHER'`) avec une contrainte `CHECK` sur les
huit codes. Elle a ensuite été remplacée par une table de référence, décrite ci-dessous.

**Une table de référence plutôt qu'une énumération.** La migration `1763400000000-create-categories-table` crée la table
`categories` (`id`, `code` unique, `label`, `sort_order`, `active`) et la remplit avec les huit catégories de départ.
`listings.category_id` la référence par une clé étrangère, remplie à partir de l'ancienne colonne `category`, puis la
colonne et sa contrainte `CHECK` sont supprimées : les annonces déjà en base gardent leur catégorie. Le retour arrière
recrée la colonne ; une catégorie ajoutée depuis retombe alors sur `OTHER`.

- **Ajouter ou retirer une catégorie** est une ligne dans la table (`INSERT`, ou `active = false`), sans déploiement. Une
  catégorie retirée n'est plus proposée mais reste lisible sur les annonces qui l'ont.
- **L'API** expose la liste par `GET /api/v1/categories` (code et libellé, catégories proposées, dans l'ordre
  d'affichage) et renvoie la catégorie d'une annonce sous la forme de son code. Un code inconnu ou retiré est refusé
  (erreur 400) avant tout enregistrement de la photo. Le formulaire construit sa liste à partir de cette réponse : plus
  aucun libellé de catégorie n'est écrit dans l'interface.
- **Le service de modération** ne garde que le code reçu dans l'événement, sans clé étrangère : les deux services ont
  chacun leur base, et la file doit continuer à recevoir une annonce même si une catégorie est retirée ensuite. La
  migration `1763400000000-open-category-code` y supprime la contrainte `CHECK` qui figeait les huit codes, et le
  validateur de l'événement ne contrôle plus que la forme du code.
- **Le lieu de remise suit le même principe** : la table `handover_places` (`id`, `code` unique, `label`, `sort_order`,
  `active`) contient les quatre magasins et « à convenir » (`TO_AGREE`, le lieu par défaut), `listings.handover_place_id`
  la référence, et l'API expose `GET /api/v1/handover-places`. Contrairement à la catégorie, l'API renvoie le lieu d'une
  annonce avec son code **et** son libellé, pour que « Mes annonces » l'affiche sans autre appel, même si le magasin est
  fermé depuis. Le retour arrière ramène un lieu ajouté depuis à `TO_AGREE`.
- **Les autres listes** (état, type d'annonce) restent des énumérations avec contrainte `CHECK` : elles portent des
  règles de gestion (le prix dépend du type) et ne changent pas sans modification du code.

Catégories de départ :

| Code | Libellé affiché |
|---|---|
| **`FIGURINES`** | Figurines et statues |
| **`FILMS`** | Films |
| **`BOOKS`** | Livres et fanzines |
| **`POSTERS`** | Affiches et goodies |
| **`MUSIC`** | Musique |
| **`GAMES`** | Jeux |
| **`CLOTHING`** | Vêtements |
| **`OTHER`** | Autres |

Lieux de remise de départ :

| Code | Libellé affiché |
|---|---|
| **`SHOP_ANGOULEME`** | Magasin d’Angoulême |
| **`SHOP_AIX`** | Magasin d’Aix-en-Provence |
| **`SHOP_LYON`** | Magasin de Lyon |
| **`SHOP_LONDON`** | Magasin de Londres |
| **`TO_AGREE`** | À convenir avec le membre |

À l'écran, le front traduit les autres codes par des tables de correspondance (comme `CONDITION_LABELS` dans `api.ts`) :

| Code | Libellé affiché |
|---|---|
| **`NEW`** | Neuf |
| **`VERY_GOOD`** | Très bon état |
| **`GOOD`** | Bon état |
| **`FAIR`** | Satisfaisant |

Les types d'annonce suivent la même logique : `EXCHANGE` « Échange », `GIFT` « Don », `SALE` « Vente ».

## Interface de programmation et événement

| Élément | Détail |
|---|---|
| **Dépôt** | `POST /api/v1/listings`, `multipart/form-data` : champs texte et fichier `photo`. L'API accepte les trois types ; `kind` vaut `EXCHANGE` par défaut |
| **Liste** | `GET /api/v1/listings/mine` : chaque annonce renvoie `photoUrl`, URL signée valable 5 minutes, sa catégorie sous la forme de son code et son lieu de remise sous la forme `{ code, label }` |
| **Référentiels** | `GET /api/v1/categories` et `GET /api/v1/handover-places` : la liste des valeurs proposées, `[{ code, label }]`, dans l'ordre d'affichage. `category` et `handoverPlace` reçoivent un code de ces listes (facultatifs : « Autres » et « à convenir » par défaut) |
| **Erreurs** | `400` champ invalide (dont une catégorie ou un lieu de remise inconnu ou retiré), `413` fichier trop gros, `415` type de fichier refusé |
| **Événement** | `listing.submitted` : `listingId`, `ownerId`, `ownerUsername`, `title`, `description`, `condition`, `category`, `kind`, `priceCents`, `wantedInExchange`, `handoverPlace`, `photoKey`, `submittedAt`. Le prix, la contrepartie et la photo ne sont présents que s'ils existent. Les champs ajoutés sont facultatifs à la réception : pendant un déploiement progressif, un pod de l'API encore à l'ancienne version publie un message sans eux |

## Bibliothèques et composants à installer

### Front-end (`frontend/`)

| Paquet | Rôle |
|---|---|
| **`lucide-react`** | Icônes (déjà installée) : convention de shadcn/ui, importées une par une |
| **`react-router`** | Routes : formulaire, liste des annonces, redirection après dépôt |
| **`sonner`** | Toast : composant de toast de shadcn/ui, positionné en haut à droite, avec un décalage sous l'en-tête (`position="top-right"`, `offset`) |

### API (`api/`)

| Paquet | Rôle |
|---|---|
| **`@aws-sdk/client-s3`** | Client S3 : envoi, suppression, lecture. Le point d'accès est configurable (Garage en local, hébergeur européen ensuite) |
| **`@aws-sdk/s3-request-presigner`** | URL signées de lecture |
| **`@types/multer`** | Types pour l'upload multipart, géré par `FileInterceptor` de NestJS |
| **`class-validator`**<br>**`class-transformer`** | Validation des champs du formulaire |
| **`sharp`** | Décode, redimensionne et ré-encode l'image en WebP : un fichier qui n'est pas une image est refusé (415), et les métadonnées EXIF sont retirées |

### Infrastructure (`k8s/`)

| Composant | Rôle |
|---|---|
| **Garage** | Deployment avec volume persistant, service interne, image officielle `dxflrs/garage` en version fixée et épinglée par empreinte |
| **Mise en service** | `make garage-init`, lancé par `make deploy` : crée la disposition du nœud, le bucket, importe la clé d'accès de l'API, puis l'autorise sur le bucket. Aucun Job Kubernetes : le port d'administration n'est ouvert à personne |
| **Sealed Secret** | Les quatre secrets de Garage (clé d'accès, secret, secret RPC, jeton d'administration), générés dans `.env` par `make garage-secrets` |
| **Middlewares Traefik** | Limitent la taille du corps de requête sur `pme-api` (6 Mo) et le débit de lecture des photos sur `garage.localhost` (600 requêtes par minute) |
| **NetworkPolicy** | Autorise l'API vers Garage, et le navigateur vers Garage pour les URL signées |
| **Keycloak** | `realm-pme.json` : langue unique `fr`, thème `pme`, textes « Nom d'utilisateur ou email », « Se connecter » et « Se souvenir de moi » |

## Interface et accessibilité (RGAA)

- **Toast :** annoncé aux lecteurs d'écran par la région `aria-live` de Sonner, visible 8 secondes, mis en pause au
  survol et au focus, fermable au bouton « Fermer la notification ». Il survit à la redirection : il est monté au niveau
  de l'application, pas de la page. L'information n'est pas perdue à sa disparition : la nouvelle annonce reste
  affichée avec son statut « En attente de validation ». Les styles de Sonner sont importés depuis sa feuille CSS, car la
  politique de sécurité du site (`style-src 'self'`) bloque ceux qu'il injecterait lui-même.
- **Focus :** le titre de chaque page est focalisable (`tabIndex=-1`), mais le focus n'y est pas déplacé
  automatiquement après la redirection : à compléter.
- **Photo :** le texte alternatif reprend le titre de l'annonce.
- **Champs :** libellé visible associé à chaque champ, erreurs rattachées au champ concerné, champs obligatoires indiqués
  autrement que par la couleur seule.
- **Icônes :** décoratives (`aria-hidden`), sauf bouton-icône qui porte un nom accessible (`aria-label`).
- **Couleurs :** palette « Nuit de festival » décrite plus bas, avec tous ses codes et ses contrastes. Le test
  `theme.test.ts` contrôle 4,5:1 pour le texte et 3:1 pour les composants.

## Maquettes

Les maquettes sont dans le canevas « Maquettes — La Petite Maison de l'Épouvante ». Elles montrent sept écrans et une
notification.

| N° | Écran | Contenu |
|---|---|---|
| **1** | Connexion (Keycloak) | Titre « Connexion » centré, champ « Nom d'utilisateur ou email », lien d'inscription, aucun sélecteur de langue |
| **2** | Dépôt d'annonce | « Déposer une annonce » : choix du type (échange, don, vente), puis catégorie et état côte à côte, titre, description, « Je cherche en échange » (facultatif), lieu de remise, photo avec son aperçu, encart « Avant de publier ». Le champ « Prix » de la vente n'y est pas dessiné |
| **3** | Mes annonces | Quatre annonces avec photo et statut (En attente de validation, Publiée, Refusée) |
| **3b** | Notification de confirmation | Toast « Annonce soumise pour validation ! », en haut à droite sous l'en-tête |
| **4** | Dépôt sur mobile | Même formulaire en 390 px, bouton d'action en bas |
| **5** | Connexion sur mobile | Même page de connexion en 390 px |
| **6** | Mes annonces sur mobile | Une colonne de cartes, en 390 px |

Les maquettes montrent le type « Échange » ; pour une vente le champ « Prix » remplace la contrepartie, et pour un don aucun des deux ne s'affiche. Le lien « Annuler » a été retiré : le fil d'ariane « Mes annonces ›
Déposer une annonce » et l'en-tête assurent le retour, et le RGAA n'impose pas de bouton d'annulation pour ce formulaire.
La grille des annonces passe de trois colonnes à une seule selon la largeur de l'écran, et le bloc du membre reste à
droite de l'en-tête.

## Menu et pied de page

Ils reprennent les conventions d'un site marchand, à partir des activités décrites dans le contexte de l'entreprise :
fanzine, boutique, collectif Evil Ed, Petit Festival, actualités et espace membre (dépôt et suivi d'annonces).

| Zone | Contenu |
|---|---|
| **En-tête** | Logo et nom de l'entreprise, recherche de produit, nom du membre, rôle, panier, bouton de déconnexion |
| **Navigation principale** | Boutique, Fanzine, Evil Ed, Festival, Actualités, Espace membre. La rubrique courante porte `aria-current="page"` et un soulignement |
| **Pied de page, colonnes** | Boutique (figurines et goodies, films, bandes dessinées, jeux de société) ; Le fanzine (abonnement, numéros, newsletter) ; Evil Ed (web séries, éditions restaurées, soutien) ; L'entreprise (magasins, festival, actualités, contact) |
| **Pied de page, bas** | Accroche « Le lieu de rêve pour frissonner », hébergement en Europe, copyright, mentions légales, conditions générales de vente, données personnelles, cookies, accessibilité |
| **Mobile** | Bouton de menu, logo, panier et déconnexion sur une ligne, membre dessous ; pied de page en deux colonnes |

Le lien « Accessibilité : partiellement conforme » est une obligation légale du pied de page : le niveau réel sera fixé
après audit. La page de connexion n'a ni menu ni pied de page : Keycloak la rend seule, et c'est la convention.

Le panier, la recherche et les rubriques Boutique, Fanzine, Evil Ed et Festival situent l'espace membre dans la plateforme
complète. Ils ne font pas partie du POC : seuls la connexion, le dépôt d'annonce et la liste sont démontrés.

## Palette de couleurs « Nuit de festival »

Thème sombre. Les contrastes sont calculés selon la formule WCAG 2.1 ; les seuils du RGAA sont 4,5:1 pour le texte
courant et 3:1 pour les composants d'interface.

### Surfaces et traits

| Jeton | Code | Usage | Contraste avec le texte principal |
|---|---|---|---|
| **`page`** | `#110c16` | Fond de page | 17,2:1 |
| **`panel`** | `#1b1522` | Cartes, en-tête, pied de page | 15,9:1 |
| **`inset`** | `#271e30` | Champs de saisie, zones creusées | 14,2:1 |
| **`line`** | `#3b2f47` | Séparateurs et bordures de cartes, décoratifs | 1,3:1 à 1,6:1, hors exigence |
| **`control`** | `#9a8aa8` | Bordure des champs et des boutons-icônes | 5,0:1 à 6,0:1 (seuil 3:1) |

### Textes, sur `page`, `panel` et `inset`

| Jeton | Code | Usage | `page` | `panel` | `inset` |
|---|---|---|---|---|---|
| **`ink`** | `#f5f0f7` | Texte courant, titres | 17,2:1 | 15,9:1 | 14,2:1 |
| **`ink-muted`** | `#d4c9dc` | Texte secondaire, liens du pied de page | 12,1:1 | 11,2:1 | 10,0:1 |
| **`ink-faint`** | `#b8aac5` | Aides de saisie, mentions | 8,8:1 | 8,2:1 | 7,3:1 |
| **`blood-text`** | `#ff9aa3` | Liens, statut « Refusée », texte rouge | 9,6:1 | 8,8:1 | 7,9:1 |
| **`gold`** | `#e6b450` | Accent : sous-titre, rubrique courante, titres du pied de page | 10,1:1 | 9,4:1 | 8,4:1 |
| **`success`** | `#7fdba5` | Statut « Publiée », rôle « Membre », bordure du toast | 11,6:1 | 10,7:1 | 9,6:1 |
| **`warning`** | `#f2b866` | Statut « En attente de validation » | 10,9:1 | 10,1:1 | 9,0:1 |

### Actions et focus

| Jeton | Code | Usage | Contraste |
|---|---|---|---|
| **`blood`** | `#c9303f` | Fond du bouton principal et pastille du panier | Texte blanc `#ffffff` dessus : 5,3:1. Forme contre `page` 3,7:1, `panel` 3,4:1, `inset` 3,0:1 (seuil 3:1) |
| **`blood-dark`** | `#a82533` | Bouton principal au survol | Texte blanc dessus : 7,1:1 |
| **`focus`** | `#ffd479` | Anneau de focus de 2 px, décalé de 2 px | 11,4:1 à 13,7:1 sur les surfaces ; 3,8:1 sur `blood` et 5,0:1 sur `blood-dark` |
| **`on-gold`** | `#110c16` | Texte du bouton de recherche, sur fond `gold` | 10,1:1 |

Règles d'usage :

- **Rouge :** `blood` sert seulement de fond d'action principale. Sur fond sombre, un texte rouge utilise `blood-text`, plus
  clair, car `blood` seul n'atteindrait pas 4,5:1.
- **Information :** aucune information n'est portée par la couleur seule. Les statuts associent un libellé et une icône, et la
  rubrique courante du menu ajoute un soulignement et le gras.
- **Bouton désactivé :** il passe à 60 % d'opacité, ce que le RGAA admet pour un composant inactif.
- **Icônes décoratives :** le motif d'image vide des cartes (`#6b5a78`, 2,6:1) est décoratif, avec le texte alternatif porté
  par l'élément ; il n'est pas soumis au seuil.

**Application des codes.** Ces codes sont les jetons de `frontend/src/styles.css`. Le test `theme.test.ts` calcule le
contraste de chaque association réellement utilisée dans l'interface et dans le thème Keycloak.

### Thème de connexion Keycloak

Le dépôt ne contenait aucun thème : le thème `pme` (type `login`, hérité de `keycloak.v2`) a été créé. Sa feuille de style,
`k8s/config/keycloak-theme.css`, reprend les jetons de la palette et la police ; elle est montée dans le pod Keycloak par
une ConfigMap, puis le thème est déclaré dans `realm-pme.json` par `loginTheme`. Le realm n'étant importé qu'une fois, il
faut le réimporter ou repartir d'une base vide (`make reset`). Les libellés (« Nom d'utilisateur ou email », « Se
connecter », « Se souvenir de moi », « Pas encore de compte ? », « Créer un compte ») sont dans le fichier de messages du
thème, `k8s/config/keycloak-messages-fr.properties`, lu au démarrage de Keycloak sans réimporter le realm. L'apostrophe s'y
écrit en typographique (`d’utilisateur`, U+2019) : Keycloak formate ces textes comme des messages Java, et une apostrophe
droite disparaît (« Nom dutilisateur »), même doublée selon le chemin que suit le texte. Un libellé saisi dans la console (Realm settings, Localization) passe devant ce fichier :
pour le retrouver, il faut supprimer la personnalisation de la console.
Le bouton « afficher le mot de passe » (l'œil) est masqué avec sa case : la maquette n'en a pas. Sous le champ, « Mot de
passe oublié ? » est à droite, puis « Se souvenir de moi » à gauche sur la ligne suivante, et les liens sont soulignés
(un lien ne se distingue pas par sa seule couleur, RGAA 10.6). Keycloak place la case avant le lien dans la page : l'ordre
d'affichage est inversé par la feuille de style, l'ordre de tabulation reste celui de la page.
La page ne porte que le logo, le nom de l'enseigne sur une seule ligne et la carte de connexion : la signature et la phrase
d'accueil ont été retirées pour remonter le formulaire.

### Typographie

Roboto sert pour tout le site, y compris la page de connexion Keycloak. Les fichiers sont hébergés par le site lui-même
(`frontend/public/fonts`, mêmes fichiers que la documentation) : aucune requête vers un service tiers. Les maquettes
utilisent aussi Roboto (chargée depuis Google Fonts, car ce ne sont que des pages de présentation).


## Découpage

Une seule branche, `feat/depot-annonce-photo` : la connexion, le stockage et le formulaire se démontrent ensemble, et
un déploiement partiel n'aurait rien à montrer. Les tests unitaires (couverture de 100 %) ont été ajustés en dernier ; les
tests d'intégration existants passent sans changement.

| Domaine | Contenu |
|---|---|
| **Keycloak** | Realm en français seul, libellé « Nom d'utilisateur ou email », thème de connexion `pme` créé (le dépôt n'en avait aucun) : palette et police du site, monté dans le pod et déclaré par `loginTheme` |
| **Stockage** | Garage : manifeste, configuration, clés dans le secret chiffré, politiques d'Istio et de Calico, ingress et certificat, limite de taille du corps des requêtes, `make garage-init` |
| **API** | Migration, états et types, prix, lieu de remise, envoi multipart, contrôle et ré-encodage de la photo, URL signées, événement enrichi |
| **Modération** | Migration, contrat de l'événement, nouvelles colonnes de la file |
| **Interface** | Routeur, formulaire complet, notification, liste avec photos, en-tête et pied de page, palette et police |
| **Documentation** | Architecture (conteneur de stockage et relations), fiche Garage, commandes make, cette fiche |

!!! warning "Attention"
    Le realm Keycloak n'est importé qu'une fois. Pour appliquer le changement de langue et de libellé, il faut
    réimporter le realm ou repartir d'une base Keycloak vierge (`make reset`). Ne désactivez pas l'internationalisation :
    Keycloak repasserait en anglais.

!!! tip "Astuce"
    Pour tester le toast, ouvrez la page des annonces avec un lecteur d'écran ou l'inspecteur d'accessibilité du
    navigateur : la région `aria-live` doit contenir le message juste après la redirection.

## Hors périmètre

- Décision du modérateur, déplacement de la photo vers `published/` et publication de l'annonce.
- Back-office séparé et interface dédiée au modérateur.
- Test d'intégration du dépôt avec photo et test de charge avec photo : les scénarios actuels envoient du JSON sans photo.
- Déplacement automatique du focus vers le titre après la redirection.
- Plusieurs photos par annonce.
- Hébergeur S3 européen de production : seul le point d'accès change, pas le code.
- Antivirus sur les fichiers déposés.
