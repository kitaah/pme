# Garage

## Fiche d'identité

| Information | Détail |
|---|---|
| **Rôle** | Stocke les photos des annonces, en dehors de la base de données |
| **Version** | Garage 1.1, image `dxflrs/garage` |
| **Interface** | S3, celle d'Amazon : le même code fonctionne devant Garage en local et devant un hébergeur européen en production |
| **Dépôt** | `pme-photos`, préfixe `pending/` pour les annonces en attente de modération |
| **Licence** | AGPLv3, projet français (Deuxfleurs) |
| **Adresse en local** | <https://garage.localhost>, par l'ingress, en lecture seule et par URL signée |

## Description

Garage est un **stockage objet** : un service qui range des fichiers et les rend par leur chemin, comme un disque
accessible par le réseau. Il parle le protocole **S3**, celui du service du même nom chez Amazon, devenu la norme de
fait : les bibliothèques S3 fonctionnent sans modification devant lui.

**Pourquoi ne pas mettre les photos dans PostgreSQL ?**
Une base relationnelle sait stocker des données binaires, mais elle le fait mal. Une photo de trois méga-octets dans
une colonne, multipliée par le nombre d'annonces, produit trois effets : chaque sauvegarde de la base devient longue
et lourde, le cache de PostgreSQL se remplit d'images au détriment des lignes réellement interrogées, et la moindre
lecture d'annonce transporte l'image même quand personne ne la regarde. Le stockage objet est fait pour cela : il
rend un fichier, rien d'autre, et le sert directement au navigateur.

Ce choix n'est pas une invention de cette fonctionnalité : le niveau 2 du C4 prévoyait déjà un conteneur
« Stockage de fichiers » distinct des bases. Garage l'incarne sur le poste de développement.

**Pourquoi Garage plutôt que MinIO ?**
MinIO était le stockage S3 habituel des clusters de développement. Son édition communautaire est passée en mode
maintenance fin 2025, sans nouvelle image officielle : la dépendance n'était plus tenable. Garage vise exactement
l'usage du POC : un seul processus, aucune base externe, quelques dizaines de méga-octets de mémoire.

## Ce que fait l'API

L'API est le seul composant à écrire dans le stockage. Le service de modération n'y a aucun accès : les politiques
d'[Istio](istio.md) et de [Calico](calico.md) le lui refusent, conformément au C4.

| Étape | Détail |
|---|---|
| **Contrôle du fichier** | Le fichier est ré-encodé en WebP par la bibliothèque `sharp`. Un fichier que la bibliothèque ne sait pas décoder est refusé (415) : le nom et le type annoncés par le navigateur ne sont pas des preuves |
| **Retrait des métadonnées** | Le ré-encodage supprime les données EXIF, dont la position GPS de la prise de vue |
| **Réduction** | L'image est ramenée à 1600 px sur son plus grand côté : une photo de téléphone passe de plusieurs méga-octets à quelques centaines de kilo-octets |
| **Enregistrement** | Sous `pending/<identifiant>.webp`. La base ne garde que ce chemin et le type |
| **Lecture** | L'API calcule une **URL signée** valable cinq minutes, que le navigateur utilise directement. La signature couvre le nom d'hôte : elle est donc calculée pour l'adresse publique, et non pour le service interne |
| **Suppression** | Si la publication de l'événement échoue, l'annonce est retirée de la base et la photo du stockage : aucun fichier orphelin |

**Pourquoi une URL signée ?**
La photo d'une annonce qui n'a pas encore été relue ne doit pas être visible de tous. Un dépôt public la rendrait
accessible à qui connaîtrait son adresse. Une URL signée porte sa propre autorisation : elle est calculée avec la clé
d'accès, vaut pour un objet précis et expire d'elle-même. C'est ce qui permet au navigateur de lire le stockage
directement, sans que l'API serve chaque image, et sans qu'un jeton Keycloak circule dans une balise `<img>`.

## Mise en service

Garage démarre sans savoir où ranger ses données : il faut lui décrire sa **disposition** (*layout*), puis créer le
dépôt et la clé d'accès. Une seule commande s'en charge, après le premier déploiement :

```bash
make garage-init
```

Elle est sans effet si tout est déjà en place. La clé d'accès n'est pas générée par Garage : elle est **importée**
depuis `.env`, où l'API lit la même valeur. Les deux côtés partagent donc le secret sans qu'on ait à recopier une
valeur affichée par un outil. Après un `make reset`, le volume repart vide : la commande est à relancer.

## Limites assumées

| Limite | Raison |
|---|---|
| **Un seul exemplaire** | Aucune copie de secours des objets : le POC démontre un parcours, pas la haute disponibilité. Un hébergeur de production répliquerait sur trois nœuds |
| **Une seule photo par annonce** | Plusieurs photos demanderaient une table supplémentaire sans rien démontrer de plus |
| **Pas d'antivirus** | Le ré-encodage écarte tout ce qui n'est pas une image, ce qui suffit à ce périmètre. Une plateforme ouverte au public analyserait les fichiers déposés |
| **Préfixe `pending/` seulement** | La décision du modérateur, qui déplacerait l'objet vers `published/`, est hors périmètre du POC |

## Pour aller plus loin

- Site du projet : <https://garagehq.deuxfleurs.fr/>
- Documentation S3 compatible : <https://garagehq.deuxfleurs.fr/documentation/connect/>
