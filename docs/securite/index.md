# Sécurité

## Fiche d'identité

| Information | Détail |
|---|---|
| **Rôle** | Rassemble toutes les mesures de sécurité de la plateforme, de la connexion d'un membre jusqu'aux droits des conteneurs |
| **Principe directeur** | Défense en profondeur : plusieurs barrières indépendantes, aucune n'étant supposée infaillible |
| **Couches traitées** | Identité, échanges, secrets, conteneurs, application |
| **Contrôles automatiques** | Hadolint, Trivy sur les images et les dépendances, SonarCloud, gitleaks |
| **Périmètre** | Le cluster local du POC. Les écarts avec un environnement de production sont signalés page par page |

## Description

La sécurité d'une plateforme n'est pas un composant qu'on ajoute : c'est une propriété de l'ensemble, qui tient à une
série de décisions prises à chaque étage. Cette section recense ces décisions pour « La Petite Maison de l'Épouvante »,
explique pourquoi chacune a été prise, et dit clairement ce qu'elle ne couvre pas.

**Le problème : une seule barrière finit toujours par céder.**
Il serait tentant de considérer qu'un système est sûr parce que l'accès est protégé par un mot de passe. Mais un mot de
passe peut être deviné, un jeton volé, une dépendance compromise, un conteneur mal configuré. Si toute la sécurité
repose sur une seule barrière, sa chute donne immédiatement accès à tout.

**La réponse : la défense en profondeur.**
Le principe consiste à empiler des barrières indépendantes, de sorte que la chute de l'une ne donne pas accès au reste.
Un attaquant qui obtiendrait un jeton valide se heurterait encore au contrôle des rôles ; s'il franchissait ce contrôle,
il trouverait des entrées bornées et validées ; s'il parvenait à exécuter du code dans un conteneur, celui-ci n'aurait
ni droits d'administrateur, ni système de fichiers modifiable, ni jeton d'accès au cluster.

**Le principe du moindre privilège.**
Il complète le précédent : chaque composant ne reçoit que les droits dont il a strictement besoin, et rien de plus. Un
conteneur qui n'a pas besoin d'écrire sur son disque ne peut pas écrire ; un service qui n'a pas besoin de parler au
cluster n'en reçoit pas la clé ; une route qui n'a pas besoin d'être publique ne l'est pas.

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

couches: "" {
  grid-rows: 5
  grid-gap: 8
  style.opacity: 0

  identite: "1. Identité — Keycloak, jeton signé, rôles" {class: boite}
  echanges: "2. Échanges — HTTPS, TLS interne, mots de passe chiffrés" {class: boite}
  application: "3. Application — validation, limitation de débit, en-têtes" {class: boite}
  conteneurs: "4. Conteneurs — sans droits d'administrateur, disque en lecture seule" {class: boite}
  secrets: "5. Secrets — chiffrés dans Git, déchiffrés par le cluster seul" {class: boite}
}
```

**Définitions**

| Terme | Définition |
|---|---|
| **Défense en profondeur** | Principe qui consiste à empiler des protections indépendantes, pour qu'aucune ne soit un point unique de défaillance. |
| **Moindre privilège** | Principe qui consiste à n'accorder à chaque composant que les droits strictement nécessaires. |
| **Surface d'attaque** | Ensemble des points par lesquels un système peut être attaqué : routes exposées, ports ouverts, comptes existants. |
| **Durcissement** | Ensemble des réglages qui réduisent la surface d'attaque d'un composant. |

## Ce qui est en place

Chaque mesure est détaillée dans la page de sa couche.

| Couche | Mesures principales | Page |
|---|---|---|
| **Identité et accès** | Connexion par Keycloak, jeton signé vérifié par l'API, deux rôles, refus par défaut, protection contre les essais répétés. | [Authentification](authentification.md) |
| **Échanges** | HTTPS sur tous les noms d'hôte, TLS jusqu'à PostgreSQL et NATS, certificats renouvelés seuls. | [Chiffrement](chiffrement.md) |
| **Secrets** | Mots de passe chiffrés avant d'entrer dans Git, déchiffrables par le seul cluster, recherche de secrets oubliés. | [Secrets](secrets.md) |
| **Conteneurs et cluster** | Aucun droit d'administrateur, disque en lecture seule, capacités retirées, images sans outils de développement. | [Durcissement](durcissement.md) |
| **Application** | Validation stricte des entrées, limitation de débit, en-têtes de sécurité, erreurs qui ne révèlent rien. | [Défenses applicatives](application.md) |

Trois contrôles de la [pipeline](../pipeline/index.md) vérifient automatiquement une partie de ces mesures : Hadolint
sur les Dockerfile, Trivy sur les images et les dépendances, container-structure-test sur le contenu des images. La
porte qualité de SonarCloud signale en plus les secrets oubliés et les failles du code.

!!! note "À savoir"
    Aucune mesure de cette section ne dépend d'une action manuelle au moment du déploiement. Tout est déclaré dans le
    dépôt : les manifestes Kubernetes, la configuration de Keycloak et le fichier de la pipeline. Un déploiement depuis
    un dépôt neuf reproduit donc exactement le même niveau de sécurité.

## Ce qui n'est pas couvert

Un POC n'est pas une plateforme de production, et le dire franchement vaut mieux que de le laisser croire. Les écarts
connus sont les suivants. Chacun est repris, avec son contexte, dans la page concernée.

| Limite | Conséquence | Page |
|---|---|---|
| **Aucune politique réseau** | Tout pod du namespace peut joindre n'importe quel autre, y compris la base. | [Durcissement](durcissement.md) |
| **Un seul compte PostgreSQL** | Les quatre bases partagent le même compte : aucune séparation des droits. | [Durcissement](durcissement.md) |
| **Outils d'exploitation sans authentification** | Adminer, Prometheus et Alloy sont joignables sans mot de passe propre. | [Authentification](authentification.md) |
| **Autorité de certification locale** | Les certificats ne sont reconnus qu'après import manuel dans le navigateur. | [Chiffrement](chiffrement.md) |
| **Pas de second facteur** | La connexion repose sur le seul mot de passe, dont la politique impose 12 caractères mais n'écarte pas les mots de passe courants. | [Authentification](authentification.md) |
| **Aucune journalisation des accès** | Les journaux applicatifs ne constituent pas une piste d'audit. | [Application](application.md) |
| **Analyse des failles non planifiée** | Une faille publiée sans changement du code n'est vue qu'au contrôle suivant. | [Analyse des dépendances](../pipeline/analyse-dependances.md) |

!!! warning "Attention"
    Ces limites sont acceptables pour une démonstration sur un ordinateur, qui ne contient aucune donnée réelle et n'est
    joignable depuis aucun réseau. Elles ne le seraient pas pour une plateforme exposée à des membres : la liste
    ci-dessus est donc aussi la liste des travaux à mener avant toute mise en service.

!!! tip "Astuce"
    Pour juger du niveau de sécurité d'un composant, lire sa page dans cette section, puis les commentaires de son
    manifeste dans `k8s/`. Chaque réglage non évident y est justifié à l'endroit où il est écrit.

## Pour aller plus loin

- [Les dix risques applicatifs de l'OWASP](https://owasp.org/www-project-top-ten/)
- [Guide d'hygiène informatique de l'ANSSI](https://cyber.gouv.fr/publications/guide-dhygiene-informatique)
- [Bonnes pratiques de sécurité de Kubernetes](https://kubernetes.io/docs/concepts/security/security-checklist/)
- [Exigences qualité du projet](../pipeline/exigences-qualite.md)
