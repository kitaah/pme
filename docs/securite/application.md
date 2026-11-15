# Défenses applicatives

## Fiche d'identité

| Information | Détail |
|---|---|
| **Rôle** | Protège l'API et l'interface contre les entrées hostiles, les abus et les fuites d'information |
| **Validation** | Stricte : tout champ inattendu fait échouer la requête |
| **Limitation de débit** | 200 requêtes par minute et par adresse, à Traefik puis par exemplaire de l'API ; 600 par minute pour la lecture des photos |
| **En-têtes de sécurité** | Posés par Helmet sur l'API, par nginx sur l'interface |
| **Format des erreurs** | Problem Details, norme RFC 9457 |

## Description

Les couches précédentes protègent l'accès et l'hébergement. Celle-ci protège ce que l'application fait de ce qu'on lui
envoie. C'est le terrain des risques applicatifs les plus courants : injection, exposition de données, abus de service.

**Le problème : toute donnée venue du dehors est suspecte.**
Une requête n'arrive pas forcément d'un navigateur bien élevé. Elle peut contenir un champ qui n'existe pas, un texte
démesuré, un fragment de code destiné à la base de données. Une application qui fait confiance à ce qu'elle reçoit finit
par exécuter ce qu'on lui a glissé.

**Le principe : refuser par défaut, et borner.**
Le projet applique partout la même logique. Les champs autorisés sont déclarés, et tous les autres sont refusés, au lieu
de chercher à repérer ceux qui seraient dangereux. Les tailles sont bornées, les valeurs possibles énumérées, le nombre
de résultats plafonné. On ne tente pas de deviner ce qui est hostile : on décrit ce qui est acceptable.

**Deuxième principe : ne rien révéler en échouant.**
Un message d'erreur trop bavard renseigne un attaquant : version du serveur, nom d'une table, trace d'exécution. Toutes
les erreurs du projet passent donc par un même filtre, qui produit une réponse uniforme. Les détails techniques
restent dans les logs du service, où ils sont utiles, et n'en sortent jamais.

```d2
vars: {
  d2-config: {
    layout-engine: elk
    theme-id: 5
    pad: 8
  }
}

# Mise en forme commune : texte lisible à la largeur de la page, angles arrondis
classes: {
  boite: {
    style: {
      font-size: 24
      border-radius: 12
    }
  }
}

filtres: "" {
  grid-rows: 5
  grid-gap: 8
  style.opacity: 0

  un: "1. Limitation de débit — 200 requêtes par minute" {class: boite}
  deux: "2. Jeton valide, déjà vérifié par Traefik — sinon 401" {class: boite}
  trois: "3. Rôle attendu — sinon 403" {class: boite}
  quatre: "4. Validation stricte des champs — sinon 400" {class: boite}
  cinq: "5. Traitement, puis réponse" {class: boite}
}
```

**Définitions**

| Terme | Définition |
|---|---|
| **Content-Security-Policy (CSP)** | En-tête qui liste les sources de contenu que le navigateur a le droit de charger et de contacter. |
| **CORS** | Mécanisme du navigateur qui décide si une page d'un site peut appeler un autre site. |
| **Cross-Origin-Opener-Policy** | En-tête qui isole une page des fenêtres ouvertes par d'autres sites, pour qu'elles ne puissent pas la manipuler. |
| **Injection SQL** | Attaque qui glisse des instructions dans une valeur, pour les faire exécuter par la base. |
| **Injection de script (XSS)** | Attaque qui fait exécuter un script étranger dans la page d'un autre site. |
| **Limitation de débit** | Plafond du nombre de requêtes acceptées sur une période donnée. |
| **Permissions-Policy** | En-tête qui liste les fonctions du navigateur (caméra, micro, géolocalisation) auxquelles la page n'a pas droit. |
| **Problem Details** | Format normalisé de réponse d'erreur d'une API, décrit par la RFC 9457. |
| **Requête paramétrée** | Requête où les valeurs sont transmises à part de l'instruction : elles ne peuvent donc pas en modifier le sens. |

## Ce qui est en place

**Validation des entrées**

| Mesure | Détail |
|---|---|
| **Liste blanche des champs** | Les champs non déclarés sont retirés, et leur présence fait échouer la requête avec une erreur 400. |
| **Tailles bornées** | Titre de 3 à 100 caractères, description de 1000 au plus. Les mêmes bornes sont posées sur les colonnes de la base. |
| **Valeurs énumérées** | L'état d'un objet ne peut valoir que `NEW`, `VERY_GOOD`, `GOOD` ou `FAIR`, sa catégorie que l'une des huit valeurs de la liste (`FIGURINES`, `FILMS`, `BOOKS`, `POSTERS`, `MUSIC`, `GAMES`, `CLOTHING`, `OTHER`), le type d'annonce que `EXCHANGE`, `GIFT` ou `SALE`, et le lieu de remise que l'un des quatre magasins ou « à convenir ». |
| **Prix cohérent** | Un prix n'est accepté que pour une vente (de 1 à 999 999 centimes) et il y est obligatoire. Une contrainte de la base refuse aussi un prix sur un échange ou un don. |
| **Nombre de résultats plafonné** | Le paramètre de pagination est ramené entre 1 et 100, et une valeur non entière est refusée. |
| **Messages explicites** | Chaque règle a son message en français, ce qui évite à l'interface de les réécrire. |

Cinq cas de refus sont vérifiés par les [tests d'intégration](../pipeline/tests-integration.md) : titre vide, titre trop
court, description trop longue, état inconnu, champ inattendu.

**Photos déposées**
Un fichier envoyé par un navigateur n'est jamais cru sur parole : son nom et son type annoncés ne prouvent rien.

| Mesure | Détail |
|---|---|
| **Taille bornée deux fois** | Traefik coupe à 6 Mo de corps de requête avant même l'API, puis l'API refuse (413) un fichier de plus de 5 Mo. Une seule photo par annonce. |
| **Ré-encodage obligatoire** | L'API décode puis ré-encode l'image en WebP avec la bibliothèque `sharp`. Un fichier qui n'est pas une image exploitable est refusé (415), et ce qui n'est pas de l'image (script, document) ne survit pas au ré-encodage. |
| **Image bornée** | La taille de l'image décodée est plafonnée et l'image est ramenée à 1600 px au plus : une image piégée, minuscule en fichier mais immense décodée, ne peut pas saturer la mémoire. |
| **Métadonnées retirées** | Le ré-encodage supprime les données EXIF, dont la position GPS de la prise de vue. |
| **Lecture contrôlée** | Une photo ne se lit que par une adresse signée valable cinq minutes : celle d'une annonce non modérée n'est jamais publique. |

**Protection contre les injections**
L'accès aux données passe par TypeORM, qui construit des requêtes paramétrées : une valeur envoyée par un membre ne peut
pas modifier le sens d'une instruction SQL. Le schéma de la base, lui, n'est jamais déduit du code : il est créé par des
migrations explicites, et la génération automatique est désactivée.

**Limitation de débit**
L'API accepte 200 requêtes par minute et par adresse. Au-delà, elle répond 429. Les sondes de santé et les mesures en
sont exemptées, pour qu'une montée en charge ne fasse pas croire à une panne. L'adresse retenue est celle du client
réel, lue dans l'en-tête que pose l'ingress : l'API est configurée pour ne faire confiance qu'à **un seul** relais, car
en faire confiance à davantage permettrait à un client de falsifier son adresse et de contourner le plafond.

La lecture des photos a sa propre limite, à Traefik : 600 requêtes par minute et par adresse, rafale de 100. Une photo
se lit par une adresse signée valable cinq minutes, qui pourrait être rappelée en boucle pendant ce temps ; le plafond
protège Garage de cette répétition, tout en laissant une page de plusieurs dizaines d'annonces se charger d'un coup.

**En-têtes de sécurité**

| Où | En-têtes |
|---|---|
| **API** | Posés par Helmet 8 : une dizaine d'en-têtes, dont le refus de la détection automatique du type de contenu et la limitation de l'affichage dans un cadre. |
| **Interface** | Posés par nginx : `nosniff`, refus de l'affichage dans un cadre, transmission du référent limitée au site lui-même, politique de contenu (`Content-Security-Policy`), retrait des fonctions du navigateur inutiles (`Permissions-Policy`) et isolation de la page des autres fenêtres (`Cross-Origin-Opener-Policy`). |

nginx ne signale plus sa version dans ses réponses (`server_tokens off`), ce qui évite d'indiquer à un attaquant quelles
failles connues viser.

**Politique de contenu de l'interface**
Le navigateur ne charge et n'exécute que ce que cette politique autorise. Un script injecté dans une page, venu d'un
autre site ou glissé dans un champ de saisie, est donc refusé, même si la page l'affiche.

| Directive | Effet |
|---|---|
| **`default-src 'self'`** | Par défaut, seules les ressources du site lui-même sont acceptées. |
| **`script-src 'self'`** | Seuls les scripts du site sont exécutés. Aucun script écrit dans la page, aucune évaluation de texte en code. |
| **`style-src 'self'`** | Seule la feuille de style du site est appliquée. Aucun style écrit dans la page : les styles de la bibliothèque de notifications sont donc importés depuis sa feuille CSS, au lieu d'être injectés par elle. |
| **`img-src 'self' data: blob:`**<br>**`https://garage.localhost`** | Les images viennent du site, sont intégrées directement dans le fichier, sont les photos du stockage lues par adresse signée, ou sont l'aperçu de la photo choisie (`blob:`, lue depuis le fichier local, rien n'est envoyé avant le dépôt). |
| **`font-src 'self'`** | La police Roboto est servie par le site lui-même : aucune requête vers un service de polices tiers. |
| **`connect-src 'self'`**<br>**`https://keycloak.localhost`** | Les appels réseau du navigateur ne peuvent viser que l'API et Keycloak. |
| **`object-src 'none'`** | Aucun module externe (plugin) n'est accepté. |
| **`base-uri 'self'`** | L'adresse de base des liens de la page ne peut pas être modifiée. |
| **`form-action 'self'`** | Un formulaire ne peut être envoyé qu'au site lui-même. |
| **`frame-ancestors 'none'`** | Aucun autre site ne peut afficher l'interface dans un cadre. |

**Surface d'exposition réduite**

- L'ingress n'expose que le préfixe `/api/v1`. Les sondes de santé et les mesures restent internes : Prometheus et
  Kubernetes les lisent directement sur les services.
- Le serveur de l'interface répond 404 à toute adresse commençant par `/api/`, pour qu'une erreur d'acheminement ne
  renvoie jamais la page du site à la place d'une réponse d'API.
- L'interface et l'API partagent une seule origine : le navigateur n'a donc aucune requête inter-origines à autoriser,
  et il n'y a pas de CORS à configurer, donc pas de risque de le configurer trop largement.

**Données personnelles réduites au minimum**
La base ne conserve, pour chaque annonce, que l'identifiant Keycloak de son propriétaire et son nom d'affichage. Aucune
adresse électronique, aucun mot de passe, aucune trace de connexion. Le lieu de remise est une liste fermée de magasins,
et la position GPS des photos est effacée : aucune adresse personnelle n'est collectée. Une demande de suppression de compte se traite donc
dans Keycloak, sans toucher aux données métier.

!!! note "À savoir"
    Le filtre d'erreurs distingue clairement les situations : 400 pour une saisie invalide, 401 pour un jeton absent ou
    invalide, 403 pour un rôle insuffisant, 413 pour une photo trop lourde, 415 pour un fichier qui n'est pas une image,
    429 pour un débit excessif, 503 quand la base ou le stockage des photos ne répond plus. Cette
    distinction aide l'interface à réagir correctement, sans rien révéler du fonctionnement interne.

## Ce qui n'est pas couvert

- **Adresse de Keycloak écrite dans la politique de contenu.** Changer l'hôte de Keycloak impose de modifier
  `frontend/nginx.conf` en même temps que la configuration de l'interface et le realm.
- **Le compteur de débit est propre à chaque exemplaire.** Avec quatre exemplaires de l'API, la limite réelle est
  quadruplée, et elle dépend du nombre d'exemplaires du moment. Un compteur partagé, dans Redis par exemple, la rendrait
  exacte.
- **Aucun log des accès.** Les logs applicatifs enregistrent les erreurs, pas les accès réussis : on ne
  peut pas reconstituer qui a consulté quoi. Une vraie piste d'audit, horodatée et inaltérable, serait nécessaire dès
  lors que des données personnelles sont en jeu.
- **Pas d'antivirus sur les photos.** Le ré-encodage écarte tout ce qui n'est pas une image, ce qui suffit à ce périmètre ; une
  plateforme ouverte au public analyserait aussi les fichiers déposés.
- **Pas de détection d'abus.** Un débit sous le plafond, mais anormal dans sa forme, n'est repéré par personne.
- **Pas d'audit d'accessibilité complet.** Les tests contrôlent les contrastes de la palette ; le reste du référentiel
  RGAA relève d'un audit manuel.

## Commandes de vérification

À lancer dans un terminal, depuis le dossier du projet, la plateforme déployée.

| Commande | Description |
|---|---|
| **`make test-integration`** | Rejoue les cas de validation et d'autorisation avec une vraie base. |
| **`curl -k -I https://pme.localhost/`** | Affiche les en-têtes de sécurité posés par nginx, dont `content-security-policy`. |

!!! warning "Attention"
    La limitation de débit compte par exemplaire, et l'autoscaler fait varier ce nombre entre deux et quatre selon la
    charge. La limite réellement opposée à un appelant n'est donc jamais celle qui est écrite dans la configuration :
    elle vaut cette valeur multipliée par le nombre de pods du moment. Ne pas s'en servir comme d'une protection
    chiffrée — c'est un garde-fou contre l'emballement, pas une limite contractuelle.

!!! tip "Astuce"
    Pour vérifier la validation sans écrire de test, envoyer un dépôt avec un champ inventé. La réponse doit être un
    400 au format Problem Details, dont le champ `errors` nomme précisément le champ refusé.

## Fichiers principaux

| Fichier ou dossier | Description |
|---|---|
| **`api/src/main.ts`** | Active Helmet, la validation stricte et la confiance limitée à un seul relais. |
| **`api/src/app.module.ts`** | Déclare la limitation de débit, puis les gardes, dans leur ordre d'exécution. |
| **`api/src/listings/create-listing.dto.ts`** | Les règles de validation du dépôt d'annonce. |
| **`libs/common/src/common/`**<br>**`problem-details.filter.ts`** | Traduit toutes les erreurs au format RFC 9457, dans l'API comme dans la modération. |
| **`api/src/listings/listings.controller.ts`** | Borne le nombre de résultats et exige le rôle `membre`. |
| **`frontend/nginx.conf`** | En-têtes de sécurité, dont la politique de contenu, et refus des adresses `/api/`. |

## Pour aller plus loin

- [Les dix risques applicatifs de l'OWASP](https://owasp.org/www-project-top-ten/)
- [La norme RFC 9457 sur les réponses d'erreur](https://www.rfc-editor.org/rfc/rfc9457.html)
- [Documentation de Helmet](https://helmetjs.github.io/)
- [La politique de contenu (CSP) sur MDN](https://developer.mozilla.org/fr/docs/Web/HTTP/Guides/CSP)
- [Fiche NestJS du projet](../outils/nestjs.md)
