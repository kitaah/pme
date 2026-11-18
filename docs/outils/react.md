# React

## Fiche d'identité

| Information | Détail |
|---|---|
| **Rôle** | Construit l'interface web que les utilisateurs voient et utilisent dans leur navigateur |
| **Version** | React 19.3.1, avec Tailwind CSS 4 pour l'apparence |
| **Langage** | TypeScript |
| **Adresse en local** | <https://pme.localhost> et <http://localhost:5173> en mode développement |

## Description

React est une **bibliothèque** open source qui sert à construire des interfaces web. Elle est née chez Facebook et
figure aujourd'hui parmi les outils les plus utilisés du métier.

**Le principe : découper l'écran en composants.**
Plutôt que d'écrire une grande page unique, on découpe l'interface en morceaux autonomes appelés **composants** : un
bandeau, un formulaire, une liste d'annonces. Chaque composant réunit son affichage et son comportement dans un seul
fichier, et peut être réutilisé ailleurs. Cette découpe facilite la relecture, les tests et les évolutions : modifier
le formulaire n'oblige pas à relire le reste de la page.

**Ce que React apporte : l'affichage suit les données.**
Un composant décrit l'apparence attendue pour un état donné des données, et non les manipulations à faire pour y
parvenir. Lorsqu'une donnée change, React recalcule l'affichage concerné et ne met à jour, dans la page, que ce qui a
réellement changé. Le développeur n'a donc pas à chercher quel texte remplacer ni quelle ligne ajouter : il décrit le
résultat, React s'occupe du reste. C'est le même principe **déclaratif** que celui des manifestes de
[Minikube](minikube.md).

**Une application monopage.**
Le navigateur télécharge l'interface une seule fois, puis la fait vivre sans recharger la page : lorsqu'une annonce est
déposée, seule la liste se met à jour. Les données, elles, proviennent toujours de l'API : l'interface ne lit jamais la
base de données directement.

Le schéma suivant montre la découpe de la page et le chemin suivi par les données.

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

app: "App\nassemble la page" {class: boite}
header: "Header\nbandeau et déconnexion" {class: boite}
formulaire: "ListingForm\nformulaire de dépôt" {class: boite}
liste: "MyListings\nannonces du membre" {class: boite}
appels: "api.ts\nprépare les appels\net joint le jeton" {class: boite}
api: "API\n/api/v1/listings" {class: boite}

app -> header
app -> formulaire
app -> liste
formulaire -> appels
liste -> appels
appels -> api
```

**La connexion est déléguée à Keycloak.**
L'interface ne contient aucun formulaire de mot de passe. Au premier affichage, elle redirige l'utilisateur vers la
page de connexion de [Keycloak](keycloak.md), qui le renvoie ensuite muni d'un **jeton**. Ce jeton accompagne chaque
appel à l'API, et il est renouvelé automatiquement lorsqu'il approche de son expiration. Ni mot de passe ni donnée
sensible ne transite donc par le code de l'interface.

**L'apparence : Tailwind CSS.**
Les couleurs, les espacements et les tailles sont déclarés une seule fois sous forme de **jetons de design**, puis
appliqués par de petites classes posées directement dans le code du composant. Le résultat est homogène : une couleur
ne peut pas varier d'un écran à l'autre, puisqu'il n'en existe qu'une seule définition.

**L'accessibilité est vérifiée automatiquement.**
Un texte trop peu contrasté devient illisible pour une partie des utilisateurs. Un test parcourt donc la palette du
projet et mesure le contraste de chaque association de couleurs réellement utilisée. Si une couleur est modifiée et
passe sous le seuil exigé par le RGAA, les tests échouent et la pipeline devient rouge.

**En production, nginx sert l'interface.**
Une fois construite, l'interface n'est plus qu'un ensemble de fichiers fixes : du HTML, du JavaScript, des styles. Ces
fichiers sont placés dans une image Docker aux côtés de **nginx**, un serveur web open source qui se contente de les
envoyer au navigateur. L'image obtenue ne contient ni code source ni outil de développement.

**Définitions**

| Terme | Définition |
|---|---|
| **Application monopage** | Site dont le navigateur charge une seule page, puis met à jour son contenu sans jamais la recharger entièrement. |
| **Bibliothèque** | Ensemble de fonctions déjà écrites, que les développeurs réutilisent dans leur propre code. |
| **Composant** | Morceau réutilisable de l'interface, qui réunit son affichage et son comportement. |
| **Contraste** | Écart de luminosité entre un texte et son fond. Le RGAA fixe un minimum pour que le texte reste lisible. |
| **Déclaratif** | Se dit d'un code qui décrit le résultat attendu plutôt que les étapes pour l'obtenir. |
| **ESLint** | Outil open source qui relit le code sans l'exécuter et signale les erreurs probables et les écarts aux règles de l'équipe. |
| **État** | Donnée qui appartient à un composant et dont la modification déclenche un nouvel affichage. |
| **Jeton de design** | Valeur nommée, par exemple une couleur, déclarée une seule fois et réutilisée partout. |
| **JSX** | Écriture qui permet de décrire le HTML d'un composant directement dans le code TypeScript. |
| **nginx** | Serveur web open source. Dans le projet, il envoie au navigateur les fichiers de l'interface. |
| **RGAA** | Référentiel français d'accessibilité, qui décline les règles internationales WCAG pour les services numériques. |
| **Tailwind CSS** | Bibliothèque de styles qui fournit de petites classes réutilisables (une couleur, une marge) à poser sur les éléments. |
| **Vite** | Outil qui affiche l'interface pendant le développement, avec mise à jour immédiate, et qui la construit pour la production. |

## Rôle dans le projet

- Il constitue le front-end de la plateforme : dépôt d'une annonce (échange, don ou vente, avec une photo facultative) et consultation de ses annonces.
- Il est séparé du back-end : les deux parties ne communiquent que par l'API REST, ce qui permet de faire évoluer
  l'interface sans toucher au back-end.
- Il délègue la connexion à [Keycloak](keycloak.md) et ne manipule aucun mot de passe.
- Il affiche à chaque membre ses seules annonces : l'API ne renvoie jamais celles des autres, quel que soit l'appel.
- Il tient compte de l'accessibilité :
    - les composants interactifs proviennent de [shadcn/ui](shadcn-ui.md), qui assure la navigation au clavier et la
      compatibilité avec les lecteurs d'écran ;
    - les contrastes de la palette sont contrôlés par un test automatique ;
    - chaque statut d'annonce est signalé par un mot, et non par la seule couleur.
- Il est configurable après sa construction : l'adresse de Keycloak est lue au démarrage dans un petit fichier fourni
  par Kubernetes. Changer d'environnement ne demande donc pas de reconstruire l'image.
- Sans lui, la plateforme n'a plus d'interface : il resterait l'API, utilisable seulement par des outils techniques.

La page se compose des éléments suivants :

| Composant | Rôle |
|---|---|
| **`App`** | Attend la fin de la connexion, récupère l'utilisateur, puis assemble la page et ses deux routes : le dépôt (`/`) et « Mes annonces » (`/mes-annonces`), grâce à React Router. |
| **`Header`** | Affiche le logo, la navigation, le nom de l'utilisateur, ses rôles et le bouton de déconnexion. |
| **`Footer`** | Pied de page : rubriques, mentions légales et lien d'accessibilité. |
| **`ListingForm`** | Formulaire de dépôt : titre, description, type d'annonce, catégorie, état, prix ou contrepartie, lieu de remise et photo. Les listes de catégories et de lieux viennent de l'API. Il affiche les erreurs renvoyées par l'API et conserve la saisie. |
| **`MyListings`** | Liste les annonces du membre, avec leur photo, leur type, leur lieu de remise et leur statut. |
| **`ConfirmationToast`** | Notification « Annonce soumise pour validation ! », affichée après le dépôt, avant la redirection vers la liste. |
| **`components/ui/`** | Composants de base issus de shadcn/ui, dont le bouton. |

## Fichiers et dossiers principaux

| Fichier ou dossier | Description |
|---|---|
| **`frontend/src/main.tsx`** | Point d'entrée : lance l'application dans la page. |
| **`frontend/src/App.tsx`** | Page principale, qui assemble les composants. |
| **`frontend/src/components/`** | Les composants de la page : en-tête, pied de page, formulaire, liste des annonces, notification. |
| **`frontend/src/components/ui/`** | Les composants de base de shadcn/ui. |
| **`frontend/src/api.ts`** | Prépare les appels à l'API et y joint le jeton de l'utilisateur. |
| **`frontend/src/auth.ts`** | Gère la connexion à Keycloak et le renouvellement du jeton. Après la connexion, la personne arrivée sur l'accueil est envoyée sur « Mes annonces » (une seule fois par onglet) ; une adresse précise ouverte au départ est conservée. |
| **`frontend/src/config.ts`** | Lit la configuration fournie au démarrage, dont l'adresse de Keycloak. |
| **`frontend/src/styles.css`** | Déclare la palette « Nuit de festival », la police Roboto et les styles communs. |
| **`frontend/public/fonts/`** | Les fichiers de la police Roboto, servis par le site lui-même. |
| **`frontend/src/theme.test.ts`** | Vérifie le contraste de chaque association de couleurs utilisée. |
| **`frontend/nginx.conf`** | Configure le serveur qui envoie l'interface au navigateur. |
| **`frontend/package.json`** | Liste les dépendances et les commandes de l'interface. |
| **`frontend/Dockerfile`** | Décrit la fabrication de l'image Docker de l'interface. |

## Commandes essentielles

À lancer dans un terminal, depuis le dossier du projet. `Ctrl+C` arrête une commande en cours.

| Commande | Description |
|---|---|
| **`make install`** | Installe les dépendances. |
| **`make frontend`** | Affiche l'interface sur <http://localhost:5173> et la met à jour à chaque modification du code. |
| **`make test`** | Lance les tests automatiques, dont le contrôle des contrastes. |
| **`make lint`** | Signale les erreurs probables et les écarts aux règles d'écriture de l'équipe. |
| **`make format`** | Met le code en forme selon les règles du projet. |
| **`make image-frontend`** | Construit l'image Docker de l'interface dans le cluster. |

!!! note "À savoir"
    L'interface exige Node 24 ou une version plus récente, celle des images Docker. Avec nvm : `nvm install 24`, puis
    `nvm alias default 24`. Dans WebStorm, choisir cet interpréteur dans les réglages de Node.js.

!!! warning "Attention"
    `make frontend` a besoin de Keycloak, qui s'exécute dans le cluster : vérifier d'abord avec `make pods` qu'il est
    démarré. Sans lui, l'interface reste bloquée sur la page de connexion.

!!! tip "Astuce"
    Une couleur ne se code jamais en dur dans un composant : elle se déclare dans `styles.css`, puis s'utilise par son
    nom. C'est ce qui permet au test de contraste de contrôler l'ensemble de la palette.

## Pour aller plus loin

- [Documentation de React en français](https://fr.react.dev/)
- [Documentation de Tailwind CSS](https://tailwindcss.com/docs)
- [Référentiel RGAA](https://accessibilite.numerique.gouv.fr/)
- [Fiche Vitest du projet](vitest.md) et [Testing Library](testing-library.md), pour les tests
