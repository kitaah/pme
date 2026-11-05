# MkDocs

## Fiche d'identité

| Information | Détail |
|---|---|
| **Rôle** | Transforme les pages de documentation du projet en un site web consultable par tous |
| **Version** | MkDocs 1.6.1 avec le thème Material 9.7.7 |
| **Adresse en local** | <http://localhost:8000> (aperçu en direct) et <http://localhost:8083> (site final) |

## Description

MkDocs transforme des fichiers texte (Markdown) en site web, avec un menu et une barre de recherche. Material est le
thème qui règle l'apparence du site.

## Rôle dans le projet

- Toute l'équipe lit la même documentation.
- Elle est rangée avec le code.
- Chaque modification passe par Git : on sait qui a changé quoi.
- Un lien cassé ou une page oubliée bloque la validation.
- Le site est livré dans une image Docker.

## Fichiers et dossiers principaux

| Fichier ou dossier | Description |
|---|---|
| `mkdocs.yml` | Configuration du site : titre, couleurs, menu. |
| `docs/` | Les pages de la documentation, une par fichier. |
| `docs/stylesheets/extra.css` | Couleurs et style des tableaux. |
| `requirements-docs.txt` | Versions exactes de MkDocs et du thème. |
| `Dockerfile.docs` | Fabrique l'image Docker du site. |
| `nginx-docs.conf` | Configuration du serveur qui affiche le site. |
| `Makefile` | Les commandes de la documentation. |

## Commandes essentielles

À lancer dans un terminal, depuis le dossier du projet, Docker démarré. `Ctrl+C` arrête une commande en cours.

| Commande | Description |
|---|---|
| `make docs-serve` | Affiche le site et le met à jour à chaque enregistrement. |
| `make docs-check` | Vérifie qu'il n'y a ni lien cassé ni page oubliée. |
| `make docs-image` | Fabrique la version finale du site. |
| `make docs-run` | Affiche la version finale du site. |

## Pour aller plus loin

- [Documentation officielle de MkDocs](https://www.mkdocs.org/)
- [Documentation du thème Material](https://squidfunk.github.io/mkdocs-material/)
- [Aide-mémoire Markdown](https://www.markdownguide.org/cheat-sheet/)