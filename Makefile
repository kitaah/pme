# ---- Makefile ----
# Reprend l'organisation du Makefile du projet Spring (minikube-up, deploy, redeploy, port-forward, logs...)
# adaptee a la nouvelle pile : React / NestJS / NATS / Keycloak / PostgreSQL sur Minikube.

.PHONY: help install test test-integration test-perf image-test \
        lint format format-check lint-yaml lint-docker lint-k8s secrets-scan audit coverage sonar quality \
        minikube-up minikube-down helm ingress ingress-restart mesh-renew inotify istio istio-scan mesh-check authz-check netpol-check jwt-check smoke seed-listings seed-listings-clean cert-manager ca-cert ca-configmap metrics-server hpa tunnel hosts \
        env kubeseal sealed-secrets sealed-prereqs seal image image-api image-moderation image-frontend deploy redeploy restart undeploy reset \
        garage-secrets db-secrets seal-now garage-init \
        pods logs logs-api logs-moderation logs-keycloak logs-rabbitmq logs-nats logs-publish logs-receive \
        port-forward stop-forward api moderation frontend \
        queues queues-rabbitmq broker-nats broker-rabbitmq broker db-listings db-moderation \
        demo-stop-moderation demo-start-moderation demo-kill-api \
        app keycloak nats rabbitmq adminer prometheus grafana alloy \
        docs-serve docs-check docs-image docs-run docs-stop scripts-perms

# NS sert aux commandes kubectl. Il n'est PAS propage aux manifestes : le namespace est
# fixe dans k8s/kustomization.yaml (voir la documentation, page Architecture).
NS ?= pme
MINIKUBE_MEMORY ?= 5120
MINIKUBE_CPUS ?= 2
CERT_MANAGER_VERSION ?= v1.18.2
# Version du chart Helm de Traefik (le controleur d'ingress). Epinglee : une montee de version se decide, elle ne se subit pas.
TRAEFIK_CHART_VERSION ?= 41.3.0
# Version de Helm installee par `make helm` (outil en ligne de commande qui installe le chart de Traefik).
HELM_VERSION ?= v4.3.0
# Version d'Istio installee par `make istio` (les quatre charts Helm : base, istiod, cni, ztunnel). A verifier avec
# `helm search repo istio/istiod --versions | head` si Helm ne la trouve pas.
ISTIO_VERSION ?= 1.30.0

# Version de Sealed Secrets : celle de l'outil kubeseal (make kubeseal) ET du controleur (make sealed-secrets), qui doivent rester identiques.
KUBESEAL_VERSION ?= 0.41.2

# Plafond d'instances inotify exige par ztunnel (voir la cible `inotify`). Linux par defaut : 128.
INOTIFY_INSTANCES ?= 1024
TRAEFIK_NS ?= traefik
CA_FILE ?= pme-ca.crt

# Les interfaces web passent par l'ingress en HTTPS (certificat cert-manager signe par une autorite locale), sous des
# noms d'hote .localhost (contexte securise pour les navigateurs : requis par keycloak-js).
# Pour les joindre depuis l'ordinateur : "make tunnel" (redirige les ports 80 et 443 vers l'ingress), puis la ligne /etc/hosts de "make hosts".
# Le navigateur doit faire confiance a l'autorite locale : "make ca-cert" ecrit pme-ca.crt, a importer une fois.
# Ces noms sont aussi ecrits dans k8s/14-ingress.yaml, k8s/06-keycloak.yaml (hostname-url), k8s/08-api.yaml et
# k8s/09-moderation.yaml (emetteur), k8s/18-grafana.yaml, k8s/config/realm-pme.json (URL de retour), k8s/12-certificate.yaml et
# k8s/config/frontend-config.js : les changer ici ne suffit pas.
# NATS et PostgreSQL restent joints par "kubectl port-forward" (voir make port-forward, qui lance aussi l'ingress).
APP_HOST ?= pme.localhost
KEYCLOAK_HOST ?= keycloak.localhost
ADMINER_HOST ?= adminer.localhost
GRAFANA_HOST ?= grafana.localhost
PROMETHEUS_HOST ?= prometheus.localhost
ALLOY_HOST ?= alloy.localhost
GARAGE_HOST ?= garage.localhost
NATS_MONITOR_PORT ?= 8222
RABBITMQ_HOST ?= rabbitmq.localhost
DOCS_PORT ?= 8005
DOCS_IMAGE_PORT ?= 8083
DOCS_URL := http://localhost:$(DOCS_PORT)
DOCS_IMAGE_URL := http://localhost:$(DOCS_IMAGE_PORT)

APP_URL := https://$(APP_HOST)
KEYCLOAK_URL := https://$(KEYCLOAK_HOST)
NATS_URL := https://localhost:$(NATS_MONITOR_PORT)
RABBITMQ_URL := https://$(RABBITMQ_HOST)
ADMINER_URL := https://$(ADMINER_HOST)
PROMETHEUS_URL := https://$(PROMETHEUS_HOST)
GRAFANA_URL := https://$(GRAFANA_HOST)
ALLOY_URL := https://$(ALLOY_HOST)
HOSTS := $(APP_HOST) $(KEYCLOAK_HOST) $(ADMINER_HOST) $(GRAFANA_HOST) $(PROMETHEUS_HOST) $(ALLOY_HOST) $(RABBITMQ_HOST) $(GARAGE_HOST)

# Charge .env s'il existe (POSTGRES_*, NATS_*, KEYCLOAK_ADMIN*, GRAFANA_ADMIN*), non versionne.
-include .env
export

# Premiere utilisation : .env est cree depuis son modele (valeurs de demonstration), puis jamais ecrase.
# Il est prive (droits 600) car il contient les mots de passe.
.env: | env.example
	@umask 077 && cp env.example .env
	@echo "$@ cree depuis env.example : remplacer les CHANGE_ME par des mots de passe avant make seal"

# `make env` : cree .env s'il manque (sans rien faire sinon).
env: .env

help:
	@echo "Commandes disponibles :"
	@echo ""
	@echo "  Cluster"
	@echo "    make minikube-up              - Demarre Minikube (rend aussi les scripts executables)"
	@echo "    make minikube-down            - Arrete Minikube"
	@echo "    make helm                     - Installe Helm sur l'ordinateur s'il est absent (requis par make ingress)"
	@echo "    make ingress                  - Installe l'ingress Traefik (Helm) et attend qu'il soit pret"
	@echo "    make ingress-restart          - Redemarre Traefik (donne un certificat neuf au pod) : a lancer en cas de 502 Bad Gateway partout"
	@echo "    make mesh-renew               - Renouvelle les certificats du maillage Istio (redemarre ztunnel, Traefik puis les applications) : a lancer en cas de CertificateExpired"
	@echo "    make cert-manager             - Installe cert-manager et l'autorite locale (certificats TLS)"
	@echo "    make metrics-server           - Active metrics-server (addon Minikube), requis par l'autoscaling"
	@echo "    make hpa                      - Suit l'autoscaling : charge, cible et nombre de pods"
	@echo "    make ca-cert                  - Ecrit l'autorite locale dans $(CA_FILE), a importer dans le navigateur"
	@echo "    make inotify                  - Releve la limite inotify de l'ordinateur (sudo) : requis par Istio, sans effet si deja suffisante"
	@echo "    make istio                    - Installe Istio (mode ambient) : chiffre en mTLS les echanges entre pods"
	@echo "    make istio-scan               - Analyse Trivy des trois images d'Istio (echec sur CRITICAL corrigeable, HIGH signalees)"
	@echo "    make mesh-check               - Verifie le mTLS : un pod hors du mesh est refuse, les echanges portent des identites"
	@echo "    make authz-check              - Verifie les autorisations par identite : seules les sources prevues joignent chaque composant"
	@echo "    make netpol-check             - Verifie les politiques reseau (Calico) : un pod sans l'etiquette prevue est coupe, meme avec la bonne identite"
	@echo "    make jwt-check                - Verifie la validation des jetons a l'ingress : sans jeton valide, Traefik repond 401 sur /api/v1 ; le site reste public"
	@echo "    make smoke                    - Test de fumee : deploiements, comptes PostgreSQL, donnees de base, ingress et photo aleatoire, une ligne OK ou KO par controle"
	@echo "    make ca-configmap             - Copie l'autorite locale dans le namespace $(NS) (verification du TLS de PostgreSQL)"
	@echo "    make tunnel                   - Redirige les ports 80 et 443 vers l'ingress (cluster cree sans --ports ; laisser ouvert, mot de passe demande)"
	@echo "    make hosts                    - Affiche la ligne a ajouter dans /etc/hosts pour les noms .localhost"
	@echo ""
	@echo "  Deploiement"
	@echo "    make env                      - Cree .env depuis env.example s'il manque (jamais ecrase)"
	@echo "    make kubeseal                 - Installe kubeseal $(KUBESEAL_VERSION) sur l'ordinateur s'il est absent (requis par make seal)"
	@echo "    make sealed-secrets           - Installe le controleur Sealed Secrets (fait aussi par seal si absent)"
	@echo "    make seal                     - Re-chiffre .env dans k8s/01-pme-secrets-sealed.yaml (a versionner)"
	@echo "    make image                    - Construit les 3 images dans Minikube"
	@echo "    make deploy                   - secrets chiffres (generes si absents) + ca-configmap + kubectl apply -k k8s/ (Postgres, NATS, Keycloak, Garage, API, moderation, front, ingress)"
	@echo "    make garage-secrets           - Genere dans .env les secrets de Garage s'ils manquent (fait par make seal)"
	@echo "    make db-secrets               - Genere dans .env les mots de passe des comptes PostgreSQL de chaque service s'ils manquent (fait par make seal)"
	@echo "    make garage-init              - Mise en service du stockage des photos : disposition, depot et cle (fait par make deploy)"
	@echo "    make redeploy                 - image + redemarrage des 3 deployments (apres une modification du code)"
	@echo "    make undeploy                 - Supprime le namespace (donnees comprises)"
	@echo ""
	@echo "  Observation"
	@echo "    make pods | logs-api | logs-moderation | logs-keycloak"
	@echo "    make queues                   - Flux NATS : messages en attente / consommateurs"
	@echo "    make queues-rabbitmq          - Files RabbitMQ : messages en attente / consommateurs / file des echecs"
	@echo "    make broker-nats              - Bascule l'API et la moderation sur NATS (sans reconstruire d'image)"
	@echo "    make broker-rabbitmq          - Bascule l'API et la moderation sur RabbitMQ (sans reconstruire d'image)"
	@echo "    make broker                   - Affiche le broker utilise"
	@echo "    make logs-publish             - L'API a publie l'annonce (Evenement listing.submitted)"
	@echo "    make logs-receive             - La moderation l'a recue (Consommateur / Annonce)"
	@echo "    make logs-rabbitmq            - Journal du pod RabbitMQ (logs-nats pour NATS)"
	@echo "    make db-listings              - Annonces en base (API)"
	@echo "    make db-moderation            - File de moderation en base (service de moderation)"
	@echo ""
	@echo "  Demonstration"
	@echo "    make scripts-perms            - Rend les scripts .sh executables (a lancer apres un clonage ou une extraction)"
	@echo "    make seed-listings            - Annonces publiees de demonstration pour un utilisateur : SEED_USER=<identifiant> [COUNT=6], chacune avec une image aleatoire"
	@echo "    make seed-listings-clean      - Supprime les annonces de demonstration de cet utilisateur : SEED_USER=<identifiant>"
	@echo "    make demo-stop-moderation     - Arrete le service de moderation (les messages restent dans NATS)"
	@echo "    make demo-start-moderation    - Le relance : la file se vide"
	@echo "    make demo-kill-api            - Supprime le pod de l'API : Kubernetes le recree"
	@echo ""
	@echo "  Developpement local"
	@echo "    make install                  - npm ci a la racine (api, moderation-service, libs/common) puis dans frontend"
	@echo "    make port-forward             - Pour developper : NATS :8222 et :4222, RabbitMQ :5671, Postgres :5432 -> localhost, et l'ingress sur le port 80 s'il n'y est pas deja"
	@echo "    make api | moderation | frontend"
	@echo ""
	@echo "  Tests"
	@echo "    make test                     - Tests unitaires (Jest : libs/common + api + moderation-service, Vitest : frontend)"
	@echo "    make test-integration         - Tests d'integration avec PostgreSQL et NATS reels (Testcontainers, Docker requis)"
	@echo "    make test-perf                - Test de charge k6 (profil ci) : PostgreSQL et NATS jetables, API reelle (Docker et k6 requis)"
	@echo "    make image-test               - Tests des images Docker (container-structure-test + Trivy)"
	@echo ""
	@echo "  Documentation (MkDocs, Docker requis)"
	@echo "    make docs-serve               - Apercu en direct : http://localhost:$(DOCS_PORT) (ouvre le navigateur)"
	@echo "    make docs-check               - Construction stricte (lien casse ou page hors menu = echec)"
	@echo "    make docs-image               - Image pme-docs:dev (site statique, nginx non-root)"
	@echo "    make docs-run                 - Sert l'image : http://localhost:$(DOCS_IMAGE_PORT) (ouvre le navigateur)"
	@echo "    make docs-stop                - Arrete l'apercu et le site servis par docs-serve et docs-run"
	@echo ""
	@echo "  Ouvrir : make app | keycloak | nats | rabbitmq | adminer | prometheus | grafana | alloy"

# ---- Cluster Minikube ----

# --ports publie les ports 80 et 443 du noeud (ou ecoute l'ingress) sur 127.0.0.1 de l'ordinateur : l'ingress est
# alors joignable sans "make tunnel" ni redirection. Option prise en compte a la CREATION du cluster seulement :
# sur un cluster existant, il faut "minikube delete" puis "make minikube-up" (les deploiements sont perdus).
# Le port 443 sert le HTTPS (cert-manager).
# --cni=calico : plugin reseau qui APPLIQUE les politiques reseau (k8s/22-network-policies.yaml). Celui de Minikube par defaut
# ne le fait pas : les politiques seraient acceptees mais sans effet. Meme contrainte : choisi a la creation seulement.
minikube-up: scripts-perms
	minikube start --driver=docker --memory=$(MINIKUBE_MEMORY) --cpus=$(MINIKUBE_CPUS) --cni=calico \
		--ports=127.0.0.1:80:80,127.0.0.1:443:443
	$(MAKE) ingress
	$(MAKE) istio
	$(MAKE) cert-manager
	$(MAKE) ca-cert
	$(MAKE) metrics-server
	@echo "Importer $(CA_FILE) dans le navigateur (voir docs/outils/cert-manager.md), puis : make deploy"

minikube-down:
	minikube stop

# Helm (gestionnaire de paquets de Kubernetes) : installe une seule fois par ordinateur, avec le script officiel du projet
# Helm (somme de controle verifiee, version epinglee). Il ecrit dans /usr/local/bin, d'ou le mot de passe administrateur.
# Sans effet si Helm est deja installe. Autres methodes : https://helm.sh/docs/intro/install/
helm:
	@if command -v helm >/dev/null; then echo "Helm deja installe : $$(helm version --short)"; \
	else curl -fsSL https://raw.githubusercontent.com/helm/helm/main/scripts/get-helm-4 | DESIRED_VERSION=$(HELM_VERSION) bash; fi

# Ingress Traefik, installe par son chart Helm officiel (version epinglee, reglages dans k8s/traefik/values.yaml).
# Il remplace ingress-nginx, archive par la communaute Kubernetes en mars 2026 (plus aucun correctif de securite).
# L'addon Minikube est desactive d'abord : il occupe les ports 80 et 443 du noeud, que Traefik reprend. Sur un
# cluster neuf la commande ne fait rien. `helm upgrade --install` sert aussi bien a installer qu'a mettre a jour,
# et --wait attend que le controleur soit pret : un "make deploy" lance trop tot echouerait sur les ressources Traefik.
# Le chart installe aussi les definitions des ressources Traefik (Middleware...) utilisees par k8s/13-middlewares.yaml.
# Redirection HTTP vers HTTPS, ports du noeud et log d'acces : voir k8s/traefik/values.yaml.
# Traefik exige TLS 1.2 au minimum par defaut, comme PostgreSQL (k8s/03-postgres.yaml) et NATS (k8s/config/nats.conf).
# HSTS et compression des reponses : k8s/13-middlewares.yaml.
ingress:
	@command -v helm >/dev/null || { echo "helm absent : lancer make helm"; exit 1; }
	@minikube addons disable ingress >/dev/null 2>&1 || true
	helm repo add traefik https://traefik.github.io/charts --force-update
	helm upgrade --install traefik traefik/traefik --version $(TRAEFIK_CHART_VERSION) \
		--namespace $(TRAEFIK_NS) --create-namespace --values k8s/traefik/values.yaml --wait --timeout 3m

# Redemarre Traefik. A lancer quand TOUS les sites repondent 502 Bad Gateway alors que les pods sont prets : le
# certificat que le maillage Istio delivre a Traefik dure 24 h, et s'il n'est pas renouvele (portable mis en veille,
# ztunnel gele), les pods refusent les connexions de Traefik. Un pod neuf recoit un certificat neuf. Le log de ztunnel
# le confirme : `kubectl -n istio-system logs ds/ztunnel | grep ExpiredContext`. Ce n'est pas lance par deploy ni
# redeploy : cela couperait l'ingress a chaque deploiement pour un incident rare.
ingress-restart:
	kubectl -n $(TRAEFIK_NS) rollout restart deploy/traefik
	kubectl -n $(TRAEFIK_NS) rollout status deploy/traefik --timeout=120s

# Renouvelle les certificats du maillage Istio (mTLS). Ils durent 24 h ; si ztunnel ne les renouvelle pas (portable
# mis en veille, horloge decalee), les pods ne se joignent plus : PostgreSQL ECONNRESET, NATS CONNECTION_REFUSED, nouveaux
# pods en CrashLoopBackOff. Le log de ztunnel le confirme : `kubectl -n istio-system logs ds/ztunnel | grep -E
# "CertificateExpired|ExpiredContext"`. Dans l'ordre : ztunnel (il porte les identites), Traefik, puis les applications,
# qui recoivent ainsi des certificats neufs. Ce n'est pas lance par deploy ni redeploy : incident rare.
mesh-renew:
	kubectl -n istio-system rollout restart ds/ztunnel
	kubectl -n istio-system rollout status ds/ztunnel --timeout=120s
	@$(MAKE) --no-print-directory ingress-restart
	kubectl -n $(NS) rollout restart deployment pme-api pme-moderation pme-frontend
	kubectl -n $(NS) rollout status deployment pme-api pme-moderation pme-frontend --timeout=180s

# Prerequis de l'ordinateur pour Istio : ztunnel surveille ses certificats avec inotify. Minikube (pilote Docker) partage
# le noyau de l'ordinateur, dont la limite par defaut (128 instances) est vite atteinte : ztunnel plante alors avec
# "Too many open files". La cible ne fait rien si la limite est deja suffisante ; sinon elle la releve (sudo) et la
# rend permanente dans /etc/sysctl.d. Reglage Linux uniquement.
inotify:
	@cur=$$(sysctl -n fs.inotify.max_user_instances 2>/dev/null || echo 0); \
	if [ "$$cur" -ge $(INOTIFY_INSTANCES) ]; then \
		echo "inotify : limite suffisante ($$cur instances)"; \
	else \
		echo "inotify : limite de $$cur instances, relevee a $(INOTIFY_INSTANCES) (mot de passe sudo demande)"; \
		sudo sysctl fs.inotify.max_user_instances=$(INOTIFY_INSTANCES) && \
		echo 'fs.inotify.max_user_instances=$(INOTIFY_INSTANCES)' | sudo tee /etc/sysctl.d/99-inotify.conf >/dev/null && \
		sudo sysctl --system >/dev/null; \
	fi

# Istio en mode ambient : chiffre en mTLS les echanges entre pods, sans modifier les pods ni ajouter de proxy dans chacun.
# Quatre charts Helm, installes dans l'ordre : base (definitions des ressources), istiod (plan de controle, emet les
# identites), cni (agent par noeud qui redirige le trafic) et ztunnel (proxy par noeud qui chiffre). Reglages : k8s/istio/.
# Le namespace de Traefik est enrole ici (il est cree par `make ingress`, a lancer avant) : sans cela, l'ingress ne
# pourrait plus joindre les services, car le namespace pme refuse les connexions hors mesh (k8s/20-mesh-mtls.yaml).
# Le namespace pme, lui, est enrole par le label de k8s/namespace.yaml.
# Sur un cluster existant, cette commande suffit : il n'est pas necessaire de le recreer.
istio: inotify
	@command -v helm >/dev/null || { echo "helm absent : lancer make helm"; exit 1; }
	@kubectl get namespace $(TRAEFIK_NS) >/dev/null 2>&1 || { echo "Namespace $(TRAEFIK_NS) absent : lancer make ingress d'abord"; exit 1; }
	kubectl apply -f k8s/istio/namespace.yaml
	helm repo add istio https://istio-release.storage.googleapis.com/charts --force-update
	helm upgrade --install istio-base istio/base --version $(ISTIO_VERSION) \
		--namespace istio-system --wait --timeout 3m
	helm upgrade --install istiod istio/istiod --version $(ISTIO_VERSION) \
		--namespace istio-system --values k8s/istio/istiod-values.yaml --wait --timeout 5m
	helm upgrade --install istio-cni istio/cni --version $(ISTIO_VERSION) \
		--namespace istio-system --values k8s/istio/cni-values.yaml --wait --timeout 3m
	helm upgrade --install ztunnel istio/ztunnel --version $(ISTIO_VERSION) \
		--namespace istio-system --values k8s/istio/ztunnel-values.yaml --wait --timeout 3m
	kubectl label namespace $(TRAEFIK_NS) istio.io/dataplane-mode=ambient --overwrite

# Failles connues dans les trois images d'Istio (plan de controle, agent reseau, ztunnel). Ces composants s'executent avec
# des droits eleves sur le noeud : leurs images sont donc analysees. Elles sont publiees par Istio et non reconstruites ici :
# la commande echoue sur les failles CRITICAL corrigeables et affiche les HIGH a titre d'information (meme regle que la CI).
# Prerequis : trivy installe. Aucune image a construire : Trivy lit directement le registre d'Istio.
istio-scan:
	@for img in pilot install-cni ztunnel; do \
		echo "== docker.io/istio/$$img:$(ISTIO_VERSION) : failles HIGH (information)"; \
		trivy image --scanners vuln --severity HIGH --ignore-unfixed --exit-code 0 docker.io/istio/$$img:$(ISTIO_VERSION); \
		echo "== docker.io/istio/$$img:$(ISTIO_VERSION) : failles CRITICAL (bloquantes)"; \
		trivy image --scanners vuln --severity CRITICAL --ignore-unfixed --exit-code 1 docker.io/istio/$$img:$(ISTIO_VERSION) || exit 1; \
	done

# Verifie le chiffrement entre pods. Un pod hors du mesh (namespace default) essaie de joindre l'interface : il doit
# etre refuse (pas de code HTTP 200). Puis les derniers echanges vus par ztunnel : chaque ligne montre l'identite
# (spiffe://...) de la source et de la destination, preuve que la connexion est en mTLS.
mesh-check:
	@echo "Pod hors du mesh vers l'interface (attendu : echec de la connexion) :"
	@kubectl -n default run mesh-hors --rm -i --quiet --restart=Never --image=curlimages/curl -- \
		curl -sS -m 5 -o /dev/null -w "HTTP %{http_code}\n" http://pme-frontend.pme.svc.cluster.local:8080 || true
	@echo "Derniers echanges chiffres vus par ztunnel (identites spiffe) :"
	@kubectl -n istio-system logs ds/ztunnel --tail=300 | grep spiffe | tail -5 || true

# Verifie les politiques d'autorisation d'Istio (k8s/21-authorization-policies.yaml) avec trois pods temporaires. Chacun a une
# ETIQUETTE que les politiques reseau (k8s/22-network-policies.yaml) autorisent vers sa destination : seule l'IDENTITE (compte de
# service) decide alors. Chaque ligne annonce le resultat attendu. Un refus de ztunnel se voit a une connexion coupee (curl
# echoue, sans code HTTP : "HTTP 000") ; une connexion autorisee renvoie un code HTTP.
#   - etiquette pme-api, compte `default` (aucune regle ne le cite) -> Keycloak : refuse ;
#   - etiquette pme-api, compte `pme-api`                          -> Keycloak : autorise ;
#   - etiquette grafana, compte `pme-api`                          -> Prometheus : refuse (Grafana y est autorise, pas l'identite pme-api).
authz-check:
	@echo "Identite default vers Keycloak (attendu : refus, HTTP 000) :"
	@kubectl -n $(NS) run authz-default --rm -i --quiet --restart=Never --image=curlimages/curl \
		--labels=app.kubernetes.io/name=pme-api -- \
		curl -sS -m 5 -o /dev/null -w "HTTP %{http_code}\n" http://keycloak:8080/realms/pme || true
	@echo "Identite pme-api vers Keycloak (attendu : HTTP 200) :"
	@kubectl -n $(NS) run authz-api-keycloak --rm -i --quiet --restart=Never --image=curlimages/curl \
		--labels=app.kubernetes.io/name=pme-api \
		--overrides='{"spec":{"serviceAccountName":"pme-api"}}' -- \
		curl -sS -m 5 -o /dev/null -w "HTTP %{http_code}\n" http://keycloak:8080/realms/pme || true
	@echo "Identite pme-api vers Prometheus (attendu : refus, HTTP 000) :"
	@kubectl -n $(NS) run authz-api-prometheus --rm -i --quiet --restart=Never --image=curlimages/curl \
		--labels=app.kubernetes.io/name=grafana \
		--overrides='{"spec":{"serviceAccountName":"pme-api"}}' -- \
		curl -sS -m 5 -o /dev/null -w "HTTP %{http_code}\n" http://prometheus:9090/-/ready || true

# Verifie les politiques reseau (k8s/22-network-policies.yaml) avec deux pods temporaires qui ont TOUS DEUX l'identite pme-api,
# donc que les politiques d'Istio autorisent vers Keycloak. Seule l'etiquette differe : c'est elle que lit le reseau.
#   - etiquette pme-api  -> Keycloak : autorise (HTTP 200) ;
#   - sans etiquette     -> Keycloak : coupe par Calico (HTTP 000), alors qu'Istio l'aurait laisse passer.
# Un HTTP 200 sur le second pod signifierait que les politiques ne sont pas appliquees : verifier `minikube start --cni=calico`.
netpol-check:
	@echo "Etiquette pme-api (et identite pme-api) vers Keycloak (attendu : HTTP 200) :"
	@kubectl -n $(NS) run netpol-etiquette --rm -i --quiet --restart=Never --image=curlimages/curl \
		--labels=app.kubernetes.io/name=pme-api \
		--overrides='{"spec":{"serviceAccountName":"pme-api"}}' -- \
		curl -sS -m 5 -o /dev/null -w "HTTP %{http_code}\n" http://keycloak:8080/realms/pme || true
	@echo "Sans etiquette (identite pme-api) vers Keycloak (attendu : refus, HTTP 000) :"
	@kubectl -n $(NS) run netpol-sans-etiquette --rm -i --quiet --restart=Never --image=curlimages/curl \
		--overrides='{"spec":{"serviceAccountName":"pme-api"}}' -- \
		curl -sS -m 5 -o /dev/null -w "HTTP %{http_code}\n" http://keycloak:8080/realms/pme || true

# Verifie la validation des jetons par Traefik (middleware `jwt`, k8s/13-middlewares.yaml). Un seul pod temporaire, hors du
# mesh, s'adresse a l'ingress comme un navigateur (nom d'hote pme.localhost, certificat non verifie). Sa sortie est lue dans son
# log une fois le pod termine : l'attachement direct (kubectl run -i) perd parfois des morceaux de texte. Chaque ligne annonce le resultat attendu :
#   - sans jeton        -> /api/v1/listings/mine : 401 ;
#   - jeton invalide    -> /api/v1/listings/mine : 401 ;
#   - sans jeton        -> /api/v1/moderation/queue : 401 ;
#   - sans jeton        -> / (le site) : 200.
# Un 401 peut aussi venir de l'API elle-meme : la derniere etape lit donc le log d'acces de Traefik, depuis le lancement de la commande. Une requete refusee par le
# middleware n'atteint aucun service (OriginStatus 0) ; une requete refusee par l'API porterait OriginStatus 401.
# Le cas d'un jeton VALIDE n'est pas rejoue ici (il demande une connexion Keycloak) : se connecter dans l'interface le couvre.
jwt-check:
	@ip=$$(kubectl -n $(TRAEFIK_NS) get svc traefik -o jsonpath='{.spec.clusterIP}'); \
	test -n "$$ip" || { echo "Service traefik introuvable : lancer make ingress"; exit 1; }; \
	start=$$(date -u +%Y-%m-%dT%H:%M:%SZ); \
	kubectl -n default delete pod jwt-check --ignore-not-found --now >/dev/null; \
	kubectl -n default run jwt-check --restart=Never --image=curlimages/curl --env="IP=$$ip" --command -- sh -c '\
		chk() { l=$$1; p=$$2; e=$$3; shift 3; printf "%s (attendu : HTTP %s) : " "$$l" "$$e"; \
			curl -sk -m 10 -o /dev/null -w "HTTP %{http_code}\n" --resolve $(APP_HOST):443:$$IP "$$@" https://$(APP_HOST)$$p; }; \
		chk "Sans jeton vers /api/v1/listings/mine" /api/v1/listings/mine 401; \
		chk "Jeton invalide vers /api/v1/listings/mine" /api/v1/listings/mine 401 -H "Authorization: Bearer invalide"; \
		chk "Sans jeton vers /api/v1/moderation/queue" /api/v1/moderation/queue 401; \
		chk "Sans jeton vers le site (public)" / 200' >/dev/null; \
	kubectl -n default wait --for=jsonpath='{.status.phase}'=Succeeded pod/jwt-check --timeout=90s >/dev/null || true; \
	kubectl -n default logs jwt-check; \
	kubectl -n default delete pod jwt-check --now >/dev/null; \
	n=$$(kubectl -n $(TRAEFIK_NS) logs deploy/traefik --since-time=$$start | grep '"DownstreamStatus":401' | grep '"OriginStatus":0' | grep -c '"RequestPath":"/api/v1/'); \
	if [ "$$n" -ge 3 ]; then echo "401 emis par Traefik sans atteindre un service : $$n (attendu : 3 ou plus) : OK"; \
	else echo "Seulement $$n refus emis par Traefik (attendu : 3 ou plus) : le 401 vient peut-etre de l'API, voir le log de Traefik"; exit 1; fi

# Test de fumee de la plateforme deployee (scripts/smoke.sh) : douze deploiements disponibles, un compte PostgreSQL par service
# limite a sa base, donnees de base presentes (tables, flux NATS, bucket), ingress qui repond comme prevu, et une image aleatoire envoyee dans Garage
# puis relue et supprimee (scripts/smoke-photo.js). Aucune donnee conservee, aucune connexion Keycloak requise. Code de sortie 1 si un controle echoue.
smoke:
	@NS=$(NS) TRAEFIK_NS=$(TRAEFIK_NS) APP_HOST=$(APP_HOST) KEYCLOAK_HOST=$(KEYCLOAK_HOST) sh scripts/smoke.sh

# Annonces publiees de demonstration (scripts/seed-listings.sh) : COUNT annonces, une image aleatoire chacune.
# Elles sont inserees en base : l'API ne cree que des annonces en attente (moderation hors perimetre).
SEED_USER ?=
COUNT ?= 6
seed-listings:
	@NS=$(NS) sh scripts/seed-listings.sh seed "$(SEED_USER)" "$(COUNT)"

seed-listings-clean:
	@NS=$(NS) sh scripts/seed-listings.sh clean "$(SEED_USER)"

# metrics-server (addon Minikube) : fournit la charge des pods a l'autoscaler (k8s/19-autoscaling.yaml). Sans lui, la cible
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
# Autorites) pour supprimer l'avertissement. curl et Node (make api) s'en servent directement.
# Un cluster recree genere une nouvelle autorite : relancer cette commande et reimporter le fichier.
ca-cert:
	@kubectl -n cert-manager get secret pme-ca -o jsonpath='{.data.ca\.crt}' | base64 -d > $(CA_FILE)
	@echo "Autorite ecrite dans $(CA_FILE)"

# Bundle de confiance interne : copie l'autorite locale (Secret pme-ca du namespace cert-manager) dans la ConfigMap
# `pme-ca` du namespace applicatif. Les clients de PostgreSQL (API, moderation, Keycloak, Grafana) la montent pour
# verifier le certificat du serveur. Un Secret ne se partage pas entre namespaces, d'ou cette copie ; en entreprise,
# trust-manager (projet cert-manager) produit la MEME ConfigMap et la met a jour tout seul a chaque renouvellement.
# Relancer cette commande apres "make cert-manager" sur un cluster recree (nouvelle autorite).
# Le namespace est applique d'abord : sur un cluster neuf, il n'existe pas encore (il n'est cree que par `kubectl apply -k`,
# qui passe apres cette cible). Il porte deja ses labels (securite des pods, maillage Istio), que l'apply suivant conserve.
ca-configmap:
	@kubectl apply -f k8s/namespace.yaml >/dev/null
	@kubectl -n cert-manager get secret pme-ca >/dev/null 2>&1 || (echo "Autorite locale absente : lancer make cert-manager" && exit 1)
	@tmp=$$(mktemp) && \
		kubectl -n cert-manager get secret pme-ca -o jsonpath='{.data.ca\.crt}' | base64 -d > $$tmp && \
		kubectl -n $(NS) create configmap pme-ca --from-file=ca.crt=$$tmp --dry-run=client -o yaml | kubectl apply -f - && \
		rm -f $$tmp
	@echo "ConfigMap pme-ca (autorite locale) creee dans le namespace $(NS)"

# Les navigateurs envoient toujours un nom en .localhost vers 127.0.0.1, quelle que soit la ligne /etc/hosts
# (RFC 6761). L'ingress doit donc ecouter sur 127.0.0.1:80 et :443 : on y redirige les ports 80 et 443 du controleur.
# Ports 80 et 443 = ports privilegies, d'ou sudo (KUBECONFIG est transmis, sudo ne garde pas l'environnement).
# Laisser ce terminal ouvert. Fonctionne de la meme facon sous Linux, macOS et Windows.
# "make port-forward" lance la meme redirection en arriere-plan : ne pas lancer les deux (le port 80 serait pris).
INGRESS_FORWARD = kubectl -n $(TRAEFIK_NS) port-forward --address 127.0.0.1 svc/traefik 80:80 443:443
tunnel:
	sudo env KUBECONFIG="$${KUBECONFIG:-$$HOME/.kube/config}" $(INGRESS_FORWARD)

# N'ecrit rien dans /etc/hosts : affiche la ligne a ajouter (une seule fois) avec un editeur ou "sudo tee -a".
# Les navigateurs n'en ont pas besoin pour .localhost ; curl et Node (make api) peuvent en avoir besoin.
hosts:
	@echo "Ajouter cette ligne dans le fichier hosts de l'ordinateur (/etc/hosts sous Linux et macOS) :"
	@echo ""
	@echo "127.0.0.1 $(HOSTS)"

# ---- Build & deploiement ----

# ---- Secrets : Sealed Secrets ----
# Un Secret Kubernetes n'est qu'encode en base64 : le versionner reviendrait a publier les mots de passe.
# Le controleur Sealed Secrets (dans le cluster) detient une cle privee. `make seal` chiffre les secrets avec sa cle
# publique : le fichier obtenu (SealedSecret) se versionne dans Git, et seul ce cluster sait le dechiffrer en Secret.
SEALED_FILE := k8s/01-pme-secrets-sealed.yaml

# kubeseal (outil qui chiffre les secrets) : installe une seule fois par ordinateur, dans /usr/local/bin (d'ou le mot de
# passe administrateur). Sans effet si la bonne version est deja installee. Linux uniquement ; ailleurs, voir
# https://github.com/bitnami/sealed-secrets/releases. Le binaire est telecharge en HTTPS depuis la page des versions du projet.
kubeseal:
	@if command -v kubeseal >/dev/null && kubeseal --version 2>/dev/null | grep -q "$(KUBESEAL_VERSION)"; then \
		echo "kubeseal deja installe : $$(kubeseal --version)"; \
	else \
		test "$$(uname -s)" = "Linux" || { echo "Installation automatique reservee a Linux : voir la fiche Sealed Secrets"; exit 1; }; \
		case "$$(uname -m)" in x86_64) arch=amd64;; aarch64|arm64) arch=arm64;; *) echo "Architecture non geree : $$(uname -m)"; exit 1;; esac; \
		dir=$$(mktemp -d); trap 'rm -rf "$$dir"' EXIT; \
		curl -fsSL -o "$$dir/kubeseal.tar.gz" "https://github.com/bitnami/sealed-secrets/releases/download/v$(KUBESEAL_VERSION)/kubeseal-$(KUBESEAL_VERSION)-linux-$$arch.tar.gz" && \
		tar -xzf "$$dir/kubeseal.tar.gz" -C "$$dir" kubeseal && \
		sudo install -m 755 "$$dir/kubeseal" /usr/local/bin/kubeseal && \
		echo "kubeseal installe : $$(kubeseal --version)"; \
	fi

# Installe le controleur (namespace kube-system), une seule fois par cluster, a la meme version que kubeseal.
sealed-secrets:
	kubectl apply -f "https://github.com/bitnami/sealed-secrets/releases/download/v$(KUBESEAL_VERSION)/controller.yaml"
	kubectl -n kube-system rollout status deployment/sealed-secrets-controller --timeout=120s

sealed-prereqs:
	@{ command -v kubeseal >/dev/null && kubeseal --version 2>/dev/null | grep -q "$(KUBESEAL_VERSION)"; } || { echo "kubeseal $(KUBESEAL_VERSION) absent : lancer make kubeseal"; exit 1; }
	@for v in POSTGRES_USER POSTGRES_PASSWORD NATS_USER NATS_PASSWORD RABBITMQ_USER RABBITMQ_PASSWORD KEYCLOAK_ADMIN KEYCLOAK_ADMIN_PASSWORD GRAFANA_ADMIN GRAFANA_ADMIN_PASSWORD \
		GARAGE_ACCESS_KEY GARAGE_SECRET_KEY GARAGE_RPC_SECRET GARAGE_ADMIN_TOKEN \
		DB_API_PASSWORD DB_MODERATION_PASSWORD DB_KEYCLOAK_PASSWORD DB_GRAFANA_PASSWORD; do \
		test -n "$$(printenv $$v)" || { echo "$$v absent de .env"; exit 1; }; \
		test "$$(printenv $$v)" != "CHANGE_ME" || { echo "$$v vaut encore CHANGE_ME dans .env : choisir un mot de passe"; exit 1; }; \
	done
	@kubectl -n kube-system get deployment sealed-secrets-controller >/dev/null 2>&1 || $(MAKE) --no-print-directory sealed-secrets

# Les valeurs viennent de l'environnement de make (.env), jamais d'arguments de commande : elles
# n'apparaissent ni dans la liste des processus ni dans l'historique du shell. Le fichier temporaire est prive
# (umask 077) et supprime a la fin. A relancer apres un changement de secret ou un nouveau cluster (nouvelle cle).
# Les etapes sont des appels separes ($(MAKE)) : make lit .env UNE fois, au demarrage. Les secrets de Garage
# generes par garage-secrets ne seraient pas vus par la suite de ce meme appel ; le nouvel appel relit .env.
seal: .env
	@$(MAKE) --no-print-directory garage-secrets
	@$(MAKE) --no-print-directory db-secrets
	@$(MAKE) --no-print-directory seal-now

seal-now: .env sealed-prereqs
	@umask 077; tmp=$$(mktemp); trap 'rm -f "$$tmp" "$(SEALED_FILE).tmp"' EXIT; \
	printf '%s\n' \
		"db-username=$$POSTGRES_USER" "db-password=$$POSTGRES_PASSWORD" \
		"nats-username=$$NATS_USER" "nats-password=$$NATS_PASSWORD" \
		"rabbitmq-username=$$RABBITMQ_USER" "rabbitmq-password=$$RABBITMQ_PASSWORD" \
		"keycloak-admin-username=$$KEYCLOAK_ADMIN" "keycloak-admin-password=$$KEYCLOAK_ADMIN_PASSWORD" \
		"grafana-admin-username=$$GRAFANA_ADMIN" "grafana-admin-password=$$GRAFANA_ADMIN_PASSWORD" \
		"garage-access-key=$$GARAGE_ACCESS_KEY" "garage-secret-key=$$GARAGE_SECRET_KEY" \
		"garage-rpc-secret=$$GARAGE_RPC_SECRET" "garage-admin-token=$$GARAGE_ADMIN_TOKEN" \
		"db-api-password=$$DB_API_PASSWORD" "db-moderation-password=$$DB_MODERATION_PASSWORD" \
		"db-keycloak-password=$$DB_KEYCLOAK_PASSWORD" "db-grafana-password=$$DB_GRAFANA_PASSWORD" > "$$tmp"; \
	kubectl create secret generic pme-secrets --namespace $(NS) --from-env-file="$$tmp" --dry-run=client -o yaml \
		| kubeseal --controller-name sealed-secrets-controller --controller-namespace kube-system --namespace $(NS) --format yaml \
		> "$(SEALED_FILE).tmp" && mv "$(SEALED_FILE).tmp" "$(SEALED_FILE)"
	@echo "$(SEALED_FILE) mis a jour (valeurs chiffrees, non affichees) : a versionner dans Git"

# Secrets de Garage (cle d'acces de l'API, secret, secret RPC, jeton d'administration) : generes dans .env
# SEULEMENT s'ils manquent ou valent encore CHANGE_ME. Une valeur deja presente n'est jamais touchee : la changer
# desynchroniserait .env, le fichier chiffre et la cle deja importee dans Garage. Appele par `make seal`, donc
# avant tout chiffrement. .env survit a un `minikube delete` : les memes valeurs resservent au cluster suivant.
# Formats (voir env.example) : GK + 24 hexa pour l'identifiant, 64 hexa pour les trois autres. Rien n'est affiche
# des valeurs, seuls les noms des variables generees.
garage-secrets: .env
	@set -e; umask 077; \
	gen() { \
		cur=$$(sed -n "s/^$$1=//p" .env | tail -1); \
		if [ -z "$$cur" ] || [ "$$cur" = "CHANGE_ME" ]; then \
			awk -v k="$$1" -v v="$$2" 'BEGIN { FS = OFS = "=" } $$1 == k { print k "=" v; f = 1; next } { print } END { if (!f) print k "=" v }' .env > .env.tmp \
				&& mv .env.tmp .env && echo "  $$1 genere dans .env"; \
		fi; \
	}; \
	gen GARAGE_ACCESS_KEY "GK$$(openssl rand -hex 12)"; \
	gen GARAGE_SECRET_KEY "$$(openssl rand -hex 32)"; \
	gen GARAGE_RPC_SECRET "$$(openssl rand -hex 32)"; \
	gen GARAGE_ADMIN_TOKEN "$$(openssl rand -hex 32)"

# Mots de passe des quatre comptes PostgreSQL (un par service : API, moderation, Keycloak, Grafana) : generes dans .env
# SEULEMENT s'ils manquent ou valent encore CHANGE_ME, jamais modifies ensuite (meme logique que garage-secrets : un compte
# est cree une seule fois, a l'initialisation du volume, avec le mot de passe present alors). 48 hexa chacun.
db-secrets: .env
	@set -e; umask 077; \
	gen() { \
		cur=$$(sed -n "s/^$$1=//p" .env | tail -1); \
		if [ -z "$$cur" ] || [ "$$cur" = "CHANGE_ME" ]; then \
			awk -v k="$$1" -v v="$$2" 'BEGIN { FS = OFS = "=" } $$1 == k { print k "=" v; f = 1; next } { print } END { if (!f) print k "=" v }' .env > .env.tmp \
				&& mv .env.tmp .env && echo "  $$1 genere dans .env"; \
		fi; \
	}; \
	gen DB_API_PASSWORD "$$(openssl rand -hex 24)"; \
	gen DB_MODERATION_PASSWORD "$$(openssl rand -hex 24)"; \
	gen DB_KEYCLOAK_PASSWORD "$$(openssl rand -hex 24)"; \
	gen DB_GRAFANA_PASSWORD "$$(openssl rand -hex 24)"

# Fichier chiffre absent (premier deploiement) : il est genere automatiquement. Present, il n'est jamais regenere ;
# apres un changement dans .env, lancer `make seal`.
$(SEALED_FILE): | .env
	@$(MAKE) --no-print-directory seal

# ---- Stockage objet : premiere mise en service ----
# Lance automatiquement par `make deploy` (donc aussi par `make reset`, qui repart d'un volume vide) : aucune commande
# a retenir apres un `minikube delete`. Peut aussi se lancer seul. Sans effet si tout est deja en place : chaque etape
# verifie avant d'agir.
#
# Garage demarre sans savoir ou ranger les donnees : il faut lui decrire sa disposition (layout),
# puis creer le depot (bucket) et la cle d'acces. La cle n'est pas generee par Garage : elle est
# IMPORTEE depuis .env, ou l'API lit la meme valeur (k8s/08-api.yaml). Les commandes passent par le
# conteneur lui-meme : le port d'administration n'est ouvert a personne (k8s/22-network-policies.yaml).
garage-init: .env
	@test -n "$$GARAGE_ACCESS_KEY" || { echo "GARAGE_ACCESS_KEY absent de .env"; exit 1; }
	@kubectl -n $(NS) rollout status deployment garage --timeout=300s
	@echo "Disposition des donnees (layout) :"
	@kubectl -n $(NS) exec deploy/garage -- /garage status | grep -q "NO ROLE ASSIGNED" && { \
		id=$$(kubectl -n $(NS) exec deploy/garage -- /garage node id -q | cut -d@ -f1); \
		kubectl -n $(NS) exec deploy/garage -- /garage layout assign -z dc1 -c 1G "$$id"; \
		kubectl -n $(NS) exec deploy/garage -- /garage layout apply --version 1; \
	} || echo "  deja definie"
	@echo "Depot des photos :"
	@kubectl -n $(NS) exec deploy/garage -- /garage bucket info pme-photos >/dev/null 2>&1 \
		&& echo "  pme-photos existe deja" \
		|| kubectl -n $(NS) exec deploy/garage -- /garage bucket create pme-photos
	@echo "Cle d'acces de l'API :"
	@kubectl -n $(NS) exec deploy/garage -- /garage key info pme >/dev/null 2>&1 \
		&& echo "  cle pme existe deja" \
		|| kubectl -n $(NS) exec deploy/garage -- /garage key import --yes -n pme "$$GARAGE_ACCESS_KEY" "$$GARAGE_SECRET_KEY"
	@kubectl -n $(NS) exec deploy/garage -- /garage bucket allow --read --write pme-photos --key pme
	@echo "Stockage pret : depot pme-photos accessible a l'API."

image: image-api image-moderation image-frontend

# api et moderation embarquent le module commun libs/common : contexte = racine du depot (liste blanche dans
# <service>/Dockerfile.dockerignore, lue par BuildKit). Construction avec le Docker de l'ordinateur, puis chargement dans Minikube (runtime containerd : docker-env ne convient pas).
image-api:
	docker build -f api/Dockerfile -t pme-api:dev .
	minikube image load pme-api:dev

image-moderation:
	docker build -f moderation-service/Dockerfile -t pme-moderation:dev .
	minikube image load pme-moderation:dev

image-frontend:
	minikube image build -t pme-frontend:dev ./frontend

deploy: ca-configmap | $(SEALED_FILE)
	@kubectl get crd sealedsecrets.bitnami.com >/dev/null 2>&1 || { echo "Sealed Secrets est absent (cluster neuf) : lancer make seal, qui l'installe et rechiffre .env avec la cle du nouveau cluster"; exit 1; }
	@kubectl get crd certificates.cert-manager.io >/dev/null 2>&1 || { echo "cert-manager est absent : lancer make cert-manager"; exit 1; }
	@kubectl get crd middlewares.traefik.io >/dev/null 2>&1 || { echo "Traefik est absent : lancer make ingress"; exit 1; }
	kubectl apply -k k8s/
	@$(MAKE) --no-print-directory garage-init
	@echo "Deploiement lance. Suivre : make pods (Keycloak met ~1 min a demarrer)"

redeploy: image
	kubectl -n $(NS) rollout restart deployment pme-api pme-moderation pme-frontend
	kubectl -n $(NS) rollout status deployment pme-api pme-moderation pme-frontend

restart:
	kubectl -n $(NS) rollout restart deployment pme-api pme-moderation pme-frontend
	kubectl -n $(NS) rollout status deployment pme-api pme-moderation pme-frontend

# La suppression d'un namespace rend la main avant d'etre terminee : on attend explicitement,
# sinon "make reset" repart sur un namespace encore en cours de suppression et echoue.
# Les volumes (PostgreSQL, Garage...) ne sont pas dans le namespace : supprimer le namespace efface les demandes de
# volume, mais Minikube peut laisser les VOLUMES eux-memes en etat "Released", avec leurs donnees. `make reset`
# redeployait alors sur l'ancien disque (PostgreSQL : "Skipping initialization", comptes jamais crees). On releve donc
# les volumes du namespace AVANT, on leur laisse 30 s pour disparaitre, puis on supprime ceux qui restent et leur
# dossier dans la machine Minikube (/tmp/hostpath-provisioner/<namespace>, ignore sans Minikube).
undeploy:
	@pvs=$$(kubectl get pv -o jsonpath='{range .items[?(@.spec.claimRef.namespace=="$(NS)")]}{.metadata.name}{"\n"}{end}' 2>/dev/null); \
	kubectl delete namespace $(NS) --ignore-not-found; \
	kubectl wait --for=delete namespace/$(NS) --timeout=180s 2>/dev/null || true; \
	for pv in $$pvs; do kubectl wait --for=delete pv/$$pv --timeout=30s 2>/dev/null || kubectl delete pv/$$pv --ignore-not-found --wait=false; done; \
	minikube ssh -- "sudo rm -rf /tmp/hostpath-provisioner/$(NS)" >/dev/null 2>&1 || true

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

logs-rabbitmq:
	kubectl -n $(NS) logs -l app=rabbitmq --tail=100 -f

logs-nats:
	kubectl -n $(NS) logs -l app=nats -c nats --tail=100 -f

# Pour la demonstration : la publication cote API, puis la reception cote moderation (les memes lignes pour NATS
# et pour RabbitMQ ; `make broker` dit lequel est actif).
logs-publish:
	@kubectl -n $(NS) logs deploy/pme-api | grep -E "Evenement listing.submitted"

logs-receive:
	@kubectl -n $(NS) logs deploy/pme-moderation | grep -E "Consommateur|Annonce"


# Etat des flux JetStream, lu sur le port de supervision de NATS (8222, HTTPS). La lecture se fait depuis le pod, sur
# sa boucle locale : wget (busybox) n'a pas l'autorite locale, d'ou --no-check-certificate. Pour verifier le certificat,
# utiliser `make port-forward` puis curl --cacert avec la CA locale (le certificat couvre `localhost`).
# Lecture : messages en attente (`messages`) et consommateurs connectes (`num_waiting`, `ack_floor`).
queues:
	@kubectl -n $(NS) exec deploy/nats -c nats -- wget --no-check-certificate -qO- 'https://localhost:8222/jsz?streams=1&consumers=1' \
		| python3 -m json.tool

# Etat des files RabbitMQ (rabbitmqctl, depuis le pod). `messages_ready` = en attente, `messages_unacknowledged` = recus
# mais pas encore acquittes, `consumers` = consommateurs connectes. `listing.submitted.dlq` recoit les messages rejetes.
queues-rabbitmq:
	@kubectl -n $(NS) exec deploy/rabbitmq -- rabbitmqctl list_queues name messages_ready messages_unacknowledged consumers

# Choix du broker pour la demonstration : NATS et RabbitMQ tournent tous les deux en permanence, l'API et la moderation
# ne parlent qu'a celui que designe BROKER. `kubectl set env` relance chaque deploiement (quelques secondes, aucune
# image a reconstruire). Un `make deploy` ulterieur ne change pas ce choix.
broker-nats:
	@kubectl -n $(NS) set env deployment/pme-api BROKER=nats
	@kubectl -n $(NS) set env deployment/pme-moderation BROKER=nats
	@kubectl -n $(NS) rollout status deployment/pme-api deployment/pme-moderation
	@echo "Broker : nats (suivre : make queues)"

broker-rabbitmq:
	@kubectl -n $(NS) set env deployment/pme-api BROKER=rabbitmq
	@kubectl -n $(NS) set env deployment/pme-moderation BROKER=rabbitmq
	@kubectl -n $(NS) rollout status deployment/pme-api deployment/pme-moderation
	@echo "Broker : rabbitmq (suivre : make queues-rabbitmq)"

broker:
	@kubectl -n $(NS) get deployment pme-api pme-moderation -o jsonpath='{range .items[*]}{.metadata.name}{" : "}{.spec.template.spec.containers[0].env[?(@.name=="BROKER")].value}{"\n"}{end}'

db-listings:
	kubectl -n $(NS) exec deploy/postgres -- sh -c 'psql -U "$$POSTGRES_USER" -d pme -c "SELECT id, owner_username, title, status, created_at FROM listings ORDER BY created_at DESC"'

db-moderation:
	kubectl -n $(NS) exec deploy/postgres -- sh -c 'psql -U "$$POSTGRES_USER" -d moderation -c "SELECT listing_id, owner_username, title, status, received_at FROM moderation_queue ORDER BY received_at"'

# ---- Demonstration ----

# Un zip ou certains systemes de fichiers perdent le droit d'execution des scripts ("Permission denied").
# Cette commande le remet sur chaque .sh et, dans un depot Git, le fait enregistrer (a commiter ensuite).
scripts-perms:
	chmod +x scripts/*.sh k8s/config/*.sh
	@if git rev-parse --is-inside-work-tree >/dev/null 2>&1; then git update-index --chmod=+x scripts/*.sh k8s/config/*.sh 2>/dev/null || true; fi
	@echo "Scripts executables."

demo-stop-moderation:
	kubectl -n $(NS) scale deployment pme-moderation --replicas=0

demo-start-moderation:
	kubectl -n $(NS) scale deployment pme-moderation --replicas=1

demo-kill-api:
	kubectl -n $(NS) delete pod -l app=pme-api
	kubectl -n $(NS) get pods -l app=pme-api -w

# ---- Developpement local (services lances sur la machine, infrastructure dans Minikube) ----

# api, moderation-service et libs/common sont des workspaces npm : un seul npm ci, a la racine.
install:
	npm ci
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
	@( while true; do kubectl -n $(NS) port-forward deploy/nats $(NATS_MONITOR_PORT):8222; sleep 2; done ) &
	@( while true; do kubectl -n $(NS) port-forward svc/postgres 5432:5432; sleep 2; done ) &
	@( while true; do kubectl -n $(NS) port-forward svc/nats 4222:4222; sleep 2; done ) &
	@( while true; do kubectl -n $(NS) port-forward svc/rabbitmq 5671:5671; sleep 2; done ) &
	@sleep 2
	@echo "NATS          : $(NATS_URL)/jsz?streams=1&consumers=1"
	@echo "NATS (client) : localhost:4222 ; RabbitMQ (client) : localhost:5671 ; PostgreSQL : localhost:5432"
	@echo "Application   : $(APP_URL) (ingress sur 127.0.0.1:80 et :443, ligne /etc/hosts de 'make hosts' requise)"
	@echo "'make stop-forward' pour tout arreter."

stop-forward:
	@pkill -f "kubectl -n $(NS) port-forward" || true
	@if pgrep -f "kubectl -n $(TRAEFIK_NS) port-forward" >/dev/null; then sudo pkill -f "kubectl -n $(TRAEFIK_NS) port-forward"; fi
	@echo "Port-forwards arretes."

# En developpement local, les services tournent sur l'ordinateur mais lisent les cles de
# Keycloak par l'ingress (make port-forward le lance). L'emetteur attendu est le meme qu'en cluster, puisque
# --hostname-url le fige (voir k8s/06-keycloak.yaml).
DEV_KEYCLOAK_ENV = KEYCLOAK_ISSUER=$(KEYCLOAK_URL)/realms/pme \
	KEYCLOAK_JWKS_URI=$(KEYCLOAK_URL)/realms/pme/protocol/openid-connect/certs \
	KEYCLOAK_ALLOWED_CLIENTS=pme-web \
	NODE_EXTRA_CA_CERTS=$(CURDIR)/$(CA_FILE)

# PostgreSQL et NATS n'acceptent du reseau que des connexions chiffrees : un service lance sur l'ordinateur
# doit donc connaitre l'autorite locale, comme son equivalent dans le cluster. Les certificats sont valables
# pour `localhost` (k8s/00-internal-tls.yaml), le nom compose par "make port-forward".
# "make ca-cert", dont dependent les deux cibles ci-dessous, ecrit le fichier.
# Broker utilise par `make api` et `make moderation` (nats ou rabbitmq) : make api BROKER=rabbitmq
BROKER ?= nats

DEV_TLS_ENV = DB_SSL_CA=$(CURDIR)/$(CA_FILE) NATS_TLS_CA=$(CURDIR)/$(CA_FILE) RABBITMQ_TLS_CA=$(CURDIR)/$(CA_FILE)

api: ca-cert
	@cd api && DB_HOST=localhost DB_NAME=pme DB_USER=pme_api DB_PASSWORD='$(DB_API_PASSWORD)' \
		BROKER='$(BROKER)' NATS_HOST=localhost NATS_USER='$(NATS_USER)' NATS_PASSWORD='$(NATS_PASSWORD)' \
		RABBITMQ_HOST=localhost RABBITMQ_USER='$(RABBITMQ_USER)' RABBITMQ_PASSWORD='$(RABBITMQ_PASSWORD)' \
		$(DEV_TLS_ENV) $(DEV_KEYCLOAK_ENV) npm run start:dev

moderation: ca-cert
	@cd moderation-service && DB_HOST=localhost DB_NAME=moderation DB_USER=pme_moderation DB_PASSWORD='$(DB_MODERATION_PASSWORD)' \
		BROKER='$(BROKER)' NATS_HOST=localhost NATS_USER='$(NATS_USER)' NATS_PASSWORD='$(NATS_PASSWORD)' \
		RABBITMQ_HOST=localhost RABBITMQ_USER='$(RABBITMQ_USER)' RABBITMQ_PASSWORD='$(RABBITMQ_PASSWORD)' \
		$(DEV_TLS_ENV) $(DEV_KEYCLOAK_ENV) npm run start:dev

frontend:
	cd frontend && npm run dev

# ---- Qualite logicielle (memes controles que l'etape "quality" de la chaine CI/CD) ----

# Lint du code TypeScript (ESLint : regles + complexite cyclomatique <= 10 et cognitive <= 15) puis typage strict (tsc)
lint:
	cd libs/common && npm run lint
	cd api && npm run lint
	cd moderation-service && npm run lint
	cd frontend && npm run lint

# Formatage (Prettier) : "make format" corrige, "make format-check" verifie seulement
# ROOT_PRETTIER : scenarios k6 et config du front, hors des trois applications.
# Il reutilise le Prettier installe dans frontend/ pour ne pas ajouter un package.json a la racine.
ROOT_PRETTIER := ./frontend/node_modules/.bin/prettier "tests/**/*.js" "k8s/config/*.js"

format:
	cd libs/common && npm run format
	cd api && npm run format
	cd moderation-service && npm run format
	cd frontend && npm run format
	$(ROOT_PRETTIER) --write

format-check:
	cd libs/common && npm run format:check
	cd api && npm run format:check
	cd moderation-service && npm run format:check
	cd frontend && npm run format:check
	$(ROOT_PRETTIER) --check

# Lint YAML (manifestes Kubernetes, tests d'image, pipelines GitLab et GitHub) : pip install yamllint.
# Le realm Keycloak est un .json : il n'est pas couvert ici (voir la documentation, page Lint YAML).
lint-yaml:
	yamllint -c .yamllint.yml k8s tests .gitlab-ci.yml .github .yamllint.yml

# Lint Dockerfile : hadolint (binaire ou conteneur)
lint-docker:
	hadolint --config .hadolint.yaml api/Dockerfile moderation-service/Dockerfile frontend/Dockerfile docker/docs/Dockerfile

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
	cd libs/common && npm run test:cov
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
# Strategie : voir la documentation, section Pipeline CI/CD (types de tests, outils, place dans la chaine)

# Unitaires : rapides, sans Docker, a chaque commit
test:
	cd libs/common && npm test
	cd api && npm test
	cd moderation-service && npm test
	cd frontend && npm test

# Integration : PostgreSQL et NATS reels dans des conteneurs jetables (Testcontainers), a chaque demande de fusion
test-integration:
	cd api && npm run test:integration
	cd moderation-service && npm run test:integration

# Performance : meme scenario que le job performance-tests de la pipeline (profil allege « ci »).
# PostgreSQL et NATS sont lances dans des conteneurs jetables, sur des ports decales pour ne pas gener make port-forward.
# Les identifiants sont ceux des conteneurs jetables (pme / ci) et ecrasent ceux de l'environnement du terminal.
# Prerequis : Docker et k6 dans le PATH. Resultats (resume k6, logs de l'API) : perf-results/.
PERF_DB_PORT   ?= 55432
PERF_NATS_PORT ?= 54222
PERF_API_PORT  ?= 3100
PERF_IDP_PORT  ?= 9099
test-perf:
	@command -v k6 >/dev/null || { echo "k6 est introuvable : voir https://grafana.com/docs/k6/latest/set-up/install-k6/" >&2; exit 1; }
	@command -v docker >/dev/null || { echo "Docker est introuvable." >&2; exit 1; }
	@set -e; \
	trap 'docker rm -f pme-perf-postgres pme-perf-nats >/dev/null 2>&1 || true' EXIT INT TERM; \
	docker rm -f pme-perf-postgres pme-perf-nats >/dev/null 2>&1 || true; \
	echo "== PostgreSQL et NATS jetables"; \
	docker run -d --name pme-perf-postgres -p 127.0.0.1:$(PERF_DB_PORT):5432 \
		-e POSTGRES_DB=pme -e POSTGRES_USER=pme -e POSTGRES_PASSWORD=ci postgres:18-alpine >/dev/null; \
	docker run -d --name pme-perf-nats -p 127.0.0.1:$(PERF_NATS_PORT):4222 \
		nats:2.14-alpine -js --user pme --pass ci >/dev/null; \
	for i in $$(seq 1 30); do docker exec pme-perf-postgres pg_isready -U pme -d pme >/dev/null 2>&1 && break; sleep 1; done; \
	docker exec pme-perf-postgres pg_isready -U pme -d pme >/dev/null || { echo "PostgreSQL ne repond pas." >&2; exit 1; }; \
	DB_HOST=127.0.0.1 DB_NAME=pme DB_USER=pme DB_PASSWORD=ci NATS_USER=pme NATS_PASSWORD=ci \
	DB_PORT=$(PERF_DB_PORT) NATS_HOST=127.0.0.1 NATS_PORT=$(PERF_NATS_PORT) PORT=$(PERF_API_PORT) \
	IDP_PORT=$(PERF_IDP_PORT) KEYCLOAK_JWKS_URI=http://127.0.0.1:$(PERF_IDP_PORT)/certs sh scripts/perf-ci.sh

# Images Docker : structure (utilisateur non-root, port, contenu) puis vulnerabilites HIGH/CRITICAL.
# Prerequis : container-structure-test et trivy installes, images construites (make image).
image-test:
	@for svc in api moderation frontend; do \
		echo "== pme-$$svc:dev"; \
		container-structure-test test --image pme-$$svc:dev --config tests/image/$$svc.yaml || exit 1; \
		trivy image --severity HIGH,CRITICAL --ignore-unfixed --exit-code 1 pme-$$svc:dev || exit 1; \
	done

# ---- Documentation (MkDocs) ----
# Tout passe par Docker (docker/docs/Dockerfile) : ni Python ni venv a installer sur le poste.
# docs-serve et docs-check utilisent l'etape "deps" (outillage seul) et montent le depot :
# l'apercu tourne meme si un lien est casse, pour pouvoir le corriger.
docs-serve:
	docker build -f docker/docs/Dockerfile --target deps -t pme-docs-deps:dev .
	@( for i in $$(seq 1 90); do curl -s -o /dev/null "$(DOCS_URL)" && { xdg-open "$(DOCS_URL)" 2>/dev/null || open "$(DOCS_URL)" 2>/dev/null; break; }; sleep 1; done ) &
	docker run --rm -it --name pme-docs-serve -p $(DOCS_PORT):8000 -v "$(CURDIR)":/docs pme-docs-deps:dev mkdocs serve -a 0.0.0.0:8000

docs-check:
	docker build -f docker/docs/Dockerfile --target deps -t pme-docs-deps:dev .
	docker run --rm -v "$(CURDIR)":/docs pme-docs-deps:dev mkdocs build --strict --site-dir /tmp/site

docs-image:
	docker build -f docker/docs/Dockerfile -t pme-docs:dev .

docs-run:
	@echo "Documentation : http://localhost:$(DOCS_IMAGE_PORT) (Ctrl+C pour arreter)"
	@( for i in $$(seq 1 90); do curl -s -o /dev/null "$(DOCS_IMAGE_URL)" && { xdg-open "$(DOCS_IMAGE_URL)" 2>/dev/null || open "$(DOCS_IMAGE_URL)" 2>/dev/null; break; }; sleep 1; done ) &
	docker run --rm --name pme-docs-run -p $(DOCS_IMAGE_PORT):8080 pme-docs:dev

# Arrete les conteneurs lances par docs-serve (pme-docs-serve) et docs-run (pme-docs-run).
# Ils sont lances avec --rm : ils disparaissent a l'arret. On les retrouve par leur nom et non par leur image :
# "make docs-serve" reconstruit l'image, ce qui detache le nom pme-docs-deps:dev d'un conteneur deja lance.
docs-stop:
	@ids=$$(docker ps -q --filter 'name=^pme-docs-serve$$' --filter 'name=^pme-docs-run$$'); \
	if [ -n "$$ids" ]; then docker stop $$ids >/dev/null && echo "MkDocs arrete."; else echo "Aucun MkDocs en cours."; fi

# ---- Ouvrir dans le navigateur ----

app:
	@xdg-open "$(APP_URL)" 2>/dev/null || open "$(APP_URL)" 2>/dev/null || echo "Ouvrir : $(APP_URL)"

keycloak:
	@xdg-open "$(KEYCLOAK_URL)" 2>/dev/null || open "$(KEYCLOAK_URL)" 2>/dev/null || echo "Ouvrir : $(KEYCLOAK_URL)"

# Interface web de RabbitMQ, servie par l'ingress (ligne `make hosts` requise). Connexion : RABBITMQ_USER / RABBITMQ_PASSWORD du .env.
rabbitmq:
	@xdg-open "$(RABBITMQ_URL)" 2>/dev/null || open "$(RABBITMQ_URL)" 2>/dev/null || echo "Ouvrir : $(RABBITMQ_URL)"

nats:
	@xdg-open "$(NATS_URL)/jsz?streams=1&consumers=1" 2>/dev/null || open "$(NATS_URL)/jsz?streams=1&consumers=1" 2>/dev/null || echo "Ouvrir : $(NATS_URL)/jsz?streams=1&consumers=1"

adminer:
	@xdg-open "$(ADMINER_URL)" 2>/dev/null || open "$(ADMINER_URL)" 2>/dev/null || echo "Ouvrir : $(ADMINER_URL)"

prometheus:
	@xdg-open "$(PROMETHEUS_URL)/targets" 2>/dev/null || open "$(PROMETHEUS_URL)/targets" 2>/dev/null || echo "Ouvrir : $(PROMETHEUS_URL)/targets"

grafana:
	@xdg-open "$(GRAFANA_URL)" 2>/dev/null || open "$(GRAFANA_URL)" 2>/dev/null || echo "Ouvrir : $(GRAFANA_URL)"

alloy:
	@xdg-open "$(ALLOY_URL)" 2>/dev/null || open "$(ALLOY_URL)" 2>/dev/null || echo "Ouvrir : $(ALLOY_URL)"