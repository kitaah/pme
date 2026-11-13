# Commandes `make`

## Fiche d'identité

| Information | Détail |
|---|---|
| **Rôle** | Point d'entrée unique de toutes les opérations du projet : cluster, secrets, déploiement, observation, développement, qualité, tests et documentation |
| **Fichier** | `Makefile`, à la racine du dépôt |
| **Nombre de commandes** | 78 cibles, regroupées en douze thèmes ci-dessous |
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
Au premier démarrage : `make minikube-up`, import de l'autorité locale dans le navigateur, puis `make deploy`. Après une
modification du code : `make redeploy`. Pour repartir de zéro : `make reset`.

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
- Il regroupe les vérifications de sécurité (`make mesh-check`, `make authz-check`, `make netpol-check`) qui prouvent le
  chiffrement et le cloisonnement du cluster.
- Il donne des raccourcis de lecture (`make pods`, `make queues`, `make db-listings`) qui évitent d'ouvrir un outil complet.

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
| **`make ingress`** | Désactive l'ingress de Minikube, installe Traefik par son chart Helm (version épinglée) et attend qu'il soit prêt. |
| **`make inotify`** | Relève la limite `inotify` du noyau (1024 instances par défaut, `sudo` demandé) et la rend permanente. Linux uniquement, sans effet si la limite suffit. Requis par ztunnel, lancé par `istio`. |
| **`make istio`** | Installe Istio en mode ambient (quatre charts Helm : base, istiod, cni, ztunnel) et enrôle le namespace de Traefik dans le maillage. Exige `make ingress` d'abord. |
| **`make istio-scan`** | Analyse avec Trivy les trois images d'Istio. Échoue sur une faille CRITICAL corrigeable, signale les HIGH à titre d'information. |
| **`make cert-manager`** | Installe cert-manager, crée l'autorité locale et attend que son certificat soit prêt. |
| **`make ca-cert`** | Écrit l'autorité locale dans `pme-ca.crt`, à importer une fois dans le navigateur. À refaire après la recréation du cluster. |
| **`make ca-configmap`** | Copie l'autorité locale dans la ConfigMap `pme-ca` du namespace applicatif, pour que les clients vérifient le certificat de PostgreSQL. Lancé par `deploy`. |
| **`make metrics-server`** | Active l'addon metrics-server et attend qu'il soit disponible. Indispensable à l'autoscaling. |
| **`make hpa`** | Suit en continu l'autoscaling : charge actuelle, cible et nombre de pods. `Ctrl+C` pour quitter. |
| **`make tunnel`** | Redirige les ports 80 et 443 vers l'ingress (`sudo` demandé) et reste au premier plan. Utile pour un cluster créé sans publication des ports. Ne pas lancer avec `port-forward`. |
| **`make hosts`** | Affiche la ligne à ajouter à `/etc/hosts` pour les noms en `.localhost`, sans rien écrire. |

### Vérifications du maillage et du réseau

| Commande | Description |
|---|---|
| **`make mesh-check`** | Vérifie le mTLS : un pod hors du maillage doit être refusé, puis affiche les derniers échanges vus par ztunnel avec leurs identités. |
| **`make authz-check`** | Vérifie les autorisations d'Istio avec trois pods temporaires. Attendu : l'identité `default` vers Keycloak est refusée, `pme-api` vers Keycloak passe, `pme-api` vers Prometheus est refusée. |
| **`make netpol-check`** | Vérifie les politiques réseau de Calico avec deux pods temporaires. Attendu : avec l'étiquette prévue, Keycloak répond ; sans elle, la connexion est coupée. |

### Secrets

| Commande | Description |
|---|---|
| **`make kubeseal`** | Installe l'outil `kubeseal` à la bonne version s'il est absent (Linux, `sudo` demandé). Requis par `seal`. |
| **`make sealed-secrets`** | Installe le contrôleur Sealed Secrets dans `kube-system`, une fois par cluster, à la même version que `kubeseal`. |
| **`make sealed-prereqs`** | Contrôle préalable de `seal` : `kubeseal` à la bonne version, les huit variables de `.env` renseignées (aucun `CHANGE_ME`), contrôleur installé (il l'installe sinon). |
| **`make seal`** | Chiffre `.env` dans `k8s/14-pme-secrets-sealed.yaml`, à versionner dans Git. À relancer après un changement de secret ou sur un nouveau cluster. |

### Images et déploiement

| Commande | Description |
|---|---|
| **`make image`** | Construit les trois images (API, modération, interface) et les charge dans Minikube. |
| **`make image-api`** | Construit `pme-api:dev` avec le Docker de l'ordinateur, puis la charge dans Minikube. |
| **`make image-moderation`** | Même chose pour `pme-moderation:dev`. |
| **`make image-frontend`** | Construit `pme-frontend:dev` directement dans Minikube. |
| **`make deploy`** | Génère le fichier de secrets chiffrés s'il manque, copie l'autorité locale, vérifie la présence de Sealed Secrets, cert-manager et Traefik, puis lance `kubectl apply -k k8s/`. |
| **`make redeploy`** | `image`, puis redémarrage des trois déploiements applicatifs et attente de leur disponibilité. À lancer après une modification du code. |
| **`make restart`** | Redémarre les trois déploiements applicatifs sans reconstruire les images. |
| **`make undeploy`** | Supprime le namespace applicatif, données comprises, et attend que la suppression soit terminée. |
| **`make reset`** | `undeploy`, puis `deploy` : repart d'un namespace vide. |
| **`make create-grafana-db`** | Crée la base `grafana` dans un PostgreSQL déjà initialisé. Sans effet si elle existe. |

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

!!! note "À savoir"
    Le `Makefile` crée aussi deux fichiers qui ne sont pas des commandes : `.env`, produit à la demande depuis
    `env.example`, et `k8s/14-pme-secrets-sealed.yaml`, généré par `make deploy` s'il manque. Une fois présents, ils ne
    sont jamais réécrits tout seuls : après un changement de mot de passe, c'est `make seal` qui les met à jour.

!!! warning "Attention"
    `make undeploy` et `make reset` suppriment le namespace applicatif, donc les données de PostgreSQL et les messages de
    NATS. Il n'y a aucune confirmation. Les secrets chiffrés, eux, sont conservés dans Git.

!!! tip "Astuce"
    Pour voir ce qu'une commande exécuterait sans la lancer, ajouter `-n` : `make -n deploy` affiche les commandes
    sous-jacentes sans les exécuter.

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
| **`APP_HOST`**, **`KEYCLOAK_HOST`**, **`ADMINER_HOST`**, **`GRAFANA_HOST`**, **`PROMETHEUS_HOST`**, **`ALLOY_HOST`** | `pme`, `keycloak`, `adminer`, `grafana`, `prometheus`, `alloy`, suivis de `.localhost` | Noms d'hôte des interfaces. Ils sont aussi écrits dans les manifestes : les changer ici ne suffit pas. |
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
