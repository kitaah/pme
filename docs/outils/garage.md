# Garage

## Fiche d'identité

| Information | Détail |
|---|---|
| **Rôle** | Stocke les photos des annonces, en dehors de la base de données |
| **Version** | Garage 1.1, image `dxflrs/garage` |
| **Interface** | S3, celle d'Amazon : le même code fonctionne devant Garage en local et devant un hébergeur européen en production |
| **Bucket** | `pme-photos`, préfixe `pending/` pour les annonces en attente de validation |
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

**Pourquoi une URL signée ?**
La photo d'une annonce qui n'a pas encore été relue ne doit pas être visible de tous. Un bucket public la rendrait
accessible à qui connaîtrait son adresse. Une URL signée porte sa propre autorisation : elle est calculée avec la clé
d'accès, vaut pour un objet précis et expire d'elle-même. C'est ce qui permet au navigateur de lire le stockage
directement, sans que l'API serve chaque image, et sans qu'un jeton Keycloak circule dans une balise `<img>`.

**Définitions**

| Terme | Définition |
|---|---|
| **Bucket** | Conteneur de premier niveau d'un stockage objet, comparable à un dossier racine. Celui du projet s'appelle `pme-photos`. |
| **Disposition (*layout*)** | Description, donnée à Garage, de l'endroit où ranger les données. Sans elle, Garage ne stocke rien. |
| **EXIF** | Métadonnées ajoutées par l'appareil photo à une image : modèle, date et, souvent, position GPS. |
| **Objet** | Un fichier rangé dans un stockage objet, retrouvé par son chemin (sa clé). |
| **S3** | Protocole de stockage objet d'Amazon, devenu la norme : les bibliothèques S3 fonctionnent devant Garage sans modification. |
| **URL signée** | Adresse qui porte sa propre autorisation : calculée avec la clé d'accès, elle vaut pour un objet précis et expire d'elle-même. |

## Rôle dans le projet

- Il garde les photos des annonces en dehors de PostgreSQL, comme le prévoit le conteneur « Stockage de fichiers » du C4 niveau 2.
- Il tient, sur l'ordinateur, le rôle que jouera un hébergeur S3 européen en production : seul le point d'accès change, pas le code.
- Seule l'API y écrit (relation 25 du C4). Le service de modération n'y a aucun accès : les politiques d'[Istio](istio.md) et de [Calico](calico.md) le lui refusent.
- Sans lui, une annonce ne pourrait plus porter de photo, ou la photo retournerait dans la base.

Voici ce que fait l'API avec chaque photo :

| Étape | Détail |
|---|---|
| **Contrôle du fichier** | Le fichier est ré-encodé en WebP par la bibliothèque `sharp`. Un fichier que la bibliothèque ne sait pas décoder est refusé (415) : le nom et le type annoncés par le navigateur ne sont pas des preuves |
| **Retrait des métadonnées** | Le ré-encodage supprime les données EXIF, dont la position GPS de la prise de vue |
| **Réduction** | L'image est ramenée à 1600 px sur son plus grand côté : une photo de téléphone passe de plusieurs méga-octets à quelques centaines de kilo-octets |
| **Enregistrement** | Sous `pending/<identifiant>.webp`. La base ne garde que ce chemin et le type |
| **Lecture** | L'API calcule une **URL signée** valable cinq minutes, que le navigateur utilise directement. La signature couvre le nom d'hôte : elle est donc calculée pour l'adresse publique, et non pour le service interne |
| **Suppression** | Si la publication de l'événement échoue, l'annonce est retirée de la base et la photo du stockage : aucun fichier orphelin |

!!! note "À savoir"
    Le POC présente des limites assumées : un seul exemplaire de Garage, donc aucune copie de secours des objets (un
    hébergeur de production répliquerait sur trois nœuds) ; une seule photo par annonce ; pas d'antivirus, le
    ré-encodage écartant déjà tout ce qui n'est pas une image ; et un préfixe `pending/` seulement, la décision du
    modérateur, qui déplacerait l'objet vers `published/`, étant hors périmètre.

## Fichiers et dossiers principaux

| Fichier ou dossier | Description |
|---|---|
| **`k8s/03-garage.yaml`** | Déploie Garage : volume persistant, pod en un seul exemplaire et service. L'image est épinglée par empreinte. |
| **`k8s/config/garage.toml`** | Configure Garage : adresses d'écoute, région S3 et port d'administration, fermé à tout accès extérieur. |
| **`k8s/08-ingress.yaml`** | Expose `garage.localhost` pour la lecture des photos par URL signée, dans un Ingress à part, avec sa propre limite de débit (600 requêtes par minute). |
| **`k8s/17-authorization-policies.yaml`**<br>**`k8s/18-network-policies.yaml`** | Réservent l'accès à l'API (écriture) et à l'ingress (lecture). |
| **`api/src/storage/`**<br>**`photo-storage.service.ts`** | Contrôle, ré-encode, enregistre, supprime et signe les photos. |
| **`.env`**<br>**`env.example`** | Portent les quatre secrets de Garage, générés par `make garage-secrets`. |

## Commandes essentielles

À lancer dans un terminal, depuis le dossier du projet.

| Commande | Description |
|---|---|
| **`make garage-init`** | Met Garage en service : disposition, bucket `pme-photos` et clé d'accès de l'API. Lancée par `make deploy`, sans effet si tout est déjà en place. |
| **`make garage-secrets`** | Génère dans `.env` les secrets de Garage qui manquent ou valent `CHANGE_ME`. Lancée par `make seal`. |
| **`kubectl -n pme exec deploy/garage -- /garage status`** | Affiche l'état du nœud et sa disposition. |
| **`kubectl -n pme exec deploy/garage -- /garage bucket info pme-photos`** | Affiche le bucket, sa taille et le nombre d'objets. |

Garage démarre sans savoir où ranger ses données : `make garage-init` lui décrit la disposition, crée le bucket, puis
**importe** la clé d'accès depuis `.env`, où l'API lit la même valeur. Les deux côtés partagent donc le secret sans qu'on
ait à recopier une valeur affichée par un outil.

Après un `minikube delete`, l'enchaînement est le suivant :

1. `make minikube-up` recrée le cluster.
2. `make seal` chiffre `.env` pour le nouveau cluster, en réutilisant les secrets de Garage déjà présents.
3. `make image` reconstruit les images.
4. `make deploy` déploie tout et remet Garage en service sur son volume vide.

!!! warning "Attention"
    Ne modifiez pas à la main une valeur `GARAGE_*` de `.env` une fois Garage en service : `make garage-secrets` ne la
    touche jamais, car la changer désynchroniserait `.env`, le fichier chiffré et la clé déjà importée. `make undeploy`
    et `make reset` suppriment le volume : les photos disparaissent avec lui.

!!! tip "Astuce"
    Pour vérifier qu'une photo est bien rangée, lancez `kubectl -n pme exec deploy/garage -- /garage bucket info pme-photos` :
    le nombre d'objets augmente d'un à chaque annonce déposée avec photo, et revient en arrière si la publication échoue.

## Pour aller plus loin

- Site du projet : <https://garagehq.deuxfleurs.fr/>
- Documentation S3 compatible : <https://garagehq.deuxfleurs.fr/documentation/connect/>
