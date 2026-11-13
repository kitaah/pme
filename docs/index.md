# La Petite Maison de l'Épouvante — POC

Documentation technique d'une place de marché d'objets d'épouvante entre particuliers. Un membre y dépose une
annonce ; un service séparé la reçoit par message et la range dans une file que des modérateurs examinent.

Ce POC sert à éprouver une chaîne complète sur un poste de développement : une interface React, deux services NestJS
qui communiquent par NATS, des identités gérées par Keycloak, le tout déployé dans un cluster Kubernetes local,
chiffré de bout en bout et contrôlé par une pipeline d'intégration continue.

## Par où commencer

| Page | Ce qu'on y trouve |
|---|---|
| **[Architecture](architecture.md)** | La vue d'ensemble : les composants, qui parle à qui, et le trajet d'une annonce de bout en bout. À lire en premier. |
| **[Outils](outils/mkdocs.md)** | Une fiche par outil du projet, toutes construites sur le même modèle. |
| **[Pipeline CI/CD](pipeline/index.md)** | Les contrôles automatiques de qualité : tests, images Docker, performance, analyse du code. |
| **[Sécurité](securite/index.md)** | Les mesures de sécurité de la plateforme, couche par couche, et leurs limites. |
| **[Modèle de fiche outil](outils/modele-fiche.md)** | Le modèle à suivre pour documenter un nouvel outil. |

## En bref

| | |
|---|---|
| **Interface** | React 19, Vite, shadcn/ui |
| **Services** | NestJS 12 — une API et un service de modération |
| **Messagerie** | NATS JetStream |
| **Données** | PostgreSQL 18, accédé par TypeORM |
| **Identités** | Keycloak 26 |
| **Plateforme** | Minikube, Traefik, Istio en mode ambient, Calico |
| **Observabilité** | Prometheus, Grafana, Loki, Alloy |
| **Qualité** | 201 tests unitaires, 27 d'intégration, couverture 100 %, Quality Gate SonarCloud |
