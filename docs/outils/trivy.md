# Trivy

## Fiche d'identité

| Information | Détail |
|---|---|
| **Rôle** | Cherche les failles de sécurité connues dans les images Docker avant leur livraison |
| **Version** | Trivy 0.71.2 |
| **Adresse en local** | aucune |

## Description

Trivy est un outil libre d'analyse de sécurité, édité par Aqua Security. Il lit la liste des paquets installés dans une
image Docker. Il la compare à une base publique de failles connues, mise à jour régulièrement. Il affiche alors chaque
faille avec sa gravité et la version qui la corrige. Dans la pipeline, Trivy ne cherche que les failles des paquets.

**Définitions**

- **Faille (CVE)** : défaut de sécurité public, repéré par un identifiant du type `CVE-2026-00000`.
- **Gravité** : niveau de risque d'une faille : faible, moyen, HIGH (élevé) ou CRITICAL (critique).
- **Faille corrigeable** : faille pour laquelle l'éditeur a déjà publié un correctif.
- **Base de vulnérabilités** : liste publique des failles connues, que Trivy télécharge avant d'analyser.
- **Exception** : faille que l'équipe accepte pour un temps limité, avec une date d'expiration.

## Rôle dans le projet

- Il analyse les trois images : API, modération et interface.
- Il analyse aussi les dépendances des trois modules, devDependencies comprises.
- Il bloque la pipeline si une faille HIGH ou CRITICAL est corrigeable.
- Il ignore les failles sans correctif, sur lesquelles l'équipe ne peut rien faire.
- Il conserve un rapport JSON par image, pour garder la trace de chaque analyse.
- Sans lui, une image pourrait partir en production avec une faille connue et déjà corrigée.

## Fichiers et dossiers principaux

| Fichier ou dossier | Description |
|---|---|
| `.trivyignore` | Liste les exceptions : un identifiant de faille et une date d'expiration. |
| `.gitlab-ci.yml` | Définit les analyses dans les jobs `image-tests` et `dependency-scan`. |
| `docker-bake.hcl` | Décrit la construction des images analysées. |
| `api/Dockerfile` | Fabrique l'image de l'API. |
| `moderation-service/Dockerfile` | Fabrique l'image de la modération. |
| `frontend/Dockerfile` | Fabrique l'image de l'interface. |

## Commandes essentielles

À lancer dans un terminal, depuis le dossier du projet, Docker et Minikube démarrés.

| Commande | Description |
|---|---|
| `make image` | Construit les images à analyser. |
| `make image-test` | Contrôle la structure puis les failles des trois images. |
| `trivy image --severity HIGH,CRITICAL --ignore-unfixed pme-api:dev` | Analyse l'image de l'API seule. |
| `trivy fs --scanners vuln --include-dev-deps --ignore-unfixed api` | Analyse les dépendances de l'API, devDependencies comprises. |

!!! warning "Attention"
    Une exception du fichier `.trivyignore` doit toujours avoir une date d'expiration et un commentaire de justification.
    Passé cette date, elle ne s'applique plus et la pipeline échoue de nouveau.

!!! tip "Astuce"
    Pour corriger une faille, mettre à jour l'image de base ou la dépendance concernée, puis reconstruire l'image. Le
    rapport indique la version corrigée.

!!! note "À savoir"
    Dans la pipeline, Trivy ne cherche ni les secrets ni les erreurs de configuration. Les secrets oubliés sont cherchés par SonarCloud et, sur le
    poste, par gitleaks.

## Pour aller plus loin

- [Site officiel de Trivy](https://trivy.dev/)
- [Documentation officielle](https://trivy.dev/latest/docs/)
- [Fiche container-structure-test du projet](container-structure-test.md)
