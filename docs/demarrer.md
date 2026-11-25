# Démarrer le projet

## Fiche d'identité

| Information | Détail |
|---|---|
| **Rôle** | Donner, dans l'ordre, toutes les commandes pour mettre la plateforme en route sur un ordinateur, depuis zéro ou après un arrêt |
| **Durée** | Environ 15 à 20 minutes la première fois (création du cluster et construction des images), moins de 5 minutes après un `make undeploy` |
| **Système** | Linux (éprouvé sous Debian et Ubuntu) |
| **Ressources** | 5 120 Mo de mémoire et 2 processeurs pour Minikube (variables `MINIKUBE_MEMORY` et `MINIKUBE_CPUS`) |
| **Adresse du site** | <https://pme.localhost> |
| **Pour aller plus loin** | La liste complète des commandes est dans [Commandes make](commandes-make.md) |

## Description

Cette page répond à une seule question : **quelles commandes lancer, et dans quel ordre**, pour que la plateforme
fonctionne. La bonne suite dépend de l'état de départ : un ordinateur neuf, un cluster supprimé, un cluster arrêté ou un
simple `make undeploy`. Le tableau « Dans quel cas suis-je ? » aide à choisir, puis la section qui correspond donne les
commandes.

**Ce que le cluster contient.**
`make minikube-up` crée le cluster Minikube et y installe l'infrastructure : [Traefik](outils/traefik.md) (l'entrée du
site), [Istio](outils/istio.md) (le chiffrement entre services), [cert-manager](outils/cert-manager.md) (les
certificats) et [metrics-server](outils/metrics-server.md). `make seal` installe
[Sealed Secrets](outils/sealed-secrets.md), qui protège les mots de passe. `make deploy` installe ensuite la plateforme
elle-même, dans le namespace `pme`.

**Définitions**

| Terme | Définition |
|---|---|
| **Cluster** | L'ensemble des composants Kubernetes. Ici, il tourne dans un conteneur Docker créé par Minikube. |
| **Namespace** | Espace de noms Kubernetes. Celui de l'application s'appelle `pme` ; l'infrastructure vit dans d'autres. |
| **Secret scellé** | Mot de passe chiffré avec la clé du cluster, qui peut être versionné dans Git sans être lisible. |
| **Autorité locale** | Autorité de certification créée par cert-manager. Son certificat, `pme-ca.crt`, est à importer dans le navigateur. |

## Dans quel cas suis-je ?

| Situation | Ce qu'il reste à faire |
|---|---|
| **Premier démarrage**, ou après `minikube delete` | Toute la procédure de la section « Depuis zéro » |
| **Après `make undeploy`** | `make image` (facultatif), `make deploy`, `make pods` |
| **Après `make minikube-down` ou <br/> un redémarrage de l'ordinateur** | `minikube start`, puis `make pods` : la plateforme reprend telle qu'elle était |
| **Après un changement de code** | `make redeploy` |
| **Après un changement de branche** | `make image`, puis `make deploy` (voir « Changer de branche » plus bas) |
| **Repartir d'un namespace vide, cluster conservé** | `make reset` |

## Prérequis

À installer avant la première commande :

| Outil | Ce qu'il faut |
|---|---|
| **Docker** | Installé, démarré et utilisable sans `sudo`. Minikube s'en sert pour créer le cluster, et les images sont construites avec. |
| **Minikube** | Installé. |
| **`kubectl`** | Installé. |
| **`make`, `curl`, `openssl` et `sudo`** | `sudo` est demandé par `make minikube-up`, `make helm` et `make kubeseal`. |
| **Helm et `kubeseal`** | Installés par `make helm` et `make kubeseal` s'ils manquent. |

## Depuis zéro

À suivre depuis la racine du dépôt. Chaque commande attend la fin de la précédente.

| Étape | Commande ou action | Ce qu'elle fait |
|---|---|---|
| **1** | `minikube delete` | Supprime l'ancien cluster, et avec lui la clé de Sealed Secrets. À sauter sur un ordinateur où Minikube n'a jamais tourné. |
| **2** | `make env` | Crée `.env` à partir de `env.example`. Sans effet si le fichier existe déjà. |
| **3** | Éditer `.env` | Remplace chaque `CHANGE_ME` par un vrai mot de passe. `make seal` refuse de continuer s'il en reste. |
| **4** | `make helm` | Installe Helm s'il est absent. Requis par l'étape 6. |
| **5** | `make kubeseal` | Installe `kubeseal` à la bonne version s'il est absent. Requis par l'étape 9. |
| **6** | `make minikube-up` | Crée le cluster, puis installe Traefik, Istio, cert-manager et metrics-server. Écrit `pme-ca.crt`. |
| **7** | `make hosts` | Affiche la ligne à ajouter dans `/etc/hosts`. Elle n'écrit rien : la coller à la main. |
| **8** | Importer `pme-ca.crt` | Dans le navigateur, une seule fois, pour que les adresses en `.localhost` soient reconnues comme sûres. |
| **9** | `make seal` | Installe Sealed Secrets, génère les secrets manquants, puis chiffre `.env` dans `k8s/01-pme-secrets-sealed.yaml`. |
| **10** | `make image` | Construit les trois images (API, modération, interface) et les charge dans Minikube. |
| **11** | `make deploy` | Applique les manifestes, puis prépare le stockage des photos. |
| **12** | `make pods` | Suit le démarrage. Keycloak met environ une minute à être prêt : attendre que tous les pods soient `1/1 Running`. |
| **13** | `make smoke` | Vérifie que la plateforme répond. |

Ouvre ensuite <https://pme.localhost>, ou lance `make app`.

!!! note "À savoir"
    **Le fichier scellé change avec le cluster.** La clé de chiffrement est propre à chaque cluster : après
    `minikube delete`, l'étape 9 réécrit `k8s/01-pme-secrets-sealed.yaml`. Ce fichier est versionné dans Git :
    il faut donc le commiter. Sans l'étape 9, `make deploy` s'arrête avec « Sealed Secrets est absent ».

!!! note "À savoir"
    **Pas de redirection de port pour ouvrir le site.** Un cluster créé par `make minikube-up` publie déjà les ports 80
    et 443 de l'ordinateur. `make port-forward` ne sert qu'à joindre PostgreSQL et NATS depuis l'ordinateur (pour
    `make api` ou `make moderation`), ou si le port 80 n'est pas joignable.

## Après `make undeploy`

`make undeploy` supprime le namespace `pme`, donc les données (annonces, comptes, messages en attente, mesures, logs),
mais pas le cluster ni l'infrastructure. Les secrets scellés restent valables : la clé est toujours dans le cluster.

```bash
make image
make deploy
make pods
```

`make image` peut être sauté si le code et la branche n'ont pas changé depuis la dernière construction. Il est
nécessaire après un changement de branche, parce que les images du cluster sont celles de la branche précédente.

Pour avoir des annonces de test, lance `make seed-listings SEED_USER=<identifiant>` avec un utilisateur Keycloak existant.

## Après un arrêt ou un redémarrage

`make minikube-down` arrête le cluster sans le supprimer. Pour le relancer :

```bash
minikube start
make pods
```

Les données sont conservées. Si tous les sites répondent `502 Bad Gateway` alors que les pods sont prêts, le certificat
du maillage Istio a expiré pendant l'arrêt : `make ingress-restart` règle le problème.

## Changer de branche

Les images de l'API et de la modération embarquent le code de la branche où elles ont été construites. Après un
`git checkout`, le cluster garde donc l'ancienne version tant qu'on ne le met pas à jour :

```bash
npm ci
cd libs/common && npm run build && cd ../..
make image
make deploy
```

`npm ci` et la construction de `libs/common` mettent les dépendances locales à jour, ce qui évite l'erreur TypeScript
`TS2305` sur `@pme/common`. Les ressources que la nouvelle branche n'a plus (par exemple RabbitMQ) restent dans le
cluster, car `kubectl apply` ne supprime rien : elles se retirent à la main, ou avec `make reset`.

La procédure propre à la démonstration des deux brokers est décrite dans [Démonstration : NATS et
RabbitMQ](demo-brokers.md).

## Erreurs courantes

| Message ou symptôme | Cause | Solution |
|---|---|---|
| `helm absent : lancer make helm` | Helm n'est pas installé | `make helm`, puis relancer la commande |
| `Sealed Secrets est absent (cluster neuf)` | Le cluster ne contient pas Sealed Secrets, ou il a été recréé | `make seal`, puis `make deploy` |
| `cert-manager est absent : lancer make cert-manager` | L'infrastructure n'est pas installée | `make cert-manager` (ou `make minikube-up` sur un cluster neuf) |
| `Traefik est absent : lancer make ingress` | L'ingress n'est pas installé | `make ingress` |
| `Autorite locale absente : lancer make cert-manager` | cert-manager n'a pas encore créé l'autorité | `make cert-manager`, puis relancer |
| `make seal` refuse de continuer | `.env` contient encore `CHANGE_ME` | Remplacer chaque `CHANGE_ME` par un mot de passe |
| ztunnel plante avec `Too many open files` | La limite `inotify` de l'ordinateur est trop basse | `make inotify` (lancé aussi par `make istio`) |
| Keycloak n'est pas prêt après une minute | Démarrage lent, mémoire insuffisante | `make pods` et patienter ; vérifier la mémoire libre de l'ordinateur |
| Tous les sites répondent `502` | Certificat du maillage expiré | `make ingress-restart` |
| Le navigateur refuse le certificat | `pme-ca.crt` n'est pas importé | Importer `pme-ca.crt` dans le navigateur (étape 8) |
| PostgreSQL affiche `Skipping initialization` | Un ancien volume a survécu à un `undeploy` | `make undeploy` puis `make deploy` : `undeploy` supprime désormais ces volumes |
