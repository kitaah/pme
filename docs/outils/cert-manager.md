# cert-manager

## Fiche d'identité

| Information | Détail |
|---|---|
| **Rôle** | Crée, range et renouvelle seul les certificats qui chiffrent les échanges de la plateforme |
| **Version** | cert-manager 1.18.2 |
| **Adresse en local** | Aucune interface : il travaille à l'intérieur du cluster |

## Description

cert-manager est un outil open source de la fondation CNCF, qui s'installe dans un cluster Kubernetes. Il fabrique
les **certificats** demandés par les applications, les range dans le cluster et les renouvelle avant leur expiration.

**À quoi sert un certificat ?**
Un certificat remplit deux fonctions indissociables. Il permet de **chiffrer** la connexion, afin qu'un tiers placé sur
le réseau ne puisse pas lire ce qui transite, ni un mot de passe ni une annonce. Il permet surtout de **prouver
l'identité** du serveur : sans lui, un chiffrement ne garantirait rien, puisque l'on pourrait dialoguer en toute
discrétion avec un imposteur.

**Qui garantit le certificat ?**
Un certificat n'a de valeur que signé par une **autorité de certification** en qui le client a déjà confiance. Sur
Internet, ce sont des organismes publics comme Let's Encrypt, dont les navigateurs connaissent les signatures
d'avance. Un cluster local ne peut pas obtenir de certificat auprès d'eux, car des adresses en `.localhost`
n'appartiennent à personne. cert-manager crée donc **une autorité propre au projet**, qui signe tous les certificats
du cluster.

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

amorce: "Émetteur auto-signé\nutilisé une seule fois" {class: boite}
autorite: "Autorité locale du projet\nvalable 10 ans" {class: boite}
public: "Certificat des 6 noms\nutilisé par l'ingress" {class: boite}
interne: "Certificats internes\nPostgreSQL et NATS" {class: boite}

amorce -> autorite
autorite -> public
autorite -> interne
```

**Le navigateur doit connaître cette autorité.**
Puisqu'elle est propre au projet, aucun navigateur ne la connaît. Il faut donc lui présenter une fois le fichier
`pme-ca.crt`, produit par `make ca-cert`. Sans cet **import**, le navigateur affiche un avertissement, ce qui pourrait
sembler anodin, mais il bloque surtout les appels que le site adresse à Keycloak en arrière-plan : la connexion échoue
alors avec le message « Impossible de joindre le serveur d'authentification ».

**Deux usages dans le projet.**
L'autorité signe d'abord le certificat public, celui que présente l'ingress aux navigateurs pour les sept noms d'hôte.
Elle signe aussi les certificats internes de PostgreSQL et de NATS, qui chiffrent les échanges à l'intérieur du
cluster. Dans ce second cas, ce sont les applications, et non le navigateur, qui vérifient le certificat et le nom du
serveur. Les certificats d'identité des pods, eux, sont émis par le maillage [Istio](istio.md) et ne passent pas par
cert-manager.

**Le renouvellement est automatique.**
Un certificat a une durée de vie limitée : 90 jours ici. cert-manager le remplace quinze jours avant son expiration,
sans intervention. C'est le principal intérêt de l'outil : un certificat expiré met un service hors ligne, et cette
panne arrive toujours au mauvais moment.

**Définitions**

| Terme | Définition |
|---|---|
| **Autorité de certification** | Organisme, ou ici outil local, dont les signatures sont reconnues par les clients. |
| **Certificat** | Fichier qui prouve l'identité d'un serveur et permet de chiffrer la connexion. |
| **Certificat racine** | Certificat de l'autorité elle-même. Lui faire confiance revient à accepter tout ce qu'elle signe. |
| **Émetteur** | Ressource du cluster qui signe les certificats demandés. |
| **HTTPS** | Version chiffrée du protocole HTTP, qui repose sur TLS. |
| **Import** | Ajout d'une autorité à la liste de celles que le navigateur reconnaît. |
| **Renouvellement** | Remplacement automatique d'un certificat avant son expiration. |
| **TLS** | Technique de chiffrement utilisée par le HTTPS et par les connexions internes. |

## Rôle dans le projet

- Il crée l'autorité locale du cluster, une seule fois, et la conserve pendant dix ans.
- Il fournit un certificat unique valable pour les sept noms d'hôte de l'[ingress](traefik.md).
- Il fournit les certificats internes de [PostgreSQL](postgresql.md) et de [NATS](nats.md).
- Il renouvelle chaque certificat quinze jours avant son expiration, sans intervention.
- Il rend la configuration transposable : en production, seul l'émetteur change, par exemple pour Let's Encrypt ou
  l'autorité interne de l'entreprise. Les demandes de certificat et les règles d'ingress restent identiques.
- Sans l'import de l'autorité dans le navigateur, la connexion à la plateforme échoue.

Les certificats émis sont les suivants :

| Certificat | Pour qui | Durée | Vérifié par |
|---|---|---|---|
| **Les sept noms en `.localhost`** | L'ingress | 90 jours | Le navigateur, après import de l'autorité. |
| **`postgres-tls`** | PostgreSQL | 90 jours | L'API, la modération, Keycloak et Grafana. |
| **`nats-tls`** | NATS | 90 jours | L'API et le service de modération. |

!!! warning "Attention"
    Le fichier `pme-ca.crt` ne doit servir qu'à ce projet local. Importer l'autorité d'un autre cluster ou d'une autre
    personne reviendrait à lui faire confiance pour tous les sites visités, ce qui constitue un vrai risque.

## Fichiers et dossiers principaux

| Fichier ou dossier | Description |
|---|---|
| **`k8s/cert-manager/issuers.yaml`** | Déclare l'autorité locale et l'émetteur qui signe les certificats. |
| **`k8s/08-certificate.yaml`** | Demande le certificat des sept noms d'hôte. |
| **`k8s/00-internal-tls.yaml`** | Demande les certificats internes de PostgreSQL et de NATS. |
| **`k8s/08-ingress.yaml`** | Utilise le certificat public pour chiffrer les échanges avec le navigateur. |
| **`pme-ca.crt`** | Certificat de l'autorité locale, à importer dans le navigateur. Ce fichier est exclu de Git. |
| **`Makefile`** | Contient les commandes d'installation et d'export de l'autorité. |

## Commandes essentielles

À lancer dans un terminal, depuis le dossier du projet.

| Commande | Description |
|---|---|
| **`make cert-manager`** | Installe cert-manager et crée l'autorité locale du cluster. |
| **`make ca-cert`** | Écrit l'autorité locale dans le fichier `pme-ca.crt`. |
| **`make ca-configmap`** | Copie l'autorité dans le namespace, pour que les applications vérifient les certificats internes. |
| **`make deploy`** | Demande les certificats avec le reste de la plateforme. |
| **`make app`** | Ouvre l'application pour vérifier que la connexion aboutit. |

Pour importer l'autorité dans Firefox :

1. Lancer `make ca-cert` pour obtenir le fichier `pme-ca.crt` à la racine du projet.
2. Ouvrir les paramètres de Firefox, puis saisir « certificats » dans le champ de recherche.
3. Cliquer sur **Afficher les certificats**, ouvrir l'onglet **Autorités**, puis cliquer sur **Importer**.
4. Choisir le fichier `pme-ca.crt`.
5. Cocher **Confirmer cette AC pour identifier des sites web**, puis valider.
6. Fermer complètement Firefox, puis le rouvrir.

Pour l'importer dans Chrome, Chromium ou Brave :

1. Lancer `make ca-cert`.
2. Ouvrir **Paramètres**, puis **Confidentialité et sécurité**, puis **Sécurité**.
3. Cliquer sur **Gérer les certificats**, ouvrir l'onglet **Autorités**, puis cliquer sur **Importer**.
4. Choisir le fichier `pme-ca.crt`.
5. Cocher **Faire confiance pour identifier des sites web**, puis valider.
6. Fermer complètement le navigateur, puis le rouvrir.

!!! note "À savoir"
    Un cluster recréé possède une nouvelle autorité. Il faut alors relancer `make ca-cert`, supprimer l'ancienne
    autorité dans le navigateur, puis importer le nouveau fichier.

!!! warning "Attention"
    Accepter l'avertissement du navigateur d'un simple clic ne règle rien : les appels envoyés à Keycloak en
    arrière-plan restent bloqués. Seul l'import de l'autorité permet à la connexion d'aboutir.

!!! tip "Astuce"
    `make minikube-up` lance déjà `make cert-manager` et `make ca-cert`. Sur un cluster existant, `make cert-manager`
    suffit : il n'est pas nécessaire de recréer le cluster.

## Pour aller plus loin

- [Documentation de cert-manager](https://cert-manager.io/docs/)
- [Documentation de Kubernetes sur les ingress et le TLS](https://kubernetes.io/fr/docs/concepts/services-networking/ingress/#tls)
- [Fiche Traefik du projet](traefik.md)
