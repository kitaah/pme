# Commandes `make`

## Fiche d'identité

| Information | Détail |
|---|---|
| **Rôle** | Point d'entrée unique de toutes les opérations du projet : cluster, secrets, déploiement, observation, développement, qualité, tests et documentation |
| **Fichier** | `Makefile`, à la racine du dépôt |
| **Nombre de commandes** | 86 cibles, regroupées en douze thèmes ci-dessous (plus `seal-now`, étape interne de `make seal`) |
| **Aide intégrée** | `make help`, qui n'en liste qu'une partie : cette page est la liste complète |
| **Configuration** | Variables en tête du `Makefile` (voir la dernière section) et fichier `.env` pour les mots de passe |

## Description

Le projet compte beaucoup d'opérations : démarrer un cluster, y installer un ingress, un maillage et des certificats,
chiffrer des secrets, construire trois images, lire des files de messages, lancer des contrôles de qualité. Chacune
s'écrit en plusieurs commandes longues, avec des options qui ne se retrouvent pas de tête.

**Le problème : des opérations nombreuses, longues et dans un ordre précis.**
Sans point d'entrée commun, chaque opération exige de retrouver la bonne commande, ses options, son espace de noms et
ses prérequis. Une erreur d'ordre (déployer avant d'avoir installé l'ingress, par exemple) donne des messages obscurs.

**La réponse : une commande courte par opération.**
Chaque opération porte un nom (`make deploy`, `make queues`, `make test`) et le `Makefile` en conserve les options, les
vérifications préalables et les messages d'erreur. Les commandes qui dépendent d'une autre la lancent d'elles-mêmes
(`make minikube-up` enchaîne ingress, Istio, cert-manager et metrics-server), et celles qui ne peuvent pas réussir sans
prérequis le disent avant d'échouer.

**Comment lire les tableaux.**
Chaque ligne donne la commande et ce qu'elle fait. Les prérequis (Docker, `sudo`, un outil à installer) sont indiqués
dans la description, et une commande lancée par une autre le précise.

**Ordre habituel.**
Au premier démarrage, et après un `minikube delete` : `make minikube-up`, import de l'autorité locale dans le
navigateur, `make seal` (nouveau cluster, donc nouvelle clé ; génère aussi les secrets de Garage s'ils manquent), `make image`
(le nouveau cluster n'a plus les images), puis `make deploy`, qui lance aussi la mise en service du stockage des photos. Après une modification du code :
`make redeploy`. Pour repartir de zéro dans le même cluster : `make reset`.

**Définitions**

| Terme | Définition |
|---|---|
| **Cible** | Nom d'une opération du `Makefile`, celui qu'on tape après `make`. |
| **Variable** | Valeur modifiable en ligne de commande, par exemple `make deploy NS=autre`. |
| **Autorité locale** | Autorité de certification créée par cert-manager, qui signe tous les certificats du cluster. |
| **Port-forward** | Redirection d'un port du cluster vers l'ordinateur, pour joindre un composant sans ingress. |
| **Namespace** | Espace de noms Kubernetes. Celui de l'application s'appelle `pme`. |

## Rôle dans le projet

- Il rend reproductible la mise en place de l'environnement : un nouveau venu suit la même suite de commandes que les autres.
- Il reproduit en local les contrôles de la pipeline (`make quality`, `make test`, `make test-perf`, `make image-test`).
- Il regroupe les vérifications de sécurité (`make mesh-check`, `make authz-check`, `make netpol-check`, `make jwt-check`) qui prouvent le
  chiffrement et le cloisonnement du cluster.
- Il donne des raccourcis de lecture (`make pods`, `make queues`, `make db-listings`) qui évitent d'ouvrir un outil complet.

!!! note "À savoir"
    Le `Makefile` crée aussi deux fichiers qui ne sont pas des commandes : `.env`, produit à la demande depuis
    `env.example`, et `k8s/14-pme-secrets-sealed.yaml`, généré par `make deploy` s'il manque. Une fois présents, ils ne
    sont jamais réécrits tout seuls : après un changement de mot de passe, c'est `make seal` qui les met à jour. Les
    quatre secrets de Garage et les quatre mots de passe des comptes PostgreSQL de service, eux, sont générés dans `.env` par `make seal` s'ils manquent, puis jamais modifiés.

## Toutes les commandes

### Aide et préparation

| Commande | Description |
|---|---|
| **`make help`** | Affiche une liste de commandes regroupées par thème. Elle est abrégée : les contrôles de qualité, `restart` ou `stop-forward`, par exemple, n'y figurent pas. |
| **`make env`** | Crée `.env` à partir de `env.example` s'il manque, avec les droits 600, et ne l'écrase jamais. Remplacer ensuite les `CHANGE_ME` par de vrais mots de passe. |
| **`make scripts-perms`** | Rend exécutables les scripts `.sh` de `scripts/` et de `k8s/config/`, et l'enregistre dans Git (à committer ensuite). À lancer après un clonage ou une extraction d'archive. |

### Cluster et réseau

| Commande | Description |
|---|---|
| **`make minikube-up`** | Démarre Minikube (pilote Docker, Calico, ports 80 et 443 publiés sur `127.0.0.1`), puis enchaîne `ingress`, `istio`, `cert-manager`, `ca-cert` et `metrics-server`. Les options de création ne s'appliquent qu'à un cluster neuf. |
| **`make minikube-down`** | Arrête Minikube. Le cluster et ses données sont conservés. |
| **`make helm`** | Installe Helm sur l'ordinateur s'il est absent, avec le script officiel (version épinglée, `sudo` demandé). Sans effet s'il est déjà là. Requis par `ingress` et `istio`. |
| **`make ingress`** | Désactive l'ingress de Minikube, installe Traefik par son chart Helm (version épinglée, plugin de validation des jetons compris) et attend qu'il soit prêt. Coupe l'ingress quelques secondes lors d'une mise à jour. |
| **`make ingress-restart`** | Redémarre Traefik et attend qu'il soit prêt. À lancer quand tous les sites répondent « 502 Bad Gateway » alors que les pods sont prêts : le certificat que le maillage donne à Traefik dure 24 h, et s'il n'a pas été renouvelé (portable mis en veille, par exemple), les pods refusent ses connexions. Le log de `ztunnel` affiche alors `ExpiredContext`. |
| **`make mesh-renew`** | Renouvelle les certificats du maillage Istio : redémarre `ztunnel`, Traefik, puis l'API, la modération et le front. À lancer quand les pods n'arrivent plus à se joindre (PostgreSQL `ECONNRESET`, NATS `CONNECTION_REFUSED`, nouveaux pods en `CrashLoopBackOff`) et que le log de `ztunnel` affiche `CertificateExpired` ou `ExpiredContext`. Non lancé par `deploy` ni `redeploy`. |
| **`make inotify`** | Relève la limite `inotify` du noyau (1024 instances par défaut, `sudo` demandé) et la rend permanente. Linux uniquement, sans effet si la limite suffit. Requis par ztunnel, lancé par `istio`. |
| **`make istio`** | Installe Istio en mode ambient (quatre charts Helm : base, istiod, cni, ztunnel) et enrôle le namespace de Traefik dans le maillage. Exige `make ingress` d'abord. |
| **`make istio-scan`** | Analyse avec Trivy les trois images d'Istio. Échoue sur une faille CRITICAL corrigeable, signale les HIGH à titre d'information. |
| **`make cert-manager`** | Installe cert-manager, crée l'autorité locale et attend que son certificat soit prêt. |
| **`make ca-cert`** | Écrit l'autorité locale dans `pme-ca.crt`, à importer une fois dans le navigateur. À refaire après la recréation du cluster. |
| **`make ca-configmap`** | Copie l'autorité locale dans la ConfigMap `pme-ca` du namespace applicatif, pour que les clients vérifient le certificat de PostgreSQL. Lancé par `deploy`. |
| **`make metrics-server`** | Active l'addon metrics-server et attend qu'il soit disponible. Indispensable à l'autoscaling. |
| **`make hpa`** | Suit en continu l'autoscaling : charge actuelle, cible et nombre de pods. `Ctrl+C` pour quitter. |
| **`make tunnel`** | Redirige les ports 80 et 443 vers l'ingress (`sudo` demandé) et reste au premier plan. Utile pour un cluster créé sans publication des ports. Ne pas lancer avec `port-forward`. |
| **`make hosts`** | Affiche la ligne à ajouter à `/etc/hosts` pour les noms en `.localhost` (application, Keycloak, Adminer, Grafana, Prometheus, Alloy et `garage.localhost` pour les photos), sans rien écrire. |

### Vérifications du maillage, du réseau et de l'ingress

| Commande | Description |
|---|---|
| **`make mesh-check`** | Vérifie le mTLS : un pod hors du maillage doit être refusé, puis affiche les derniers échanges vus par ztunnel avec leurs identités. |
| **`make authz-check`** | Vérifie les autorisations d'Istio avec trois pods temporaires. Attendu : l'identité `default` vers Keycloak est refusée, `pme-api` vers Keycloak passe, `pme-api` vers Prometheus est refusée. |
| **`make jwt-check`** | Vérifie la validation des jetons par Traefik avec des pods temporaires. Attendu : sans jeton ou avec un jeton invalide, `/api/v1` répond 401 ; le site reste accessible (200). |
| **`make smoke`** | Test de fumée de la plateforme déployée (`scripts/smoke.sh`), une ligne OK ou KO par contrôle, code de sortie 1 au moindre échec. Il vérifie : les douze déploiements disponibles ; chaque compte PostgreSQL ouvre sa base et seulement elle (mauvais mot de passe et connexion sans TLS refusés) ; les données de base (tables, listes de référence, flux NATS `LISTINGS`, bucket des photos) ; l'ingress vu par un visiteur anonyme (site public, Keycloak joignable, `/api/v1` et la modération fermées en 401, HTTP redirigé vers HTTPS) ; enfin une **image aléatoire** générée dans le pod de l'API, envoyée dans Garage, relue, lue par URL signée à travers Traefik puis supprimée (`scripts/smoke-photo.js`). Aucune donnée n'est conservée et aucune connexion Keycloak n'est nécessaire. |
| **`make netpol-check`** | Vérifie les politiques réseau de Calico avec deux pods temporaires. Attendu : avec l'étiquette prévue, Keycloak répond ; sans elle, la connexion est coupée. |

### Secrets

| Commande | Description |
|---|---|
| **`make kubeseal`** | Installe l'outil `kubeseal` à la bonne version s'il est absent (Linux, `sudo` demandé). Requis par `seal`. |
| **`make sealed-secrets`** | Installe le contrôleur Sealed Secrets dans `kube-system`, une fois par cluster, à la même version que `kubeseal`. |
| **`make sealed-prereqs`** | Contrôle préalable de `seal` : `kubeseal` à la bonne version, les seize variables de `.env` renseignées (aucun `CHANGE_ME` : administration de la base, NATS, Keycloak, Grafana, les quatre mots de passe des comptes PostgreSQL de service et les quatre secrets de Garage), contrôleur installé (il l'installe sinon). |
| **`make seal`** | Génère les secrets de Garage s'ils manquent (`garage-secrets`), puis chiffre `.env` dans `k8s/01-pme-secrets-sealed.yaml` (`seal-now`), à versionner dans Git. Les deux étapes sont des appels séparés : `make` ne lit `.env` qu'une fois, au démarrage. À relancer après un changement de secret ou sur un nouveau cluster. |

### Images et déploiement

| Commande | Description |
|---|---|
| **`make image`** | Construit les trois images (API, modération, interface) et les charge dans Minikube. |
| **`make image-api`** | Construit `pme-api:dev` avec le Docker de l'ordinateur, puis la charge dans Minikube. |
| **`make image-moderation`** | Même chose pour `pme-moderation:dev`. |
| **`make image-frontend`** | Construit `pme-frontend:dev` directement dans Minikube. |
| **`make deploy`** | Génère le fichier de secrets chiffrés s'il manque, copie l'autorité locale, vérifie la présence de Sealed Secrets, cert-manager et Traefik, lance `kubectl apply -k k8s/`, puis `garage-init`. |
| **`make garage-secrets`** | Génère dans `.env` les quatre secrets de [Garage](outils/garage.md) (clé d'accès, secret, secret RPC, jeton d'administration) s'ils manquent ou valent `CHANGE_ME`. Appelé par `make seal`. Une valeur déjà présente n'est jamais modifiée. |
| **`make db-secrets`** | Génère dans `.env` les mots de passe des quatre comptes PostgreSQL de service (API, modération, Keycloak, Grafana) s'ils manquent ou valent `CHANGE_ME`. Appelé par `make seal`. Une valeur déjà présente n'est jamais modifiée. |
| **`make garage-init`** | Mise en service du [stockage des photos](outils/garage.md) : disposition des données, bucket `pme-photos` et clé d'accès de l'API. Lancé par `make deploy` (donc aussi par `make reset`, dont le volume repart vide) ; peut se lancer seul. Sans effet si tout est déjà en place. |
| **`make redeploy`** | `image`, puis redémarrage des trois déploiements applicatifs et attente de leur disponibilité. À lancer après une modification du code. |
| **`make restart`** | Redémarre les trois déploiements applicatifs sans reconstruire les images. |
| **`make undeploy`** | Supprime le namespace applicatif, données comprises, puis attend ses volumes. Ceux que Minikube laisse en état `Released`, avec leurs données, sont supprimés, ainsi que leur dossier dans la machine Minikube. |
| **`make reset`** | `undeploy`, puis `deploy` : repart d'un namespace vide. |

### Observation

| Commande | Description |
|---|---|
| **`make pods`** | Affiche les pods du namespace applicatif et leur état. |
| **`make logs`** | Synonyme de `logs-moderation`. |
| **`make logs-api`** | Suit en continu les logs de l'API (100 dernières lignes, puis le flux). |
| **`make logs-moderation`** | Suit en continu les logs du service de modération. |
| **`make logs-keycloak`** | Suit en continu les logs de Keycloak. |
| **`make queues`** | Affiche l'état des flux NATS JetStream : messages en attente et consommateurs connectés. |
| **`make db-listings`** | Affiche les annonces en base (identifiant, propriétaire, titre, statut, date), les plus récentes d'abord. |
| **`make db-moderation`** | Affiche la file de modération en base, par ordre de réception. |

### Démonstration

| Commande | Description |
|---|---|
| **`make demo-stop-moderation`** | Arrête le service de modération. Les messages publiés restent dans NATS. |
| **`make demo-start-moderation`** | Le relance : la file d'attente se vide. |
| **`make demo-kill-api`** | Supprime le pod de l'API et suit sa recréation par Kubernetes. |
| **`make seed-listings SEED_USER=<identifiant>`** | Crée des annonces de démonstration **publiées** pour un utilisateur Keycloak (`scripts/seed-listings.sh`) : `COUNT` annonces (6 par défaut), chacune avec une **image aléatoire** générée dans le pod de l'API et envoyée dans Garage. L'API ne sait créer que des annonces en attente (la décision de modération est hors périmètre du POC) : les annonces sont donc insérées directement en base avec le statut `PUBLISHED`. Rien ne les distingue à l'écran : `seed-listings-clean` les retrouve par leur photo, rangée sous `published/` (l'API ne range les photos que sous `pending/`). L'identifiant doit exister dans le realm `pme`, sinon la commande liste les utilisateurs existants. |
| **`make seed-listings-clean SEED_USER=<identifiant>`** | Supprime les annonces de démonstration de cet utilisateur (les annonces publiées dont la photo est sous `published/`) et leurs images dans Garage. |

### Développement local

| Commande | Description |
|---|---|
| **`make install`** | Installe les dépendances : `npm ci` à la racine (API, modération, module commun), puis dans `frontend`. |
| **`make port-forward`** | Redirige vers l'ordinateur NATS (ports 8222 et 4222), PostgreSQL (5432) et, si le port 80 n'est pas déjà joignable, l'ingress (`sudo` demandé). Les redirections tournent en arrière-plan et se relancent seules. |
| **`make stop-forward`** | Arrête toutes les redirections lancées par `port-forward`. |
| **`make api`** | Lance l'API en mode développement sur l'ordinateur, reliée à PostgreSQL, NATS et Keycloak du cluster. Écrit d'abord `pme-ca.crt` ; exige `port-forward`. |
| **`make moderation`** | Même chose pour le service de modération. |
| **`make frontend`** | Lance l'interface avec le serveur de développement Vite. |

### Qualité du code

| Commande | Description |
|---|---|
| **`make lint`** | ESLint (règles, complexité cyclomatique et cognitive) et typage strict, sur le module commun, l'API, la modération et l'interface. |
| **`make format`** | Corrige la mise en forme avec Prettier sur les quatre modules, les scénarios `tests/` et les scripts de `k8s/config/`. |
| **`make format-check`** | Vérifie cette mise en forme sans rien modifier. |
| **`make lint-yaml`** | Contrôle les fichiers YAML (manifestes, tests d'images, pipeline) avec yamllint. |
| **`make lint-docker`** | Contrôle les quatre Dockerfile (API, modération, interface, documentation) avec hadolint. |
| **`make lint-k8s`** | Valide les manifestes rendus par Kustomize avec kubeconform, en mode strict. |
| **`make secrets-scan`** | Cherche des secrets committés avec gitleaks. |
| **`make audit`** | `npm audit` sur l'API, la modération et l'interface. Échoue sur une dépendance CRITICAL, les HIGH sont seulement remontées. |
| **`make coverage`** | Lance les tests unitaires avec rapports de couverture et seuils minimaux. |
| **`make sonar`** | Lance l'analyse SonarCloud depuis l'ordinateur (facultatif, la pipeline le fait). Exige `sonar-scanner`, `SONAR_TOKEN` et `SONAR_HOST_URL`, après `make coverage`. |
| **`make quality`** | Enchaîne tout le contrôle statique : `lint`, `format-check`, `lint-yaml`, `lint-docker`, `lint-k8s`, `secrets-scan` et `audit`. Ni Docker ni cluster requis. |

### Tests

| Commande | Description |
|---|---|
| **`make test`** | Tests unitaires : Jest pour le module commun, l'API et la modération, Vitest pour l'interface. |
| **`make test-integration`** | Tests d'intégration de l'API et de la modération, avec PostgreSQL et NATS réels dans des conteneurs jetables. Docker requis. |
| **`make test-perf`** | Test de charge k6, profil « ci » : PostgreSQL et NATS jetables, API réelle, mêmes seuils que la pipeline. Docker et k6 requis. |
| **`make image-test`** | Teste les trois images : structure avec container-structure-test, puis failles HIGH et CRITICAL avec Trivy. Images construites au préalable (`make image`). |

### Documentation

| Commande | Description |
|---|---|
| **`make docs-serve`** | Sert la documentation avec rechargement automatique sur `http://localhost:8005` et ouvre le navigateur. Docker requis. |
| **`make docs-check`** | Construit le site en mode strict : un lien cassé ou une page hors menu fait échouer la commande. |
| **`make docs-image`** | Construit l'image `pme-docs:dev` (site statique servi par nginx, sans droits administrateur). |
| **`make docs-run`** | Sert cette image sur `http://localhost:8083` et ouvre le navigateur. |
| **`make docs-stop`** | Arrête les conteneurs lancés par `docs-serve` et `docs-run`. |

### Ouvrir dans le navigateur

| Commande | Description |
|---|---|
| **`make app`** | Ouvre l'application (`https://pme.localhost`). |
| **`make keycloak`** | Ouvre Keycloak. |
| **`make nats`** | Ouvre la page de supervision de NATS (flux et consommateurs). Exige `make port-forward`. |
| **`make adminer`** | Ouvre Adminer, l'interface d'administration de PostgreSQL. |
| **`make prometheus`** | Ouvre la page des cibles de Prometheus. |
| **`make grafana`** | Ouvre Grafana. |
| **`make alloy`** | Ouvre l'interface d'Alloy, le collecteur de logs. |

Si aucun navigateur ne peut être lancé, chaque commande affiche l'adresse à ouvrir à la main.

!!! warning "Attention"
    `make undeploy` et `make reset` suppriment le namespace applicatif, donc les données de PostgreSQL, les messages de
    NATS et les photos de Garage. Il n'y a aucune confirmation. Les secrets chiffrés, eux, sont conservés dans Git.
    Les volumes sont des dossiers de la machine Minikube : Minikube peut les laisser en état `Released` après la suppression
    du namespace, et PostgreSQL redémarrerait alors sur ses anciennes données, sans recréer ses comptes. `make undeploy`
    supprime ces volumes restants et leur dossier avant de rendre la main.

!!! tip "Astuce"
    Pour voir ce qu'une commande exécuterait sans la lancer, ajouter `-n` : `make -n deploy` affiche les commandes
    sous-jacentes sans les exécuter. Les commandes `make coverage`, `make quality` et `make test-integration` se lancent
    l'une après l'autre : chacune s'arrête à la première erreur.

## Variables modifiables

Elles se règlent en ligne de commande (`make minikube-up MINIKUBE_MEMORY=8192`) ou dans l'environnement. Seules les
valeurs ci-dessous sont prévues pour cela.

| Variable | Valeur par défaut | Rôle |
|---|---|---|
| **`NS`** | `pme` | Namespace visé par les commandes `kubectl`. Il n'est pas transmis aux manifestes : le namespace y est fixé. |
| **`MINIKUBE_MEMORY`** | `5120` | Mémoire de Minikube, en Mo. Prise en compte à la création du cluster. |
| **`MINIKUBE_CPUS`** | `2` | Processeurs de Minikube. Prise en compte à la création du cluster. |
| **`CERT_MANAGER_VERSION`** | `v1.18.2` | Version de cert-manager installée par `make cert-manager`. |
| **`TRAEFIK_CHART_VERSION`** | `41.3.0` | Version du chart Helm de Traefik. |
| **`TRAEFIK_NS`** | `traefik` | Namespace de Traefik. |
| **`HELM_VERSION`** | `v4.3.0` | Version de Helm installée par `make helm`. |
| **`ISTIO_VERSION`** | `1.30.0` | Version des quatre charts d'Istio. |
| **`KUBESEAL_VERSION`** | `0.41.2` | Version de `kubeseal` et du contrôleur Sealed Secrets, qui doivent rester identiques. |
| **`INOTIFY_INSTANCES`** | `1024` | Limite `inotify` visée par `make inotify`. |
| **`CA_FILE`** | `pme-ca.crt` | Fichier où `make ca-cert` écrit l'autorité locale. |
| **`APP_HOST`**, **`KEYCLOAK_HOST`**, **`ADMINER_HOST`**, **`GRAFANA_HOST`**, **`PROMETHEUS_HOST`**, **`ALLOY_HOST`**, **`GARAGE_HOST`** | `pme`, `keycloak`, `adminer`, `grafana`, `prometheus`, `alloy`, `garage`, suivis de `.localhost` | Noms d'hôte des interfaces. Ils sont aussi écrits dans les manifestes : les changer ici ne suffit pas. |
| **`SEED_USER`**, **`COUNT`** | aucune, `6` | Utilisateur propriétaire et nombre d'annonces pour `make seed-listings`. |
| **`NATS_MONITOR_PORT`** | `8222` | Port local de la supervision de NATS. |
| **`DOCS_PORT`** | `8005` | Port de `make docs-serve`. |
| **`DOCS_IMAGE_PORT`** | `8083` | Port de `make docs-run`. |
| **`PERF_DB_PORT`**, **`PERF_NATS_PORT`**, **`PERF_API_PORT`**, **`PERF_IDP_PORT`** | `55432`, `54222`, `3100`, `9099` | Ports locaux de `make test-perf` : PostgreSQL, NATS, API et faux Keycloak. |

## Fichiers et dossiers principaux

| Fichier ou dossier | Description |
|---|---|
| **`Makefile`** | Définit toutes les commandes, leurs variables et leurs commentaires. |
| **`.env`** | Mots de passe lus par `make seal`, `make api` et `make moderation`. Créé par `make env`, jamais versionné. |
| **`env.example`** | Modèle de `.env`, avec des valeurs de démonstration. |
| **`scripts/`** | Scripts appelés par les commandes, par exemple `perf-ci.sh` pour `make test-perf`. |
| **`k8s/`** | Manifestes appliqués par `make deploy`. |

## Pour aller plus loin

- [Minikube](outils/minikube.md), pour le cluster et son démarrage
- [Sealed Secrets](outils/sealed-secrets.md), pour `make seal` et le fichier `.env`
- [GitLab CI](outils/gitlab-ci.md), pour les jobs que `make quality` et `make test` reproduisent
- [k6](outils/k6.md), pour `make test-perf`
- [MkDocs](outils/mkdocs.md), pour les commandes `docs-*`
- [Documentation de GNU Make](https://www.gnu.org/software/make/manual/make.html)
