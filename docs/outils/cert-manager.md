# cert-manager

## Fiche d'identité

| Information | Détail |
|---|---|
| **Rôle** | Crée et renouvelle les certificats qui chiffrent les échanges en HTTPS |
| **Version** | cert-manager 1.18.2 |
| **Adresse en local** | Aucune interface : il travaille dans le cluster |

## Description

cert-manager est un outil libre de la fondation CNCF. Il s'installe dans le cluster Kubernetes. Il fabrique les
certificats demandés par les applications. Il les range dans des secrets. Il les renouvelle avant leur expiration. Les
navigateurs s'en servent pour chiffrer la connexion avec le site.

Dans le projet, les certificats sont signés par une autorité locale, que les navigateurs ne connaissent pas. Tant qu'elle
n'est pas importée, le navigateur affiche un avertissement. Surtout, il bloque les appels que l'application envoie à
Keycloak en arrière-plan : la connexion échoue avec le message « Impossible de joindre le serveur d'authentification ».
L'import du fichier `pme-ca.crt` se fait une seule fois par navigateur.

**Définitions**

- **Certificat** : fichier qui prouve l'identité d'un site et permet de chiffrer la connexion.
- **HTTPS** : version chiffrée du protocole HTTP.
- **TLS** : technique de chiffrement utilisée par le HTTPS.
- **Émetteur** : ressource qui signe les certificats. Ici, une autorité propre au projet.
- **Autorité de certification** : organisme, ou ici outil local, dont le navigateur accepte les signatures.
- **Certificat racine** : certificat de l'autorité. Le navigateur lui fait confiance, donc aussi aux certificats qu'elle signe.
- **Import** : ajout du fichier dans la liste des autorités reconnues par le navigateur.

## Rôle dans le projet

- Il fournit un certificat unique, valable pour les cinq noms d'hôte de l'ingress.
- Il signe ce certificat avec une autorité locale, créée une seule fois dans le cluster.
- Il le renouvelle seul, 15 jours avant son expiration.
- Sans l'import de l'autorité, la connexion avec Keycloak échoue dans le navigateur.
- En production, seul l'émetteur change (Let's Encrypt ou l'autorité de l'entreprise). Le reste des fichiers reste
  identique.

## Fichiers et dossiers principaux

| Fichier ou dossier | Description |
|---|---|
| `k8s/cert-manager/issuers.yaml` | Déclare l'autorité locale et l'émetteur. |
| `k8s/08-certificate.yaml` | Demande le certificat des cinq noms d'hôte. |
| `k8s/08-ingress.yaml` | Utilise le certificat pour chiffrer les échanges. |
| `pme-ca.crt` | Certificat de l'autorité locale, à importer dans le navigateur. |
| `.gitignore` | Empêche de versionner le fichier `pme-ca.crt`. |
| `Makefile` | Contient les commandes d'installation et d'export de l'autorité. |

## Commandes essentielles

À lancer dans un terminal, depuis le dossier du projet.

| Commande | Description |
|---|---|
| `make cert-manager` | Installe cert-manager et crée l'autorité locale. |
| `make ca-cert` | Écrit l'autorité locale dans le fichier `pme-ca.crt`. |
| `make deploy` | Demande le certificat avec le reste de la plateforme. |
| `make app` | Ouvre l'application pour vérifier la connexion. |

**Importer l'autorité dans Firefox**

1. Lancer `make ca-cert` pour obtenir le fichier `pme-ca.crt` à la racine du projet.
2. Ouvrir les paramètres de Firefox.
3. Saisir « certificats » dans le champ de recherche des paramètres.
4. Cliquer sur **Afficher les certificats**.
5. Ouvrir l'onglet **Autorités**, puis cliquer sur **Importer**.
6. Choisir le fichier `pme-ca.crt`.
7. Cocher **Confirmer cette AC pour identifier des sites web**, puis valider.
8. Fermer complètement Firefox, puis le rouvrir.
9. Lancer `make app` et se connecter.

**Importer l'autorité dans Chromium, Chrome ou Brave**

1. Lancer `make ca-cert` pour obtenir le fichier `pme-ca.crt`.
2. Ouvrir **Paramètres**, puis **Confidentialité et sécurité**, puis **Sécurité**.
3. Cliquer sur **Gérer les certificats**.
4. Ouvrir l'onglet **Autorités**, puis cliquer sur **Importer**.
5. Choisir le fichier `pme-ca.crt`.
6. Cocher **Faire confiance pour identifier des sites web**, puis valider.
7. Fermer complètement le navigateur, puis le rouvrir.

!!! tip "Astuce"
    `make minikube-up` lance déjà `make cert-manager` et `make ca-cert`. Sur un cluster existant, `make cert-manager`
    suffit, sans recréer le cluster.

!!! tip "Astuce"
    Un navigateur qui n'a pas encore l'autorité permet souvent d'ouvrir une page après un clic sur « Accepter le
    risque ». Cela ne suffit pas : les appels envoyés à Keycloak en arrière-plan restent bloqués. Seul l'import règle
    le problème.

!!! warning "Attention"
    Le fichier `pme-ca.crt` ne doit servir qu'à ce projet local. Ne jamais importer l'autorité d'un autre cluster ou
    d'une autre personne, car le navigateur lui ferait confiance pour tous les sites.

!!! note "À savoir"
    Un cluster recréé génère une nouvelle autorité. Relancer `make ca-cert`, supprimer l'ancienne autorité dans le
    navigateur, puis importer le nouveau fichier.

!!! note "À savoir"
    Les échanges ne sont chiffrés que jusqu'à l'ingress. Entre les services du cluster, le trafic reste en HTTP.

!!! note "À savoir"
    En production, un émetteur reconnu comme Let's Encrypt remplace l'autorité locale : les navigateurs lui font déjà
    confiance, sans import.

## Pour aller plus loin

- [Documentation de cert-manager](https://cert-manager.io/docs/)
- [Documentation de Kubernetes sur les ingress et le TLS](https://kubernetes.io/fr/docs/concepts/services-networking/ingress/#tls)
- [Fiche ingress-nginx du projet](ingress-nginx.md)
