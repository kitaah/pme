# Qualité logicielle : attributs visés et contrôles dans la chaîne CI/CD

Référentiel : ISO/IEC 25010. Chaque attribut est relié à un contrôle outillé et à l'étape du pipeline
([`.gitlab-ci.yml`](../.gitlab-ci.yml), brouillon) qui le vérifie. Les mêmes contrôles se lancent en local via le Makefile.

## 1. Attributs de qualité retenus

| Attribut | Pourquoi pour la Petite Maison de l'Épouvante | Exigence mesurable |
|---|---|---|
| **Sécurité** | Comptes de membres, annonces modérées, rôles `membre` / `moderateur` | JWT RS256 vérifié par JWKS, 403 sans rôle, aucun secret versionné, aucune CVE CRITICAL, images non-root |
| **Fiabilité** | Une annonce déposée ne doit jamais être perdue, même service de modération arrêté | File RabbitMQ durable + ack manuel + DLQ, traitement idempotent, compensation si publication impossible |
| **Maintenabilité** | Deux services symétriques + front, équipe qui change | Complexité cyclomatique ≤ 10, cognitive ≤ 15, code formaté, TypeScript strict, duplication surveillée par Sonar |
| **Performance** | Dépôt d'annonce réactif, indépendant de la modération (découplage) | k6 : p95 < seuil défini dans `tests/performance`, taux d'erreur < 1 % |
| **Testabilité** | Chaque comportement doit être vérifiable sans cluster | Tests unitaires + intégration (Testcontainers), seuils de couverture |
| **Portabilité / déployabilité** | Même livrable du poste de dev à Minikube | Images Docker multi-étapes, manifestes validés (kustomize + kubeconform), config par variables d'environnement, accès en HTTP par `kubectl port-forward` (aucun prérequis système) |
| **Accessibilité** | Site grand public, ouvert à tous les membres | WCAG 2.1 AA / RGAA 4 : texte ≥ 4.5:1 (1.4.3), composants d'interface ≥ 3:1 (1.4.11), statut jamais porté par la seule couleur (1.4.1), focus visible (2.4.7), libellés associés aux champs, messages annoncés (`role="alert"`, `aria-live`) |

> À aligner avec le texte du sujet : si le contexte insiste sur un autre attribut (conformité RGPD des données
> membres, disponibilité), l'ajouter ici avec son contrôle.

## 2. Étapes de qualité dans le pipeline

| Étape | Job | Outil | Commande locale | Attribut | Bloquant |
|---|---|---|---|---|---|
| quality | lint-code | ESLint + typescript-eslint, règles `complexity` (≤ 10) et `sonarjs/cognitive-complexity` (≤ 15), `tsc --noEmit` strict | `make lint` | Maintenabilité | oui |
| quality | format | Prettier, les 3 applications plus les scénarios k6 et la config du front (+ `prettier-plugin-tailwindcss` : ordre des classes Tailwind) | `make format-check` | Maintenabilité | oui |
| quality | lint-yaml | yamllint (manifestes K8s, tests d'image, pipeline) | `make lint-yaml` | Maintenabilité, portabilité | oui |
| quality | lint-dockerfile | hadolint | `make lint-docker` | Sécurité, portabilité | oui |
| quality | lint-k8s | kustomize build + kubeconform (`-strict`) | `make lint-k8s` | Portabilité | oui |
| quality | secrets-scan | gitleaks | `make secrets-scan` | Sécurité | oui |
| quality | dependency-audit | npm audit (échec sur CRITICAL) | `make audit` | Sécurité | oui |
| test | unit-tests | Jest / Vitest + couverture lcov, seuils minimaux | `make coverage` | Testabilité, fiabilité | oui |
| test | unit-tests | Contrastes de la palette : 26 assertions lues directement dans `styles.css` | `make test` | Accessibilité | oui |
| test | sonar | SonarCloud (bugs, code smells, duplication, hotspots, couverture, porte qualité) | `make sonar` | Maintenabilité, sécurité | non (au début) |
| integration | integration-tests | Jest + Testcontainers (PostgreSQL, RabbitMQ) | `make test-integration` | Fiabilité | oui |
| build | image-structure | container-structure-test (utilisateur non-root, port, absence de sources) | `make image-test` | Sécurité, portabilité | oui |
| scan | trivy-images | Trivy (HIGH/CRITICAL, `--ignore-unfixed`) | `make image-test` | Sécurité | oui |
| perf | perf-k6 | k6 (charge, découplage) | `make perf-prepare` puis `make perf` | Performance | non (manuel) |

Ordre voulu : les contrôles les plus rapides et les moins chers d'abord (qualité statique, en parallèle), puis
les tests, puis les images, puis la performance.

Deux réserves sur l'étape `perf` : le pipeline n'a pas d'étape de déploiement, donc le job `perf-k6` est en
déclenchement **manuel** et vise une application déjà en service (`APP_URL` et `KEYCLOAK_URL` en variables CI/CD).
En local, `make perf-prepare` doit précéder `make perf` : il relève la limite de débit de l'API, sinon le scénario
de charge se fait refuser en 429 et échoue sur son seuil d'erreurs.

## 3. Sonar (SonarCloud)

Le dépôt GitLab `pme` est analysé par **SonarCloud**, organisation `kitaah`, projet `kitaah_pme`. La configuration
est versionnée dans [`sonar-project.properties`](../sonar-project.properties) ; l'analyse est lancée par le job
`sonar` du pipeline (image `sonarsource/sonar-scanner-cli`).

- **Rôle** : Sonar est le contrôle de maintenabilité *global* (duplication, code smells, hotspots de sécurité, dette,
  porte qualité). Il **complète** ESLint, qui bloque tôt et vite dans l'IDE comme dans le pipeline, il ne le remplace pas.
- **Ne couvre pas** : YAML, Dockerfile, manifestes K8s, secrets, dépendances, images : d'où les autres jobs.
- **Périmètre** : les trois modules TypeScript (API NestJS, service de modération, front React en TSX) dans un seul
  projet Sonar. Couverture lue dans les rapports lcov de Jest et Vitest, produits par le job `unit-tests` et transmis
  en artefacts au job `sonar`. `sonar.qualitygate.wait=true` rend le verdict visible dans le job.
- **Nouveau code** : `GIT_DEPTH: "0"` donne à Sonar l'historique complet, nécessaire au calcul du « nouveau code » et
  du blame. Le cache de l'analyseur (`.sonar/cache`) est conservé entre deux pipelines.
- **Bloquant ?** Non au démarrage (`allow_failure: true`) : la porte qualité par défaut s'applique au « nouveau code »
  et il faut d'abord stabiliser une base. À passer en bloquant une fois le seuil réglé.
- **Dans l'IDE** : SonarQube for IDE (ex-SonarLint) en *mode connecté* sur le projet `kitaah_pme` applique le même
  profil qualité que la CI. La liaison est partagée par [`.sonarlint/connectedMode.json`](../.sonarlint/connectedMode.json)
  (aucun secret : chaque membre de l'équipe garde son propre jeton dans son IDE).
- **Prérequis hors dépôt** :
  1. Sur SonarCloud, importer le dépôt GitLab `pme` dans l'organisation `kitaah` (clé `kitaah_pme`).
  2. Désactiver l'*Automatic Analysis* (Administration → Analysis Method) : elle est incompatible avec l'analyse
     lancée par la CI et ne lit pas la couverture.
  3. Dans GitLab (Settings → CI/CD → Variables) : `SONAR_TOKEN` (masquée) et `SONAR_HOST_URL` = `https://sonarcloud.io`.

## 4. Secrets : où s'arrête le POC

Attribut concerné : **sécurité**. Trois règles tenues dans ce dépôt, et une quatrième renvoyée à la production.

| Règle | Comment elle est tenue | Vérifiée par |
|---|---|---|
| Aucun mot de passe versionné | Le Secret Kubernetes `pme-secrets` est créé à la volée par `make secrets` depuis un `.env` local, jamais commité. Seul `.env.example` est versionné, avec des valeurs de démonstration. | `make secrets-scan` (gitleaks), job `secrets-scan` |
| Aucun mot de passe affiché | Les recettes `secrets` et `dev-*` du Makefile sont préfixées `@` : les valeurs ne passent ni par le terminal ni par les journaux de la CI. | Relecture |
| Aucun mot de passe dans l'image | `.dockerignore` exclut `.env` des trois images. | `make image-test` |
| Secret chiffré dans Git | **Non fait.** Le projet Spring utilisait Sealed Secrets (`kubeseal`) ; ce POC ne les reprend pas. | — |

Ce choix est assumé : chiffrer le Secret dans Git répond au besoin « déployer depuis la CI/CD sans transporter de
mot de passe », or le POC se déploie à la main depuis le poste. Le jour où le pipeline déploiera, deux options :
Sealed Secrets (contrôleur dans le cluster, secret chiffré versionné) ou un gestionnaire externe (Vault, External
Secrets Operator). L'expérimentation existe dans le projet Spring : `docs/experimentation-secrets-management.md`.

Les mots de passe de démonstration (utilisateurs `membre` et `moderateur`, client `pme-cli`) n'ont de valeur que
dans ce POC et sont documentés comme tels dans le README.

## 5. Seuils et limites connues

- Seuils de couverture unitaire volontairement bas (api/moderation ≥ 40 % lignes, front ≥ 50 %), car les contrôleurs et
  les flux critiques sont couverts par l'intégration. Ils servent de garde-fou, pas d'objectif. Sonar affichera la couverture
  réelle ; à relever avec le nombre de tests.
- `npm audit` : `multer` (HIGH, déni de service sur l'upload de fichiers) est une dépendance transitive de
  `@nestjs/platform-express`. Le POC n'expose aucun upload : risque non applicable, correctif à prendre avec la prochaine
  montée de version de NestJS. Le pipeline bloque donc sur CRITICAL uniquement.
- Vérifié en local : ESLint, tsc, Prettier, yamllint, hadolint, kustomize + kubeconform, gitleaks, tests unitaires +
  couverture, construction du front, rendu de l'interface (bureau et mobile), conformité WCAG/RGAA de la palette
  (26 assertions automatisées), syntaxe et en-têtes HTTP de la configuration nginx.
  **Non exécutés** : SonarCloud (projet à créer), pipeline GitLab lui-même, tests d'intégration/image/k6 dans ce pipeline.