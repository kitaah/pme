# Authentification et autorisation

## Fiche d'identité

| Information | Détail |
|---|---|
| **Rôle** | Établit qui est la personne qui se connecte, et ce qu'elle a le droit de faire |
| **Serveur d'identité** | [Keycloak](../outils/keycloak.md) 26.8.1, realm `pme` |
| **Protocole** | OpenID Connect, flux Authorization Code avec PKCE |
| **Rôles** | `membre` (dépose et consulte ses annonces) et `moderateur` (lit la file de modération) |
| **Durée d'un jeton** | 5 minutes |

## Description

Deux questions distinctes se posent à chaque requête. **L'authentification** répond à « qui êtes-vous ? » :
elle établit l'identité. **L'autorisation** répond à « avez-vous le droit ? » : elle vérifie les permissions. Les deux
sont traitées séparément dans le projet, et la seconde n'a de sens que si la première a réussi.

**Le problème : chaque service ne peut pas gérer ses propres comptes.**
Si l'API et le service de modération détenaient chacun leur base de comptes, il faudrait créer deux fois chaque
utilisateur, changer deux fois chaque mot de passe, et chaque service devrait stocker des empreintes de mots de passe,
avec le risque que cela représente. Un service d'identité unique résout cela : il est le seul à connaître les mots de
passe, et les applications ne reçoivent qu'une preuve d'identité.

**Comment ça marche : le jeton signé.**
Quand un membre se connecte, Keycloak vérifie son mot de passe et lui remet un **jeton** : un petit document qui
contient son identifiant, son nom et ses rôles, et que Keycloak signe avec sa clé privée. Le navigateur joint ce jeton à
chaque appel. L'API n'a jamais vu le mot de passe : elle vérifie seulement que la signature est authentique, à l'aide
de la clé publique de Keycloak. Si elle l'est, le contenu du jeton est digne de confiance, car il est impossible de le
modifier sans invalider la signature.

**Pourquoi PKCE.**
L'interface est une application qui s'exécute dans le navigateur : elle ne peut garder aucun secret, puisque tout son
code est lisible. Le flux **PKCE** règle ce problème. Avant de partir vers Keycloak, l'interface tire un secret au
hasard, n'en envoie que l'empreinte, puis présente le secret entier au moment d'échanger le code contre un jeton. Un
attaquant qui intercepterait le code ne pourrait rien en faire sans ce secret, qui n'a jamais circulé.

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

etapes: "" {
  grid-rows: 4
  grid-gap: 8
  style.opacity: 0

  un: "1. Le membre saisit son mot de passe sur la page de Keycloak" {class: boite}
  deux: "2. Keycloak lui remet un jeton signé, valable 5 minutes" {class: boite}
  trois: "3. Le navigateur joint ce jeton à chaque appel de l'API" {class: boite}
  quatre: "4. L'API vérifie la signature, l'émetteur, la date et le rôle" {class: boite}
}
```

**Définitions**

| Terme | Définition |
|---|---|
| **Authentification** | Vérification de l'identité : « qui êtes-vous ? » |
| **Autorisation** | Vérification des droits : « avez-vous le droit de faire ceci ? » |
| **JWKS** | Liste des clés publiques qu'un serveur d'identité publie pour que d'autres vérifient ses signatures. |
| **Jeton (JWT)** | Document signé contenant l'identité et les rôles d'une personne, joint à chaque requête. |
| **OpenID Connect** | Protocole standard de connexion, construit au-dessus d'OAuth 2. |
| **PKCE** | Extension d'OAuth 2 qui protège le flux de connexion des applications incapables de garder un secret. |
| **Politique de mots de passe** | Règles qu'un mot de passe doit respecter pour être accepté : longueur, types de caractères. |
| **Realm** | Espace cloisonné de Keycloak : ses propres comptes, rôles et applications. |
| **Resource server** | Application qui ne gère aucun compte et se contente de vérifier les jetons qu'on lui présente. |

## Ce qui est en place

**Côté Keycloak**

| Mesure | Valeur | Ce qu'elle empêche |
|---|---|---|
| **Inscription libre** | Désactivée | Personne ne peut se créer un compte : ils sont déclarés dans le realm. |
| **Protection contre les essais répétés** | Après 5 échecs | Un attaquant ne peut pas essayer les mots de passe en masse. |
| **Attente après blocage** | 60 secondes, doublée à chaque nouvel échec, jusqu'à 15 minutes | Rend une attaque par force brute impraticable. |
| **Durée d'un jeton d'accès** | 300 secondes | Un jeton volé n'est exploitable que 5 minutes. |
| **HTTPS exigé** | Pour toute requête non locale | Le mot de passe ne circule jamais en clair. |

**L'application déclarée**

| Application | Flux autorisé | Usage |
|---|---|---|
| `pme-web` | Authorization Code avec PKCE (S256) | L'interface du site. Les adresses de retour sont limitées à `pme.localhost` et au serveur de développement. |

**Côté API et service de modération**

- **Refus par défaut** : sur l'API, une garde globale exige un jeton valide sur toutes les routes. Seules les routes
  explicitement marquées publiques, la sonde de santé et les mesures, y échappent. Une nouvelle route est donc protégée
  dès son écriture, sans que personne ait à y penser.
- **Quatre vérifications sur chaque jeton** : la signature (algorithme RS256, clé publique récupérée auprès de
  Keycloak), l'émetteur, la date d'expiration, et l'application émettrice, qui doit figurer dans la liste autorisée.
- **Contrôle des rôles** : le dépôt et la lecture des annonces exigent le rôle `membre`, la file de modération le rôle
  `moderateur`. Un jeton valide mais sans le bon rôle reçoit une erreur 403, distincte du 401 d'un jeton absent ou
  invalide.
- **Cloisonnement des données** : un membre ne lit que ses propres annonces. La requête filtre sur l'identifiant tiré du
  jeton, et non sur un paramètre fourni par l'appelant.
- **Aucun compte stocké** : la base ne contient que l'identifiant Keycloak du propriétaire et son nom d'affichage.
  Aucun mot de passe, aucune adresse électronique.

Dans le service de modération, les gardes sont posées sur le contrôleur plutôt que globalement : ce service est aussi un
consommateur de messages NATS, et une garde globale s'appliquerait aussi à des messages qui n'ont pas de jeton HTTP.

**Un détail qui compte : où sont lues les clés publiques.**
L'API récupère les clés de signature par l'adresse interne du cluster, en HTTP simple (chiffré en mTLS par le maillage
[Istio](../outils/istio.md)), alors que l'émetteur attendu dans le jeton reste l'adresse publique vue par le navigateur. Les deux adresses diffèrent volontairement : l'API n'a ainsi
pas besoin de faire confiance au certificat de l'autorité locale pour vérifier une signature. Les clés sont gardées en
mémoire dix minutes, et le nombre d'appels est plafonné à dix par minute.

**La politique de mots de passe**
Le realm `pme` impose une politique à tout mot de passe défini après le déploiement : 12 caractères au moins, avec une
majuscule, une minuscule et un chiffre, et différent de l'identifiant. Elle est posée par le même travail de
déploiement que l'administrateur, juste après l'import du realm. Le realm ne contient aucun compte d'utilisateur : ceux
que l'on crée ensuite dans la console de Keycloak la respectent dès leur création.

**L'administrateur de Keycloak**
Keycloak 26 ne crée au démarrage qu'un compte d'amorçage temporaire. Un travail de déploiement crée l'administrateur
permanent à partir des secrets du cluster, puis **supprime le compte d'amorçage**. Il ne reste donc aucun compte par
défaut une fois le déploiement terminé.

!!! note "À savoir"
    L'interface renouvelle le jeton trente secondes avant son expiration, sans que le membre s'en aperçoive. Si le
    renouvellement échoue, parce que la session a expiré, elle le renvoie vers la page de connexion plutôt que
    d'afficher une erreur.

## Ce qui n'est pas couvert

- **Politique de mots de passe limitée à la forme** : longueur et types de caractères. Rien n'interdit un mot de passe
  courant ou déjà divulgué (« Azertyuiop123 »), et il n'y a ni historique ni expiration.
- **Aucun second facteur** : la connexion repose sur le seul mot de passe. Keycloak sait gérer un code à usage unique,
  mais il n'est pas activé.
- **Pas de révocation immédiate** : désactiver un compte dans Keycloak n'invalide pas le jeton déjà remis. Il reste
  utilisable jusqu'à cinq minutes. Un contrôle de la session à chaque requête l'éviterait, au prix d'une dépendance
  permanente à Keycloak ; la durée courte du jeton est le compromis usuel.
- **Les outils d'exploitation n'ont pas d'authentification propre** : Adminer ouvre directement un écran de connexion à
  la base, Prometheus et Alloy répondent sans aucun contrôle. Seule Grafana a un compte administrateur, avec
  l'inscription et l'accès anonyme désactivés. Dans un environnement partagé, ces trois interfaces devraient passer
  derrière Keycloak, ou ne pas être exposées du tout.
- **Keycloak fonctionne en mode développement.** Ce mode simplifie le démarrage, mais il est déconseillé en production :
  certains contrôles sont assouplis et le serveur reconstruit une partie de son code à chaque démarrage. Le mode de
  production exige un certificat, un nom d'hôte fixe et une base dimensionnée.

## Commandes de vérification

À lancer dans un terminal, depuis le dossier du projet, la plateforme déployée.

| Commande | Description |
|---|---|
| `make keycloak` | Ouvre la console d'administration de Keycloak. |

Pour vérifier le refus par défaut, trois appels suffisent :

1. Un appel sans jeton à `/api/v1/listings/mine` doit répondre **401**.
2. Le même appel avec le jeton d'un membre doit répondre **200**.
3. Un appel à `/api/v1/moderation/queue` avec ce même jeton doit répondre **403**, faute du rôle `moderateur`.

!!! warning "Attention"
    Le realm ne contient aucun compte d'utilisateur : `membre` et `moderateur` se créent à la main dans la console
    de Keycloak (voir la fiche Keycloak).

!!! tip "Astuce"
    Pour lire le contenu d'un jeton sans outil particulier, le coller sur un décodeur hors ligne ou afficher sa partie
    centrale. Les champs `sub`, `azp`, `exp` et `realm_access.roles` sont exactement ceux que l'API vérifie.

## Fichiers principaux

| Fichier ou dossier | Description |
|---|---|
| `k8s/config/realm-pme.json` | Déclare le realm, les rôles et l'application. |
| `k8s/03-keycloak-admin-job.yaml` | Crée l'administrateur permanent, supprime le compte d'amorçage et pose la politique de mots de passe. |
| `api/src/auth/jwt.strategy.ts` | Vérifie la signature, l'émetteur, la date et l'application émettrice. |
| `api/src/auth/jwt-auth.guard.ts` | Garde globale : exige un jeton sauf sur les routes marquées publiques. |
| `api/src/auth/roles.guard.ts` | Contrôle des rôles, erreur 403 en cas de refus. |
| `moderation-service/src/moderation/moderation.controller.ts` | Pose les gardes sur le contrôleur, pas sur le service entier. |
| `frontend/src/auth.ts` | Connexion par PKCE et renouvellement du jeton côté navigateur. |

## Pour aller plus loin

- [Fiche Keycloak du projet](../outils/keycloak.md)
- [Le flux Authorization Code avec PKCE](https://www.rfc-editor.org/rfc/rfc7636.html)
- [Bonnes pratiques de sécurité pour OAuth 2](https://datatracker.ietf.org/doc/html/draft-ietf-oauth-security-topics)
- [Page des tests d'intégration, qui vérifient ces contrôles](../pipeline/tests-integration.md)
