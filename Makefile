# ---- Makefile ----
# Reprend l'organisation du Makefile du projet Spring (minikube-up, deploy, redeploy, port-forward, logs...)
# adaptee a la nouvelle pile : React / NestJS / NATS / Keycloak / PostgreSQL sur Minikube.

.PHONY: help install test test-integration image-test \
        lint format format-check lint-yaml lint-docker lint-k8s secrets-scan audit coverage sonar quality \
        perf perf-prepare perf-reset perf-load perf-decoupling \
        minikube-up minikube-down ingress cert-manager ca-cert metrics-server hpa tunnel hosts \
        secrets image image-api image-moderation image-frontend deploy redeploy restart undeploy reset \
        pods logs logs-api logs-moderation logs-keycloak \
        port-forward stop-forward api moderation frontend \
        smoke token queues db-listings db-moderation create-grafana-db \
        demo-stop-moderation demo-start-moderation demo-kill-api \
        app keycloak nats adminer prometheus grafana \
        docs-serve docs-check docs-image docs-run docs-stop docs-image-test

# NS sert aux commandes kubectl. Il n'est PAS propage aux manifestes : le namespace est
# fixe dans k8s/kustomization.yaml (voir README, "Limites connues").
NS ?= pme
MINIKUBE_MEMORY ?= 4096
MINIKUBE_CPUS ?= 2
CERT_MANAGER_VERSION ?= v1.18.2
CA_FILE ?= pme-ca.crt

# Les interfaces web passent par l'ingress en HTTPS (certificat cert-manager signe par ufeat(k8s): ajouter l'autoscaling, le budget de disponibilité et la collecte des métriques par podne autorite locale), sous des
# noms d'hote .localhost (contexte securise pour les navigateurs : requis par keycloak-js).
# Pour les joindre depuis l'ordinateur : "make tunnel" (redirige les ports 80 et 443 vers l'ingress), puis la ligne /etc/hosts de "make hosts".
# Le navigateur doit faire confiance a l'autorite locale : "make ca-cert" ecrit pme-ca.crt, a importer une fois.
# Ces noms sont aussi ecrits dans k8s/08-ingress.yaml, k8s/03-keycloak.yaml (hostname-url), k8s/04-api.yaml et
# k8s/05-moderation.yaml (emetteur), k8s/10-grafana.yaml, k8s/config/realm-pme.json (URL de retour), k8s/08-certificate.yaml et
# k8s/config/frontend-config.js : les changer ici ne suffit pas.
# NATS et PostgreSQL restent joints par "kubectl port-forward" (voir make port-forward, qui lance aussi l'ingress).
APP_HOST ?= pme.localhost
KEYCLOAK_HOST ?= keycloak.localhost
ADMINER_HOST ?= adminer.localhost
GRAFANA_HOST ?= grafana.localhost
PROMETHEUS_HOST ?= prometheus.localhost
NATS_MONITOR_PORT ?= 8222
DOCS_PORT ?= 8005
DOCS_IMAGE_PORT ?= 8083
DOCS_URL := http://localhost:$(DOCS_PORT)
DOCS_IMAGE_URL := http://localhost:$(DOCS_IMAGE_PORT)

APP_URL := https://$(APP_HOST)
KEYCLOAK_URL := https://$(KEYCLOAK_HOST)
NATS_URL := http://localhost:$(NATS_MONITOR_PORT)
ADMINER_URL := https://$(ADMINER_HOST)
PROMETHEUS_URL := https://$(PROMETHEUS_HOST)
GRAFANA_URL := https://$(GRAFANA_HOST)
HOSTS := $(APP_HOST) $(KEYCLOAK_HOST) $(ADMINER_HOST) $(GRAFANA_HOST) $(PROMETHEUS_HOST)

# Charge .env s'il existe (POSTGRES_*, NATS_*, KEYCLOAK_ADMIN*)
-include .env
export

help:
	@echo "Commandes disponibles :"
	@echo ""
	@echo "  Cluster"
	@echo "    make minikube-up              - Demarre Minikube"
	@echo "    make minikube-down            - Arrete Minikube"
	@echo "    make ingress                  - Active l'ingress (addon Minikube) et attend qu'il soit pret"
	@echo "    make cert-manager             - Installe cert-manager et l'autorite locale (certificats TLS)"
	@echo "    make metrics-server           - Active metrics-server (addon Minikube), requis par l'autoscaling"
	@echo "    make hpa                      - Suit l'autoscaling : charge, cible et nombre de pods"
	@echo "    make ca-cert                  - Ecrit l'autorite locale dans $(CA_FILE), a importer dans le navigateur"
	@echo "    make tunnel                   - Redirige les ports 80 et 443 vers l'ingress (cluster cree sans --ports ; laisser ouvert, mot de passe demande)"
	@echo "    make hosts                    - Affiche la ligne a ajouter dans /etc/hosts pour les noms .localhost"
	@echo ""
	@echo "  Deploiement"
	@echo "    make secrets                  - Cree le Secret pme-secrets depuis .env"
	@echo "    make image                    - Construit les 3 images dans Minikube"
	@echo "    make deploy                   - secrets + kubectl apply -k k8s/ (Postgres, NATS, Keycloak, API, moderation, front, ingress)"
	@echo "    make redeploy                 - image + redemarrage des 3 deployments (apres une modification du code)"
	@echo "    make undeploy                 - Supprime le namespace (donnees comprises)"
	@echo "    make create-grafana-db        - Cree la base grafana dans un PostgreSQL existant (make reset la cree d'office)"
	@echo ""
	@echo "  Observation"
	@echo "    make pods | logs-api | logs-moderation | logs-keycloak"
	@echo "    make queues                   - Flux NATS : messages en attente / consommateurs"
	@echo "    make db-listings              - Annonces en base (API)"
	@echo "    make db-moderation            - File de moderation en base (service de moderation)"
	@echo ""
	@echo "  Demonstration"
	@echo "    make smoke                    - Scenario complet en ligne de commande (connexion, depot, 400, 403, file)"
	@echo "    make token KC_USER=membre       - Affiche un jeton Keycloak de test"
	@echo "    make demo-stop-moderation     - Arrete le service de moderation (les messages restent dans NATS)"
	@echo "    make demo-start-moderation    - Le relance : la file se vide"
	@echo "    make demo-kill-api            - Supprime le pod de l'API : Kubernetes le recree"
	@echo ""
	@echo "  Developpement local"
	@echo "    make install                  - npm ci dans api, moderation-service, frontend"
	@echo "    make port-forward             - Pour developper : NATS :8222 et :4222, Postgres :5432 -> localhost, et l'ingress sur le port 80 s'il n'y est pas deja"
	@echo "    make api | moderation | frontend"
	@echo ""
	@echo "  Tests"
	@echo "    make test                     - Tests unitaires (Jest : api + moderation-service, Vitest : frontend)"
	@echo "    make test-integration         - Tests d'integration avec PostgreSQL et NATS reels (Testcontainers, Docker requis)"
	@echo "    make image-test               - Tests des images Docker (container-structure-test + Trivy)"
	@echo "    make perf                     - Tests de performance k6 (charge + decouplage), apres make perf-prepare"
	@echo ""
	@echo "  Documentation (MkDocs, Docker requis)"
	@echo "    make docs-serve               - Apercu en direct : http://localhost:$(DOCS_PORT) (ouvre le navigateur)"
	@echo "    make docs-check               - Construction stricte (lien casse ou page hors menu = echec)"
	@echo "    make docs-image               - Image pme-docs:dev (site statique, nginx non-root)"
	@echo "    make docs-run                 - Sert l'image : http://localhost:$(DOCS_IMAGE_PORT) (ouvre le navigateur)"
	@echo "    make docs-stop                - Arrete l'apercu et le site servis par docs-serve et docs-run"
	@echo "    make docs-image-test          - Tests de l'image (container-structure-test + Trivy)"
	@echo ""
	@echo "  Ouvrir : make app | keycloak | nats | adminer | prometheus | grafana"

# ---- Cluster Minikube ----

# --ports publie les ports 80 et 443 du noeud (ou ecoute l'ingress) sur 127.0.0.1 de l'ordinateur : l'ingress est
# alors joignable sans "make tunnel" ni redirection. Option prise en compte a la CREATION du cluster seulement :
# sur un cluster existant, il faut "minikube delete" puis "make minikube-up" (les deploiements sont perdus).
# Le port 443 sert le HTTPS (cert-manager).
minikube-up:
	minikube start --driver=docker --memory=$(MINIKUBE_MEMORY) --cpus=$(MINIKUBE_CPUS) \
		--ports=127.0.0.1:80:80,127.0.0.1:443:443
	$(MAKE) ingress
	$(MAKE) cert-manager
	$(MAKE) ca-cert
	$(MAKE) metrics-server
	@echo "Importer $(CA_FILE) dans le navigateur (voir docs/outils/cert-manager.md), puis : make deploy"

minikube-down:
	minikube stop

# Ingress-nginx (addon Minikube). On attend le controleur : un "make deploy" lance trop tot echoue sur
# le webhook d'admission, qui n'est pas encore pret.
# Le patch ajoute la compression gzip des reponses a la ConfigMap du controleur (desactivee par defaut). Un patch
# et non un `kubectl apply` : la ConfigMap vient de l'addon (elle contient deja hsts: "false"), le patch n'ajoute que ces cles.
ingress:
	minikube addons enable ingress
	kubectl -n ingress-nginx wait --for=condition=ready pod -l app.kubernetes.io/component=controller --timeout=180s
	kubectl -n ingress-nginx patch configmap ingress-nginx-controller --type merge -p '{"data":{"use-gzip":"true","gzip-min-length":"1024","gzip-level":"5"}}'

# metrics-server (addon Minikube) : fournit la charge des pods a l'autoscaler (k8s/11-autoscaling.yaml). Sans lui, la cible
# de chaque autoscaler reste <unknown> et le nombre de pods ne change jamais. Les premieres mesures arrivent apres ~1 minute.
metrics-server:
	minikube addons enable metrics-server
	kubectl -n kube-system wait --for=condition=available deployment/metrics-server --timeout=180s

# Etat de l'autoscaling : charge actuelle / cible, et nombre de pods. Ctrl+C pour quitter.
hpa:
	kubectl -n $(NS) get hpa -w

# cert-manager (certificats TLS) : installe une fois par cluster, puis cree l'autorite locale (k8s/cert-manager/issuers.yaml).
# Le webhook de cert-manager demarre apres ses pods : la creation des emetteurs est reessayee jusqu'a ce qu'il reponde.
# Sur un cluster existant, cette commande suffit : il n'est pas necessaire de le recreer.
cert-manager:
	kubectl apply -f https://github.com/cert-manager/cert-manager/releases/download/$(CERT_MANAGER_VERSION)/cert-manager.yaml
	kubectl -n cert-manager wait --for=condition=available deployment --all --timeout=180s
	@for i in $$(seq 1 20); do kubectl apply -f k8s/cert-manager/issuers.yaml && break; echo "En attente du webhook cert-manager"; sleep 3; done
	kubectl -n cert-manager wait --for=condition=ready certificate/pme-ca --timeout=60s

# Ecrit l'autorite locale dans pme-ca.crt (non versionne) : a importer dans le navigateur (Parametres > Certificats >
# Autorites) pour supprimer l'avertissement. curl, Node (make api) et make smoke s'en servent directement.
# Un cluster recree genere une nouvelle autorite : relancer cette commande et reimporter le fichier.
ca-cert:
	@kubectl -n cert-manager get secret pme-ca -o jsonpath='{.data.ca\.crt}' | base64 -d > $(CA_FILE)
	@echo "Autorite ecrite dans $(CA_FILE)"

# Les navigateurs envoient toujours un nom en .localhost vers 127.0.0.1, quelle que soit la ligne /etc/hosts
# (RFC 6761). L'ingress doit donc ecouter sur 127.0.0.1:80 et :443 : on y redirige les ports 80 et 443 du controleur.
# Ports 80 et 443 = ports privilegies, d'ou sudo (KUBECONFIG est transmis, sudo ne garde pas l'environnement).
# Laisser ce terminal ouvert. Fonctionne de la meme facon sous Linux, macOS et Windows.
# "make port-forward" lance la meme redirection en arriere-plan : ne pas lancer les deux (le port 80 serait pris).
INGRESS_FORWARD = kubectl -n ingress-nginx port-forward --address 127.0.0.1 svc/ingress-nginx-controller 80:80 443:443
tunnel:
	sudo env KUBECONFIG="$${KUBECONFIG:-$$HOME/.kube/config}" $(INGRESS_FORWARD)

# N'ecrit rien dans /etc/hosts : affiche la ligne a ajouter (une seule fois) avec un editeur ou "sudo tee -a".
# Les navigateurs n'en ont pas besoin pour .localhost ; curl, Node (make api, make smoke) peuvent en avoir besoin.
hosts:
	@echo "Ajouter cette ligne dans le fichier hosts de l'ordinateur (/etc/hosts sous Linux et macOS) :"
	@echo ""
	@echo "127.0.0.1 $(HOSTS)"

# ---- Build & deploiement ----

# Le Secret n'est pas versionne : il est cree depuis .env (valeurs de demonstration).
# Le projet Spring utilisait des Sealed Secrets : a reprendre quand le POC passera a la chaine CI/CD.
secrets:
	@test -f .env || (echo "Fichier .env absent : cp .env.example .env" && exit 1)
	@test -n '$(GRAFANA_ADMIN)' && test -n '$(GRAFANA_ADMIN_PASSWORD)' || (echo "GRAFANA_ADMIN et GRAFANA_ADMIN_PASSWORD absents de .env : voir .env.example" && exit 1)
	@kubectl create namespace $(NS) --dry-run=client -o yaml | kubectl apply -f -
	@kubectl -n $(NS) create secret generic pme-secrets \
		--from-literal=db-username='$(POSTGRES_USER)' \
		--from-literal=db-password='$(POSTGRES_PASSWORD)' \
		--from-literal=nats-username='$(NATS_USER)' \
		--from-literal=nats-password='$(NATS_PASSWORD)' \
		--from-literal=keycloak-admin-username='$(KEYCLOAK_ADMIN)' \
		--from-literal=keycloak-admin-password='$(KEYCLOAK_ADMIN_PASSWORD)' \
		--from-literal=grafana-admin-username='$(GRAFANA_ADMIN)' \
		--from-literal=grafana-admin-password='$(GRAFANA_ADMIN_PASSWORD)' \
		--dry-run=client -o yaml | kubectl apply -f -
	@echo "Secret pme-secrets cree dans le namespace $(NS) (valeurs lues dans .env, non affichees)"

image: image-api image-moderation image-frontend

image-api:
	minikube image build -t pme-api:dev ./api

image-moderation:
	minikube image build -t pme-moderation:dev ./moderation-service

image-frontend:
	minikube image build -t pme-frontend:dev ./frontend

deploy: secrets
	@kubectl get crd certificates.cert-manager.io >/dev/null 2>&1 || { echo "cert-manager est absent : lancer make cert-manager"; exit 1; }
	kubectl apply -k k8s/
	@echo "Deploiement lance. Suivre : make pods (Keycloak met ~1 min a demarrer)"

redeploy: image
	kubectl -n $(NS) rollout restart deployment pme-api pme-moderation pme-frontend
	kubectl -n $(NS) rollout status deployment pme-api pme-moderation pme-frontend

restart:
	kubectl -n $(NS) rollout restart deployment pme-api pme-moderation pme-frontend
	kubectl -n $(NS) rollout status deployment pme-api pme-moderation pme-frontend

# La suppression d'un namespace rend la main avant d'etre terminee : on attend explicitement,
# sinon "make reset" repart sur un namespace encore en cours de suppression et echoue.
undeploy:
	kubectl delete namespace $(NS) --ignore-not-found
	kubectl wait --for=delete namespace/$(NS) --timeout=180s 2>/dev/null || true

reset: undeploy deploy

# ---- Observation ----

pods:
	kubectl -n $(NS) get pods

logs: logs-moderation

logs-api:
	kubectl -n $(NS) logs -l app=pme-api --tail=100 -f

logs-moderation:
	kubectl -n $(NS) logs -l app=pme-moderation --tail=100 -f

logs-keycloak:
	kubectl -n $(NS) logs -l app=keycloak --tail=100 -f

# Etat des flux JetStream, lu sur le port de supervision de NATS (8222) :
# messages en attente (`messages`) et consommateurs connectes (`num_waiting`, `ack_floor`).
queues:
	@kubectl -n $(NS) exec deploy/nats -- wget -qO- 'http://localhost:8222/jsz?streams=1&consumers=1' \
		| python3 -m json.tool

# Cree la base `grafana` dans un PostgreSQL deja initialise : postgres-init.sh ne s'execute qu'une fois.
# Sans effet si la base existe deja.
create-grafana-db:
	kubectl -n $(NS) exec deploy/postgres -- sh -c "psql -U \"\$$POSTGRES_USER\" -d pme -tAc \"SELECT 1 FROM pg_database WHERE datname='grafana'\" | grep -q 1 || psql -U \"\$$POSTGRES_USER\" -d pme -c \"CREATE DATABASE grafana\""

db-listings:
	kubectl -n $(NS) exec deploy/postgres -- sh -c 'psql -U "$$POSTGRES_USER" -d pme -c "SELECT id, owner_username, title, status, created_at FROM listings ORDER BY created_at DESC"'

db-moderation:
	kubectl -n $(NS) exec deploy/postgres -- sh -c 'psql -U "$$POSTGRES_USER" -d moderation -c "SELECT listing_id, owner_username, title, status, received_at FROM moderation_queue ORDER BY received_at"'

# ---- Demonstration ----

smoke:
	APP_URL=$(APP_URL) KEYCLOAK_URL=$(KEYCLOAK_URL) ./scripts/smoke.sh

KC_USER ?= membre
token:
	@KEYCLOAK_URL=$(KEYCLOAK_URL) ./scripts/token.sh $(KC_USER)

demo-stop-moderation:
	kubectl -n $(NS) scale deployment pme-moderation --replicas=0

demo-start-moderation:
	kubectl -n $(NS) scale deployment pme-moderation --replicas=1

demo-kill-api:
	kubectl -n $(NS) delete pod -l app=pme-api
	kubectl -n $(NS) get pods -l app=pme-api -w

# ---- Developpement local (services lances sur la machine, infrastructure dans Minikube) ----

install:
	cd api && npm ci
	cd moderation-service && npm ci
	cd frontend && npm ci

# Tout ce qu'il faut pour developper sur l'ordinateur : NATS et PostgreSQL (qui n'ont pas d'ingress) et, si
# le port 80 n'est pas deja joignable, l'ingress (Keycloak et les interfaces web, comme "make tunnel").
# Un cluster cree par "make minikube-up" publie deja le port 80 : aucune redirection ni mot de passe.
# Sinon l'ingress demande le mot de passe administrateur (port 80) : "sudo -v" le demande ici, au premier plan,
# puis la boucle tourne en arriere-plan avec ces droits. Ne pas lancer "make tunnel" en meme temps.
# Chaque redirection se relance toute seule si elle tombe. Postgres et NATS (5432, 4222) servent a "make api"
# et "make moderation".
port-forward:
	@if curl -s -o /dev/null -m 2 http://127.0.0.1:80/; then \
		echo "Ingress deja joignable sur 127.0.0.1:80"; \
	else \
		sudo -v; \
		sudo env KUBECONFIG="$${KUBECONFIG:-$$HOME/.kube/config}" sh -c 'while true; do $(INGRESS_FORWARD); sleep 2; done' >/dev/null 2>&1 & \
	fi
	@( while true; do kubectl -n $(NS) port-forward svc/nats $(NATS_MONITOR_PORT):8222; sleep 2; done ) &
	@( while true; do kubectl -n $(NS) port-forward svc/postgres 5432:5432; sleep 2; done ) &
	@( while true; do kubectl -n $(NS) port-forward svc/nats 4222:4222; sleep 2; done ) &
	@sleep 2
	@echo "NATS          : $(NATS_URL)/jsz?streams=1&consumers=1"
	@echo "NATS (client) : localhost:4222 ; PostgreSQL : localhost:5432"
	@echo "Application   : $(APP_URL) (ingress sur 127.0.0.1:80 et :443, ligne /etc/hosts de 'make hosts' requise)"
	@echo "'make stop-forward' pour tout arreter."

stop-forward:
	@pkill -f "kubectl -n $(NS) port-forward" || true
	@if pgrep -f "kubectl -n ingress-nginx port-forward" >/dev/null; then sudo pkill -f "kubectl -n ingress-nginx port-forward"; fi
	@echo "Port-forwards arretes."

# En developpement local, les services tournent sur l'ordinateur mais lisent les cles de
# Keycloak par l'ingress (make port-forward le lance). L'emetteur attendu est le meme qu'en cluster, puisque
# --hostname-url le fige (voir k8s/03-keycloak.yaml).
DEV_KEYCLOAK_ENV = KEYCLOAK_ISSUER=$(KEYCLOAK_URL)/realms/pme \
	KEYCLOAK_JWKS_URI=$(KEYCLOAK_URL)/realms/pme/protocol/openid-connect/certs \
	KEYCLOAK_ALLOWED_CLIENTS=pme-web,pme-cli \
	NODE_EXTRA_CA_CERTS=$(CURDIR)/$(CA_FILE)

api: ca-cert
	@cd api && DB_HOST=localhost DB_NAME=pme DB_USER='$(POSTGRES_USER)' DB_PASSWORD='$(POSTGRES_PASSWORD)' \
		NATS_HOST=localhost NATS_USER='$(NATS_USER)' NATS_PASSWORD='$(NATS_PASSWORD)' \
		$(DEV_KEYCLOAK_ENV) npm run start:dev

moderation: ca-cert
	@cd moderation-service && DB_HOST=localhost DB_NAME=moderation DB_USER='$(POSTGRES_USER)' DB_PASSWORD='$(POSTGRES_PASSWORD)' \
		NATS_HOST=localhost NATS_USER='$(NATS_USER)' NATS_PASSWORD='$(NATS_PASSWORD)' \
		$(DEV_KEYCLOAK_ENV) npm run start:dev

frontend:
	cd frontend && npm run dev

# ---- Qualite logicielle (memes controles que l'etape "quality" de la chaine CI/CD) ----

# Lint du code TypeScript (ESLint : regles + complexite cyclomatique <= 10 et cognitive <= 15) puis typage strict (tsc)
lint:
	cd api && npm run lint
	cd moderation-service && npm run lint
	cd frontend && npm run lint

# Formatage (Prettier) : "make format" corrige, "make format-check" verifie seulement
# ROOT_PRETTIER : scenarios k6 et config du front, hors des trois applications.
# Il reutilise le Prettier installe dans frontend/ pour ne pas ajouter un package.json a la racine.
ROOT_PRETTIER := ./frontend/node_modules/.bin/prettier "tests/**/*.js" "k8s/config/*.js"

format:
	cd api && npm run format
	cd moderation-service && npm run format
	cd frontend && npm run format
	$(ROOT_PRETTIER) --write

format-check:
	cd api && npm run format:check
	cd moderation-service && npm run format:check
	cd frontend && npm run format:check
	$(ROOT_PRETTIER) --check

# Lint YAML (manifestes Kubernetes, tests d'image, pipeline) : pip install yamllint.
# Le realm Keycloak est un .json : il n'est pas couvert ici (voir README, "Limites connues").
lint-yaml:
	yamllint -c .yamllint.yml k8s tests .gitlab-ci.yml .yamllint.yml mkdocs.yml

# Lint Dockerfile : hadolint (binaire ou conteneur)
lint-docker:
	hadolint --config .hadolint.yaml api/Dockerfile moderation-service/Dockerfile frontend/Dockerfile Dockerfile.docs

# Validation des manifestes Kubernetes rendus par kustomize (schemas officiels)
lint-k8s:
	kustomize build k8s | kubeconform -strict -summary -ignore-missing-schemas -

# Secrets committes : gitleaks
secrets-scan:
	gitleaks detect --no-git --source . -c .gitleaks.toml --redact

# Dependances vulnerables : echec si CRITICAL (les HIGH sont remontes, traites au cas par cas)
audit:
	cd api && npm audit --omit=dev --audit-level=critical
	cd moderation-service && npm audit --omit=dev --audit-level=critical
	cd frontend && npm audit --omit=dev --audit-level=critical

# Couverture des tests unitaires (rapports lcov dans <module>/coverage, lus par Sonar) avec seuils minimaux
coverage:
	cd api && npm run test:cov
	cd moderation-service && npm run test:cov
	cd frontend && npm run test:cov

# Analyse SonarCloud depuis le poste (facultatif, la CI le fait) : sonar-scanner dans le PATH, apres "make coverage".
# Variables d'environnement : SONAR_TOKEN et SONAR_HOST_URL=https://sonarcloud.io
sonar:
	sonar-scanner

# Tout le controle statique, sans Docker ni cluster
quality: lint format-check lint-yaml lint-docker lint-k8s secrets-scan audit

# ---- Tests ----
# Strategie : voir README (types de tests, outils, place dans la chaine CI/CD)

# Unitaires : rapides, sans Docker, a chaque commit
test:
	cd api && npm test
	cd moderation-service && npm test
	cd frontend && npm test

# Integration : PostgreSQL et NATS reels dans des conteneurs jetables (Testcontainers), a chaque demande de fusion
test-integration:
	cd api && npm run test:integration
	cd moderation-service && npm run test:integration

# Images Docker : structure (utilisateur non-root, port, contenu) puis vulnerabilites HIGH/CRITICAL.
# Prerequis : container-structure-test et trivy installes, images construites (make image).
image-test:
	@eval $$(minikube docker-env) && \
	for svc in api moderation frontend; do \
		echo "== pme-$$svc:dev"; \
		container-structure-test test --image pme-$$svc:dev --config tests/image/$$svc.yaml || exit 1; \
		trivy image --severity HIGH,CRITICAL --ignore-unfixed --exit-code 1 pme-$$svc:dev || exit 1; \
	done

# ---- Documentation (MkDocs) ----
# Tout passe par Docker (Dockerfile.docs) : ni Python ni venv a installer sur le poste.
# docs-serve et docs-check utilisent l'etape "deps" (outillage seul) et montent le depot :
# l'apercu tourne meme si un lien est casse, pour pouvoir le corriger.
docs-serve:
	docker build -f Dockerfile.docs --target deps -t pme-docs-deps:dev .
	@( for i in $$(seq 1 90); do curl -s -o /dev/null "$(DOCS_URL)" && { xdg-open "$(DOCS_URL)" 2>/dev/null || open "$(DOCS_URL)" 2>/dev/null; break; }; sleep 1; done ) &
	docker run --rm -it -p $(DOCS_PORT):8000 -v "$(CURDIR)":/docs pme-docs-deps:dev mkdocs serve -a 0.0.0.0:8000

docs-check:
	docker build -f Dockerfile.docs --target deps -t pme-docs-deps:dev .
	docker run --rm -v "$(CURDIR)":/docs pme-docs-deps:dev mkdocs build --strict --site-dir /tmp/site

docs-image:
	docker build -f Dockerfile.docs -t pme-docs:dev .

docs-run:
	@echo "Documentation : http://localhost:$(DOCS_IMAGE_PORT) (Ctrl+C pour arreter)"
	@( for i in $$(seq 1 90); do curl -s -o /dev/null "$(DOCS_IMAGE_URL)" && { xdg-open "$(DOCS_IMAGE_URL)" 2>/dev/null || open "$(DOCS_IMAGE_URL)" 2>/dev/null; break; }; sleep 1; done ) &
	docker run --rm -p $(DOCS_IMAGE_PORT):8080 pme-docs:dev

# Arrete les conteneurs lances par docs-serve (pme-docs-deps:dev) et docs-run (pme-docs:dev).
# Ils sont lances avec --rm : ils disparaissent a l'arret.
docs-stop:
	@ids=$$(docker ps -q --filter ancestor=pme-docs-deps:dev --filter ancestor=pme-docs:dev); \
	if [ -n "$$ids" ]; then docker stop $$ids >/dev/null && echo "MkDocs arrete."; else echo "Aucun MkDocs en cours."; fi

docs-image-test:
	container-structure-test test --image pme-docs:dev --config tests/image/docs.yaml
	trivy image --severity HIGH,CRITICAL --ignore-unfixed --exit-code 1 pme-docs:dev

# Performance (k6) : sur le cluster deploye, apres le deploiement en recette.
# k6 ne lit pas l'autorite locale : la verification TLS est desactivee pour ces tests (cluster local uniquement).
export K6_INSECURE_SKIP_TLS_VERIFY := true
# k6 envoie tout depuis une seule IP : on releve la limitation de debit de l'API le temps du test.
perf-prepare:
	kubectl -n $(NS) set env deployment/pme-api THROTTLE_LIMIT=100000
	kubectl -n $(NS) rollout status deployment/pme-api

perf-reset:
	kubectl -n $(NS) set env deployment/pme-api THROTTLE_LIMIT=200
	kubectl -n $(NS) rollout status deployment/pme-api

perf-load:
	k6 run -e APP_URL=$(APP_URL) -e KEYCLOAK_URL=$(KEYCLOAK_URL) tests/performance/load.js

perf-decoupling:
	APP_URL=$(APP_URL) KEYCLOAK_URL=$(KEYCLOAK_URL) NS=$(NS) ./scripts/perf-decoupling.sh

perf: perf-load perf-decoupling

# ---- Ouvrir dans le navigateur ----

app:
	@xdg-open "$(APP_URL)" 2>/dev/null || open "$(APP_URL)" 2>/dev/null || echo "Ouvrir : $(APP_URL)"

keycloak:
	@xdg-open "$(KEYCLOAK_URL)" 2>/dev/null || open "$(KEYCLOAK_URL)" 2>/dev/null || echo "Ouvrir : $(KEYCLOAK_URL)"

nats:
	@xdg-open "$(NATS_URL)/jsz?streams=1&consumers=1" 2>/dev/null || open "$(NATS_URL)/jsz?streams=1&consumers=1" 2>/dev/null || echo "Ouvrir : $(NATS_URL)/jsz?streams=1&consumers=1"

adminer:
	@xdg-open "$(ADMINER_URL)" 2>/dev/null || open "$(ADMINER_URL)" 2>/dev/null || echo "Ouvrir : $(ADMINER_URL)"

prometheus:
	@xdg-open "$(PROMETHEUS_URL)/targets" 2>/dev/null || open "$(PROMETHEUS_URL)/targets" 2>/dev/null || echo "Ouvrir : $(PROMETHEUS_URL)/targets"

grafana:
	@xdg-open "$(GRAFANA_URL)" 2>/dev/null || open "$(GRAFANA_URL)" 2>/dev/null || echo "Ouvrir : $(GRAFANA_URL)"