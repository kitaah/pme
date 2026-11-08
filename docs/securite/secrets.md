# Gestion des secrets

## Fiche d'identité

| Information | Détail |
|---|---|
| **Rôle** | Permet de versionner les mots de passe du projet dans Git sans les exposer |
| **Outil** | [Sealed Secrets](../outils/sealed-secrets.md) 0.41.2, de Bitnami |
| **Secrets gérés** | 8 valeurs : accès à PostgreSQL, à NATS, à l'administration de Keycloak et de Grafana |
| **Source locale** | Le fichier `.env`, jamais versionné |
| **Contrôle automatique** | gitleaks, par `make secrets-scan` |

## Description

Un **secret** est une valeur qui donne un accès : un mot de passe, une clé, un jeton. Le projet en compte huit, et tous
posent la même question : où les écrire ? Les laisser dans le code revient à les publier. Les garder sur l'ordinateur
d'une seule personne revient à bloquer l'équipe le jour où cette personne est absente.

**Le problème : Git n'oublie rien.**
Un mot de passe écrit dans un fichier versionné, puis retiré au commit suivant, reste lisible dans l'historique. Le
retirer vraiment suppose de réécrire cet historique, donc de casser les copies de tous les autres. En pratique, un
secret poussé dans un dépôt est un secret à changer.

**Un secret Kubernetes n'est pas chiffré.**
C'est une confusion fréquente. Le format Secret de Kubernetes encode ses valeurs en base64, un codage réversible que
n'importe qui peut défaire en une commande. Versionner un Secret ordinaire revient donc exactement à versionner le mot
de passe en clair.

**La solution : chiffrer avant, déchiffrer dans le cluster.**
Sealed Secrets installe un contrôleur dans le cluster, qui détient une paire de clés. L'outil `kubeseal` chiffre les
secrets avec la **clé publique** : le fichier obtenu peut être versionné et lu par n'importe qui sans risque. Seul le
contrôleur, qui détient la **clé privée**, sait le déchiffrer, et il ne le fait qu'à l'intérieur du cluster, pour
produire le Secret que les applications liront.

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
  grid-rows: 5
  grid-gap: 8
  style.opacity: 0

  un: "1. .env sur l'ordinateur, jamais versionné" {class: boite}
  deux: "2. kubeseal chiffre avec la clé publique" {class: boite}
  trois: "3. Fichier scellé, versionné dans Git" {class: boite}
  quatre: "4. Le contrôleur déchiffre avec la clé privée" {class: boite}
  cinq: "5. Secret Kubernetes, lu par les pods" {class: boite}
}
```

**Définitions**

| Terme | Définition |
|---|---|
| **base64** | Codage qui transforme des données en texte. Réversible par n'importe qui : ce n'est pas du chiffrement. |
| **Chiffrement asymétrique** | Procédé à deux clés : l'une chiffre et peut être publique, l'autre déchiffre et reste secrète. |
| **gitleaks** | Outil qui parcourt un dépôt à la recherche de secrets oubliés. |
| **kubeseal** | Programme qui chiffre un Secret avec la clé publique du contrôleur. |
| **Secret** | Objet Kubernetes qui porte des valeurs sensibles et les expose aux pods. |

## Ce qui est en place

**Le parcours d'un secret**

1. `make env` crée `.env` depuis son modèle, avec un masque de permissions strict. Le fichier est ignoré par Git.
2. La personne remplace les valeurs `CHANGE_ME` par de vrais mots de passe.
3. `make seal` chiffre ces valeurs et écrit `k8s/14-pme-secrets-sealed.yaml`, qui est versionné.
4. `make deploy` applique ce fichier. Le contrôleur le déchiffre et crée le Secret dans le cluster.
5. Les pods lisent les valeurs par référence au Secret, jamais en clair dans un manifeste.

**Les garde-fous**

| Mesure | Ce qu'elle empêche |
|---|---|
| **`.env` ignoré par Git** | Les mots de passe réels ne peuvent pas être poussés par mégarde. |
| **Permissions strictes à la création** | Le fichier n'est lisible que par son propriétaire. |
| **Refus des valeurs `CHANGE_ME`** | `make seal` s'arrête si une valeur du modèle n'a pas été remplacée : on ne scelle pas un mot de passe d'exemple en croyant sécuriser le cluster. |
| **Refus d'une variable absente** | Un secret oublié est signalé, plutôt que scellé à vide. |
| **Fichier temporaire supprimé** | Les valeurs transitent par un fichier temporaire à permissions restreintes, effacé même si la commande échoue. |
| **Jamais en argument de commande** | Les arguments d'une commande sont visibles par tous les utilisateurs de la machine ; les valeurs passent donc par l'environnement et par ce fichier. |
| **Aucun affichage** | `make seal` confirme la mise à jour sans jamais afficher les valeurs. |

**La recherche de secrets oubliés**
`make secrets-scan` passe gitleaks sur tout le dépôt. L'outil connaît les formes habituelles de clés et de jetons et
signale ce qui y ressemble. Deux fichiers sont volontairement écartés de la recherche : le modèle `env.example` et le
realm de Keycloak, qui contiennent des valeurs de démonstration sans portée réelle.

**Dans la pipeline**
Les valeurs sensibles de la CI ne sont pas dans le dépôt : le jeton SonarCloud est défini dans les réglages du projet
GitLab et masqué dans les journaux. Les identifiants du registre d'images sont fournis par GitLab pour la seule durée
du job. Côté images, un contrôle de structure vérifie qu'aucun fichier `.env` n'a été copié par erreur.

!!! note "À savoir"
    Le fichier scellé ne vaut que pour le cluster qui l'a scellé : la clé privée du contrôleur est propre à chaque
    installation. Un `minikube delete` la détruit, et le fichier versionné devient inutilisable. Il faut alors relancer
    `make seal` depuis `.env`, qui reste la source de vérité sur l'ordinateur.

## Ce qui n'est pas couvert

- **Les secrets sont montés en variables d'environnement** : c'est simple et lisible, mais une variable d'environnement
  est visible par tout processus du conteneur et peut apparaître dans un vidage mémoire ou une trace. Un montage en
  fichier réduirait cette exposition.
- **Aucune rotation** : changer un mot de passe suppose de modifier `.env`, de relancer `make seal`, puis de
  redéployer. Rien ne l'impose à échéance régulière, et rien ne signale un secret trop ancien.
- **Aucun audit** : personne ne sait quel composant a lu quel secret, ni quand.
- **La clé privée du contrôleur n'est pas sauvegardée** : c'est sans conséquence ici, puisque `.env` permet de tout
  resceller, mais ce serait un point critique dans un environnement durable.
- **Un seul jeu de secrets** : les mêmes valeurs servent à toutes les bases et à tous les services. Le chapitre
  [Durcissement](durcissement.md) revient sur ce point pour PostgreSQL.

Un gestionnaire comme HashiCorp Vault répondrait à la rotation et à l'audit, au prix d'un service supplémentaire à
installer, initialiser, desceller et sauvegarder. Pour huit valeurs fixes de démonstration, Sealed Secrets suffit.

## Commandes de vérification

À lancer dans un terminal, depuis le dossier du projet.

| Commande | Description |
|---|---|
| `make env` | Crée `.env` depuis son modèle s'il manque, sans jamais l'écraser. |
| `make seal` | Rechiffre `.env` dans le fichier scellé, à versionner ensuite. |
| `make secrets-scan` | Cherche des secrets oubliés dans tout le dépôt. |
| `git check-ignore -v .env` | Confirme que `.env` est bien ignoré par Git. |

!!! warning "Attention"
    Un secret qui a été poussé dans le dépôt, même retiré au commit suivant, doit être considéré comme compromis et
    changé. Le retirer de l'historique ne suffit pas : il a pu être copié entre-temps.

!!! tip "Astuce"
    Lancer `make secrets-scan` avant chaque envoi de code coûte quelques secondes et évite le seul incident de cette
    page qui ne se rattrape pas.

## Fichiers principaux

| Fichier ou dossier | Description |
|---|---|
| `env.example` | Modèle des variables attendues, avec des valeurs de démonstration. |
| `.env` | Les vraies valeurs, sur l'ordinateur, jamais versionnées. |
| `k8s/14-pme-secrets-sealed.yaml` | Les huit secrets chiffrés, versionnés dans Git. |
| `Makefile`, cible `sealed-secrets` | Installe le contrôleur, à une version épinglée. |
| `.gitleaks.toml` | Règles de recherche de secrets et exceptions assumées. |
| `Makefile`, cibles `env`, `seal` et `secrets-scan` | Création de `.env`, scellement et recherche de secrets. |

## Pour aller plus loin

- [Fiche Sealed Secrets du projet](../outils/sealed-secrets.md)
- [Dépôt officiel de Sealed Secrets](https://github.com/bitnami-labs/sealed-secrets)
- [Les Secrets de Kubernetes et leurs limites](https://kubernetes.io/docs/concepts/configuration/secret/)
