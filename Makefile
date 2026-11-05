# ---- Makefile ----
# Reprend l'organisation du Makefile du projet Spring (minikube-up, deploy, redeploy, port-forward, logs...)
# adaptee a la nouvelle pile : React / NestJS / RabbitMQ / Keycloak / PostgreSQL sur Minikube.

.PHONY: help install test test-integration image-test \
        lint format format-check lint-yaml lint-docker lint-k8s secrets-scan audit coverage sonar quality \
        perf perf-prepare perf-reset perf-load perf-decoupling \
        minikube-up minikube-down \
        secrets image image-api image-moderation image-frontend deploy redeploy restart undeploy reset \
        pods logs logs-api logs-moderation logs-keycloak \
        port-forward stop-forward dev-api dev-moderation dev-frontend \
        smoke token queues db-listings db-moderation \
        demo-stop-moderation demo-start-moderation demo-kill-api \
        open-app open-keycloak open-rabbitmq open-adminer \
        docs-serve docs-check docs-image docs-run docs-image-test

# NS sert aux commandes kubectl. Il n'est PAS propage aux manifestes : le namespace est
# fixe dans k8s/kustomization.yaml (voir README, "Limites connues").
NS ?= pme
MINIKUBE_MEMORY ?= 4096
MINIKUBE_CPUS ?= 2

# Tout passe par "kubectl port-forward" en HTTP simple : ni ingress, ni certificat,
# ni entree dans /etc/hosts. Ces ports sont aussi ceux ecrits dans le realm Keycloak
# (URL de retour) et dans k8s/config/frontend-config.js : les changer ici ne suffit pas.
FRONT_PORT ?= 8080
KEYCLOAK_PORT ?= 8081
RABBITMQ_UI_PORT ?= 15672
ADMINER_PORT ?= 8082
DOCS_PORT ?= 8000
DOCS_IMAGE_PORT ?= 8083

APP_URL := http://localhost:$(FRONT_PORT)
KEYCLOAK_URL := http://localhost:$(KEYCLOAK_PORT)
RABBITMQ_URL := http://localhost:$(RABBITMQ_UI_PORT)
ADMINER_URL := http://localhost:$(ADMINER_PORT)

# Charge .env s'il existe (POSTGRES_*, RABBITMQ_*, KEYCLOAK_ADMIN*)
-include .env
export

help:
	@echo "Commandes disponibles :"
	@echo ""
	@echo "  Cluster"
	@echo "    make minikube-up              - Demarre Minikube"
	@echo "    make minikube-down            - Arrete Minikube"
	@echo ""
	@echo "  Deploiement"
	@echo "    make secrets                  - Cree le Secret pme-secrets depuis .env"
	@echo "    make image                    - Construit les 3 images dans Minikube"
	@echo "    make deploy                   - secrets + kubectl apply -k k8s/ (Postgres, RabbitMQ, Keycloak, API, moderation, front)"
	@echo "    make redeploy                 - image + redemarrage des 3 deployments (apres une modification du code)"
	@echo "    make undeploy                 - Supprime le namespace (donnees comprises)"
	@echo ""
	@echo "  Observation"
	@echo "    make pods | logs-api | logs-moderation | logs-keycloak"
	@echo "    make queues                   - Files RabbitMQ : messages en attente / consommateurs"
	@echo "    make db-listings              - Annonces en base (API)"
	@echo "    make db-moderation            - File de moderation en base (service de moderation)"
	@echo ""
	@echo "  Demonstration"
	@echo "    make smoke                    - Scenario complet en ligne de commande (connexion, depot, 400, 403, file)"
	@echo "    make token KC_USER=membre       - Affiche un jeton Keycloak de test"
	@echo "    make demo-stop-moderation     - Arrete le service de moderation (les messages restent dans RabbitMQ)"
	@echo "    make demo-start-moderation    - Le relance : la file se vide"
	@echo "    make demo-kill-api            - Supprime le pod de l'API : Kubernetes le recree"
	@echo ""
	@echo "  Developpement local"
	@echo "    make install                  - npm ci dans api, moderation-service, frontend"
	@echo "    make port-forward             - Postgres :5432, RabbitMQ :5672, Keycloak :8080 -> localhost"
	@echo "    make dev-api | dev-moderation | dev-frontend"
	@echo ""
	@echo "  Tests"
	@echo "    make test                     - Tests unitaires (Jest : api + moderation-service, Vitest : frontend)"
	@echo "    make test-integration         - Tests d'integration avec PostgreSQL et RabbitMQ reels (Testcontainers, Docker requis)"
	@echo "    make image-test               - Tests des images Docker (container-structure-test + Trivy)"
	@echo "    make perf                     - Tests de performance k6 (charge + decouplage), apres make perf-prepare"
	@echo ""
	@echo "  Documentation (MkDocs, Docker requis)"
	@echo "    make docs-serve               - Apercu en direct : http://localhost:$(DOCS_PORT)"
	@echo "    make docs-check               - Construction stricte (lien casse ou page hors menu = echec)"
	@echo "    make docs-image               - Image pme-docs:dev (site statique, nginx non-root)"
	@echo "    make docs-run                 - Sert l'image : http://localhost:$(DOCS_IMAGE_PORT)"
	@echo "    make docs-image-test          - Tests de l'image (container-structure-test + Trivy)"
	@echo ""
	@echo "  Ouvrir : make open-app | open-keycloak | open-rabbitmq | open-adminer"

# ---- Cluster Minikube ----

# Aucun addon ingress : tout est joint par "kubectl port-forward" (voir make port-forward).
minikube-up:
	minikube start --driver=docker --memory=$(MINIKUBE_MEMORY) --cpus=$(MINIKUBE_CPUS)

minikube-down:
	minikube stop

# ---- Build & deploiement ----

# Le Secret n'est pas versionne : il est cree depuis .env (valeurs de demonstration).
# Le projet Spring utilisait des Sealed Secrets : a reprendre quand le POC passera a la chaine CI/CD.
secrets:
	@test -f .env || (echo "Fichier .env absent : cp .env.example .env" && exit 1)
	@kubectl create namespace $(NS) --dry-run=client -o yaml | kubectl apply -f -
	@kubectl -n $(NS) create secret generic pme-secrets \
		--from-literal=db-username='$(POSTGRES_USER)' \
		--from-literal=db-password='$(POSTGRES_PASSWORD)' \
		--from-literal=rabbitmq-username='$(RABBITMQ_USER)' \
		--from-literal=rabbitmq-password='$(RABBITMQ_PASSWORD)' \
		--from-literal=keycloak-admin-username='$(KEYCLOAK_ADMIN)' \
		--from-literal=keycloak-admin-password='$(KEYCLOAK_ADMIN_PASSWORD)' \
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

queues:
	kubectl -n $(NS) exec deploy/rabbitmq -- rabbitmqctl list_queues name messages consumers

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

# Ouvre l'application sur le poste. Chaque redirection se relance toute seule si elle tombe.
# Postgres et RabbitMQ (5432, 5672) ne servent qu'au developpement local : voir "make dev-*".
port-forward:
	@( while true; do kubectl -n $(NS) port-forward svc/pme-frontend $(FRONT_PORT):8080; sleep 2; done ) &
	@( while true; do kubectl -n $(NS) port-forward svc/keycloak $(KEYCLOAK_PORT):8080; sleep 2; done ) &
	@( while true; do kubectl -n $(NS) port-forward svc/rabbitmq $(RABBITMQ_UI_PORT):15672; sleep 2; done ) &
	@( while true; do kubectl -n $(NS) port-forward svc/adminer $(ADMINER_PORT):8080; sleep 2; done ) &
	@( while true; do kubectl -n $(NS) port-forward svc/postgres 5432:5432; sleep 2; done ) &
	@( while true; do kubectl -n $(NS) port-forward svc/rabbitmq 5672:5672; sleep 2; done ) &
	@sleep 2
	@echo "Application   : $(APP_URL)"
	@echo "Keycloak      : $(KEYCLOAK_URL)"
	@echo "RabbitMQ      : $(RABBITMQ_URL)"
	@echo "Adminer       : $(ADMINER_URL) (serveur pre-rempli : postgres)"
	@echo "'make stop-forward' pour tout arreter."

stop-forward:
	@pkill -f "kubectl -n $(NS) port-forward" || true
	@echo "Port-forwards arretes."

# En developpement local, les services tournent sur le poste mais lisent les cles de
# Keycloak par le port-forward. L'emetteur attendu est le meme qu'en cluster, puisque
# --hostname-url le fige (voir k8s/03-keycloak.yaml).
DEV_KEYCLOAK_ENV = KEYCLOAK_ISSUER=$(KEYCLOAK_URL)/realms/pme \
	KEYCLOAK_JWKS_URI=$(KEYCLOAK_URL)/realms/pme/protocol/openid-connect/certs \
	KEYCLOAK_ALLOWED_CLIENTS=pme-web,pme-cli

dev-api:
	@cd api && DB_HOST=localhost DB_NAME=pme DB_USER='$(POSTGRES_USER)' DB_PASSWORD='$(POSTGRES_PASSWORD)' \
		RABBITMQ_HOST=localhost RABBITMQ_USER='$(RABBITMQ_USER)' RABBITMQ_PASSWORD='$(RABBITMQ_PASSWORD)' \
		$(DEV_KEYCLOAK_ENV) npm run start:dev

dev-moderation:
	@cd moderation-service && DB_HOST=localhost DB_NAME=moderation DB_USER='$(POSTGRES_USER)' DB_PASSWORD='$(POSTGRES_PASSWORD)' \
		RABBITMQ_HOST=localhost RABBITMQ_USER='$(RABBITMQ_USER)' RABBITMQ_PASSWORD='$(RABBITMQ_PASSWORD)' \
		$(DEV_KEYCLOAK_ENV) npm run start:dev

dev-frontend:
	cd frontend && npm run dev

# ---- Qualite logicielle (memes controles que l'etape "quality" de la chaine CI/CD) ----
# Voir docs/QUALITE.md : attributs de qualite -> controle -> etape du pipeline.

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

# Integration : PostgreSQL et RabbitMQ reels dans des conteneurs jetables (Testcontainers), a chaque demande de fusion
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
	docker run --rm -it -p $(DOCS_PORT):8000 -v "$(CURDIR)":/docs pme-docs-deps:dev mkdocs serve -a 0.0.0.0:8000

docs-check:
	docker build -f Dockerfile.docs --target deps -t pme-docs-deps:dev .
	docker run --rm -v "$(CURDIR)":/docs pme-docs-deps:dev mkdocs build --strict --site-dir /tmp/site

docs-image:
	docker build -f Dockerfile.docs -t pme-docs:dev .

docs-run:
	@echo "Documentation : http://localhost:$(DOCS_IMAGE_PORT) (Ctrl+C pour arreter)"
	docker run --rm -p $(DOCS_IMAGE_PORT):8080 pme-docs:dev

docs-image-test:
	container-structure-test test --image pme-docs:dev --config tests/image/docs.yaml
	trivy image --severity HIGH,CRITICAL --ignore-unfixed --exit-code 1 pme-docs:dev

# Performance (k6) : sur le cluster deploye, apres le deploiement en recette.
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

open-app:
	@xdg-open "$(APP_URL)" 2>/dev/null || open "$(APP_URL)" 2>/dev/null || echo "Ouvrir : $(APP_URL)"

open-keycloak:
	@xdg-open "$(KEYCLOAK_URL)" 2>/dev/null || open "$(KEYCLOAK_URL)" 2>/dev/null || echo "Ouvrir : $(KEYCLOAK_URL)"

open-rabbitmq:
	@xdg-open "$(RABBITMQ_URL)" 2>/dev/null || open "$(RABBITMQ_URL)" 2>/dev/null || echo "Ouvrir : $(RABBITMQ_URL)"

open-adminer:
	@xdg-open "$(ADMINER_URL)" 2>/dev/null || open "$(ADMINER_URL)" 2>/dev/null || echo "Ouvrir : $(ADMINER_URL)"