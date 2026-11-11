# Keycloak

## Fiche d'identité

| Information | Détail |
|---|---|
| **Rôle** | Gère les comptes, la connexion et les rôles : il est le seul composant à voir les mots de passe |
| **Version** | Keycloak 26.8.1 |
| **Adresse en local** | <https://keycloak.localhost> |

## Description

Keycloak est un outil open source de **gestion des identités**. Il affiche la page de connexion, vérifie l'identifiant
et le mot de passe, puis délivre un **jeton** qui prouve l'identité de la personne et énumère ses droits.

**Pourquoi un outil dédié ?**
Gérer soi-même des comptes exige de traiter correctement une longue liste de sujets : stockage des mots de passe,
politique de complexité, tentatives répétées, expiration des sessions, déconnexion, réinitialisation. Chacun est une
source classique de faille. Keycloak fournit l'ensemble, éprouvé et maintenu, et évite que ce code sensible soit
réécrit dans chaque application.

**Le principe : l'API ne voit jamais le mot de passe.**
L'interface n'affiche aucun formulaire de mot de passe : elle redirige vers Keycloak, qui renvoie l'utilisateur muni
d'un jeton. Ce jeton accompagne ensuite chaque appel à l'API. Le mot de passe ne transite donc que par Keycloak, et
aucun autre composant ne peut le voir, même en lisant ses propres journaux.

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

navigateur: "1. Navigateur\nl'utilisateur saisit\nson mot de passe" {class: boite}
keycloak: "2. Keycloak\nvérifie, puis délivre\nun jeton signé" {class: boite}
api: "3. API\nvérifie la signature\net lit les rôles" {class: boite}

navigateur -> keycloak
keycloak -> api: "jeton joint\nà chaque appel"
```

**Pourquoi la signature suffit.**
Le jeton est signé par Keycloak avec une clé que lui seul détient. L'API récupère la clé publique correspondante et
peut ainsi vérifier, seule, qu'un jeton est authentique et n'a pas été modifié. Elle n'a pas besoin d'interroger
Keycloak à chaque requête : une personne restée connectée ne crée aucun trafic supplémentaire, et une panne de
Keycloak n'interrompt pas les utilisateurs déjà connectés.

**Trois contrôles sur le jeton.**
L'API ne se contente pas de la signature. Elle vérifie aussi l'**émetteur**, c'est-à-dire que le jeton vient bien du
realm attendu, et l'**application** qui l'a demandé, afin qu'un jeton délivré pour un autre usage ne soit pas accepté.
Le jeton a ensuite une durée de vie courte, cinq minutes : l'interface le renouvelle silencieusement avant qu'il
expire.

**Les rôles décident de ce qui est permis.**
Le projet en définit deux. Le rôle `membre` autorise le dépôt d'une annonce et la consultation de ses propres
annonces. Le rôle `moderateur` donne accès à la file de relecture. Ces rôles figurent dans le jeton : l'API les lit
sans rien demander à Keycloak.

**Définitions**

| Terme | Définition |
|---|---|
| **Client** | Application autorisée à demander une connexion, ici `pme-web` pour le site. |
| **Compte administrateur temporaire** | Compte créé au tout premier démarrage pour amorcer l'installation, puis remplacé. |
| **Émetteur** | Autorité qui a délivré le jeton. L'API vérifie qu'il correspond bien au realm attendu. |
| **Jeton (JWT)** | Fichier texte signé, délivré après la connexion, qui porte l'identité et les rôles de l'utilisateur. |
| **Realm** | Espace qui regroupe les comptes, les rôles et les applications d'un même projet. Ici, le realm `pme`. |
| **Rôle** | Droit attribué à un compte, par exemple « membre » ou « modérateur ». |
| **Signature** | Empreinte chiffrée qui permet de vérifier qu'un jeton vient bien de Keycloak et n'a pas été modifié. |

## Rôle dans le projet

- Il gère la connexion des membres et des modérateurs, et il est le seul composant à manipuler les mots de passe.
- Il délivre les jetons que l'API et le service de modération vérifient à chaque appel.
- Il charge le realm `pme` à son premier démarrage : rôles, applications autorisées, adresses de retour et comptes de
  démonstration.
- Il enregistre ses données dans la base `keycloak` de [PostgreSQL](postgresql.md), par une connexion chiffrée et
  vérifiée.
- Il remplace, au déploiement, son compte administrateur temporaire par un compte permanent, puis supprime le premier.
- Il impose une politique de mots de passe : 12 caractères au moins, avec majuscule, minuscule et chiffre.
- Sans lui, personne ne peut se connecter : ni dépôt d'annonce, ni modération, ni accès aux tableaux de bord.

Le realm `pme` ne contient aucun compte d'utilisateur. Pour se connecter au site, il faut en créer un dans la console
(`make keycloak`), dans Users, puis Add user. Le mot de passe se définit dans l'onglet Credentials, sans cocher
« Temporary », et doit respecter la politique (12 caractères au moins, majuscule, minuscule et chiffre). Le rôle se
donne dans l'onglet Role mapping :

| Rôle à attribuer | Ce que l'utilisateur peut faire |
|---|---|
| **`membre`** | Déposer une annonce et consulter les siennes. |
| **`membre`** et **`moderateur`** | En plus : consulter la file de modération. |

Ces comptes sont conservés tant que la base de Keycloak n'est pas réinitialisée.

!!! warning "Attention"
    Keycloak fonctionne ici en mode développement, qui simplifie la configuration locale. Une mise en production
    imposerait le mode `start`, une base dimensionnée et une double authentification sur le compte administrateur.

## Fichiers et dossiers principaux

| Fichier ou dossier | Description |
|---|---|
| **`../../k8s/03-keycloak.yaml`** | Déploie Keycloak dans le cluster et fixe son adresse publique. |
| **`../../k8s/03-keycloak-admin-job.yaml`** | Crée le compte administrateur permanent, puis supprime le compte temporaire. |
| **`../../k8s/config/realm-pme.json`** | Décrit le realm : rôles et applications autorisées. |
| **`../../libs/common/src/auth`**<br>**`jwt.strategy.ts`** | Vérifie la signature, l'émetteur et l'application du jeton, dans l'API comme dans la modération. |
| **`../../frontend/src/auth.ts`** | Redirige vers la page de connexion et renouvelle le jeton. |
| **`../../.env`** | Contient l'identifiant et le mot de passe de l'administrateur. Ce fichier est exclu de Git. |

## Commandes essentielles

À lancer dans un terminal, depuis le dossier du projet, le cluster démarré.

| Commande | Description |
|---|---|
| **`make deploy`** | Installe Keycloak avec le reste de la plateforme. |
| **`make keycloak`** | Ouvre Keycloak dans le navigateur. |
| **`make logs-keycloak`** | Affiche le journal de Keycloak, mis à jour en direct. |
| **`make pods`** | Indique si Keycloak est prêt. |

!!! note "À savoir"
    Keycloak met environ quarante secondes à démarrer, car il prépare sa configuration à chaque lancement. Attendre
    que `make pods` l'affiche comme prêt avant d'ouvrir la page, sinon le navigateur signale une erreur.

!!! warning "Attention"
    Le realm n'est importé que s'il n'existe pas encore. Pour appliquer une modification de `realm-pme.json`, il faut
    recréer la base `keycloak`, ce qui supprime les comptes créés depuis.

!!! tip "Astuce"
    Pour ouvrir la console d'administration, utiliser les valeurs `KEYCLOAK_ADMIN` et `KEYCLOAK_ADMIN_PASSWORD` du
    fichier `../../.env`. Le compte temporaire n'existe plus une fois le déploiement terminé.

## Pour aller plus loin

- [Site officiel de Keycloak](https://www.keycloak.org/)
- [Documentation de Keycloak](https://www.keycloak.org/documentation)
- [Présentation du format JWT](https://jwt.io/introduction)
