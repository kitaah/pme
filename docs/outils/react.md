# React

## Fiche d'identité

| Information | Détail |
|---|---|
| **Rôle** | Construit l'interface web que les utilisateurs voient et utilisent |
| **Version** | React 19.3.1 |
| **Adresse en local** | <https://pme.localhost> et <http://localhost:5173> (mode développement) |

## Description

React est une bibliothèque libre qui sert à construire des interfaces web.
Elle découpe l’écran en composants, par exemple un formulaire ou une liste d’annonces.
React met à jour l’affichage dès que les données changent. L’interface est écrite en TypeScript,
et son apparence est définie avec le framework Tailwind CSS.
L’application s’exécute dans le navigateur de l’utilisateur et échange ses données avec le back-end par l’API.
Elle est fournie au navigateur par nginx. Ce serveur web est le point d’entrée unique de la plateforme :
il envoie l’interface au navigateur et transmet à l’API les demandes de l’interface.

**Définitions**

- **Bibliothèque** : ensemble de fonctions déjà écrites, que les développeurs réutilisent dans leur code.
- **Composant** : morceau réutilisable de l'interface, avec son affichage et son comportement.
- **ESLint** : outil libre qui relit le code sans l'exécuter, puis signale les erreurs probables
  et les écritures contraires aux règles de l'équipe.
- **nginx** : serveur web libre qui reçoit les demandes des navigateurs. Dans le projet, il renvoie l’interface React et
  transmet les autres demandes à l’API.

## Rôle dans le projet

- Il constitue le front-end de la nouvelle plateforme.
- Il est découplé du back-end : les deux parties communiquent uniquement par l'API REST.
- Il délègue la connexion à Keycloak et ne gère aucun mot de passe.
- Il peut évoluer ou être redéployé sans toucher au back-end.

## Fichiers et dossiers principaux

| Fichier ou dossier | Description |
|---|---|
| `frontend/src/main.tsx` | Point d'entrée : lance l'application dans la page. |
| `frontend/src/App.tsx` | Page principale, qui assemble les composants. |
| `frontend/src/components/` | Les composants : en-tête, formulaire, liste des annonces. |
| `frontend/src/auth.ts` | Gère la connexion avec Keycloak. |
| `frontend/src/api.ts` | Envoie les demandes à l'API. |
| `frontend/nginx.conf` | Configure le serveur web et la redirection des demandes vers l'API. |
| `frontend/package.json` | Liste les dépendances et les commandes du front-end. |
| `frontend/Dockerfile` | Fabrique l'image Docker de l'interface. |

## Commandes essentielles

À lancer dans un terminal, depuis le dossier du projet. `Ctrl+C` arrête une commande en cours.

| Commande | Description |
|---|---|
| `make install` | Installe les dépendances. |
| `make frontend` | Affiche l’interface et la met à jour à chaque modification du code. |
| `make test` | Lance les tests automatiques. |
| `make lint` | Repère les erreurs et les mauvaises pratiques dans le code, avec ESLint. |
| `make image-frontend` | Fabrique l'image Docker de l'interface dans Minikube. |

!!! note "À savoir"
`make frontend` a besoin de Keycloak : vérifier d'abord avec `make pods` qu'il est démarré.

## Pour aller plus loin

- [Site officiel de React](https://react.dev/)
- [Documentation de React en français](https://fr.react.dev/)