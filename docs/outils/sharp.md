# sharp

## Fiche d'identité

| Information | Détail |
|---|---|
| **Rôle** | Décode, réduit et ré-encode chaque photo déposée, ce qui valide le fichier et retire ses métadonnées |
| **Version** | sharp 0.35, bibliothèque Node.js |
| **Format produit** | WebP, qualité 82, 1600 pixels au plus sur le grand côté |
| **Adresse en local** | Aucune |

## Description

sharp est une bibliothèque open source qui **traite des images** : elle les lit, les redimensionne et les enregistre
dans un autre format. Elle s'appuie sur libvips, un moteur écrit en C, réputé rapide et économe en mémoire.

**Le problème qu'elle résout : ne pas faire confiance à un fichier envoyé par un navigateur.**
Un membre dépose une « photo ». Le nom du fichier (`photo.png`) et le type annoncé par le navigateur ne prouvent rien : ils
sont écrits par celui qui envoie. Un fichier piégé peut se faire passer pour une image, contenir un script, ou être une image
minuscule en taille de fichier mais gigantesque une fois décodée, au point de saturer la mémoire du serveur. Une photo de
téléphone, de son côté, embarque des métadonnées (modèle d'appareil, date, **position GPS**) que le membre n'a pas choisi de
publier.

**Comment elle fonctionne.**
L'API ne conserve jamais le fichier reçu. Elle le décode avec sharp, puis fabrique une **nouvelle image** :

1. Le décodage est le contrôle : un fichier que sharp ne sait pas lire est refusé (415).
2. Une image de plus de 50 millions de pixels est refusée avant d'être décodée.
3. L'orientation inscrite dans les métadonnées est appliquée, puis les métadonnées sont abandonnées : une photo prise en
   portrait reste droite, et sa position GPS disparaît.
4. L'image est ramenée à 1600 pixels au plus sur son grand côté, sans jamais être agrandie.
5. Elle est enregistrée en WebP, un format léger : une photo de plusieurs méga-octets tombe à quelques centaines de
   kilo-octets.

Ce qui est stocké est donc toujours une image que le projet a produite lui-même, jamais un octet du fichier d'origine.

**Définitions**

| Terme | Définition |
|---|---|
| **EXIF** | Métadonnées ajoutées par l'appareil photo à une image : modèle, date et, souvent, position GPS. |
| **Ré-encodage** | Lecture d'une image puis écriture d'une nouvelle image : seul le contenu visible est conservé. |
| **WebP** | Format d'image compressé, plus léger que JPEG et PNG à qualité visuelle comparable. |

## Rôle dans le projet

- Il contrôle chaque photo déposée avec une annonce, avant son enregistrement dans [Garage](garage.md).
- Il retire la position GPS et les autres métadonnées : aucune donnée personnelle ne part dans le stockage.
- Il réduit le poids des images, donc le temps d'affichage de « Mes annonces ».
- Il évite d'avoir à gérer plusieurs formats : tout est servi en WebP, sous une seule extension.
- Sans lui, le projet devrait croire le type annoncé par le navigateur, ou écrire lui-même un contrôle d'image.

!!! note "À savoir"
    Le ré-encodage n'est pas un antivirus : il écarte tout ce qui n'est pas une image, ce qui suffit au périmètre du POC, mais
    il n'analyse pas le contenu d'une image valide. Une plateforme ouverte au public ajouterait une analyse des fichiers
    déposés.

## Fichiers et dossiers principaux

| Fichier ou dossier | Description |
|---|---|
| **`api/src/storage/`**<br>**`photo-storage.service.ts`** | Ré-encode la photo avec sharp, puis l'enregistre, la supprime ou signe son adresse de lecture. |
| **`api/src/storage/`**<br>**`photo-storage.service.spec.ts`** | Vérifie le ré-encodage, la réduction, le refus d'un fichier non décodable (415) et les pannes du stockage. |
| **`api/package.json`** | Déclare la dépendance `sharp`. |
| **`api/Dockerfile`** | Installe les dépendances de l'API, sharp comprise, dans son image. |

## Commandes essentielles

À lancer dans un terminal, depuis le dossier du projet.

| Commande | Description |
|---|---|
| **`cd api && npm test -- photo-storage`** | Lance les tests du stockage des photos, dont le ré-encodage. |
| **`make coverage`** | Vérifie que le ré-encodage est couvert à 100 %. |
| **`make audit`** | Recherche les failles connues des dépendances, sharp comprise. |

!!! warning "Attention"
    Une bibliothèque qui décode des fichiers venus de l'extérieur est une cible : une faille de décodage se déclenche avec
    une image fabriquée. Gardez sharp à jour, et ne retirez ni le plafond de 50 millions de pixels ni la limite de 5 Mo.

!!! tip "Astuce"
    Pour voir l'effet du ré-encodage, déposez une photo de téléphone, puis comparez sa taille d'origine à celle de l'objet
    dans le stockage : `kubectl -n pme exec deploy/garage -- /garage bucket info pme-photos` affiche la taille du bucket.

## Pour aller plus loin

- [Site de sharp](https://sharp.pixelplumbing.com/)
- [Documentation de libvips](https://www.libvips.org/)
- [Garage, le stockage des photos](garage.md)
