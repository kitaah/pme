# MkDocs

## Fiche d'identité

| Information | Détail |
|---|---|
| **Rôle** | Transforme les pages de documentation du dépôt en un site web consultable, avec menu et recherche |
| **Version** | MkDocs 1.6.1, thème Material 9.7.7, extension D2 pour les schémas |
| **Adresse en local** | <http://localhost:8005> pour l'aperçu, <http://localhost:8083> pour le site final |

## Description

MkDocs est un générateur de site statique open source. Il lit des fichiers écrits en **Markdown** et produit un site
web complet : pages mises en forme, menu de navigation et moteur de recherche.

**Pourquoi la documentation vit dans le dépôt.**
Une documentation rangée ailleurs — un partage de fichiers, un outil en ligne — se désynchronise du code en quelques
semaines. Ici, elle est versionnée avec lui : une modification passe par Git, elle est relue comme du code, et
l'historique indique qui a changé quoi. Une page qui décrit une commande est modifiée dans le même commit que la
commande elle-même.

**Du texte au site web.**
MkDocs assemble les fichiers du dossier `docs/` selon le menu déclaré dans `mkdocs.yml`, applique le thème et produit
un ensemble de pages HTML. Deux usages en découlent : un aperçu local qui se met à jour à chaque enregistrement, et
une image Docker qui contient le site terminé.

```d2
vars: {
  d2-config: {
    layout-engine: elk
    theme-id: 5
    pad: 8
  }
}
direction: right

# Mise en forme commune : texte lisible à la largeur de la page, angles arrondis
classes: {
  boite: {
    style: {
      font-size: 24
      border-radius: 12
    }
  }
}

sources: "Fichiers Markdown\net mkdocs.yml" {class: boite}
mkdocs: "MkDocs\nassemble et met en forme" {class: boite}
apercu: "Aperçu local\nmake docs-serve" {class: boite}
image: "Image Docker\nmake docs-image" {class: boite}

sources -> mkdocs
mkdocs -> apercu
mkdocs -> image
```

**Le thème Material apporte la lisibilité.**
Il fournit le menu latéral, la recherche instantanée, les tableaux lisibles et les encadrés d'avertissement. Le projet
y ajoute une feuille de style qui fixe la police, la taille du texte et la justification des paragraphes, afin que
toutes les fiches aient le même aspect.

**Les schémas sont dessinés à la construction.**
Les schémas des fiches sont écrits en **D2**, un langage où l'on décrit les boîtes et les flèches sous forme de texte.
L'extension correspondante les transforme en images pendant la construction du site. Un schéma se relit donc comme du
code, se compare d'une version à l'autre et ne demande aucun logiciel de dessin.

**La construction est stricte.**
Le site est construit en mode strict : un lien interne cassé ou une page absente du menu interrompt la construction au
lieu de produire un site muet sur le problème. La même vérification est disponible avant de pousser, avec
`make docs-check`.

**Définitions**

| Terme | Définition |
|---|---|
| **D2** | Langage de description de schémas : on écrit les boîtes et les flèches, l'outil calcule la mise en page. |
| **Générateur de site statique** | Programme qui transforme des fichiers texte en pages HTML, sans base de données ni code côté serveur. |
| **Markdown** | Format de texte simple, où quelques signes suffisent à écrire un titre, une liste ou un tableau. |
| **Mode strict** | Réglage qui transforme en erreur tout avertissement, par exemple un lien cassé. |
| **Thème** | Ensemble de gabarits et de styles qui donne son apparence au site. |

## Rôle dans le projet

- Il donne à toute l'équipe une documentation unique, lisible dans un navigateur.
- Il garde cette documentation dans le dépôt, donc à jour avec le code et relue comme lui.
- Il empêche la publication d'un site comportant un lien cassé ou une page oubliée.
- Il produit une image Docker autonome, qui permet de servir la documentation comme n'importe quel autre composant.
- Sans lui, les fiches resteraient des fichiers texte, sans menu, sans recherche ni schémas.

La documentation est organisée en trois ensembles :

| Ensemble | Contenu |
|---|---|
| **Accueil** | Présentation du projet et de son architecture. |
| **Outils** | Une fiche par outil, toutes construites sur le même modèle. |
| **Pipeline CI/CD** | Les contrôles automatiques : exigences, fonctionnement et une page par famille de contrôles. |

!!! note "À savoir"
    Une version 2.0 de MkDocs est annoncée, qui supprimerait le système d'extensions sur lequel repose le thème
    Material, sans chemin de migration prévu. Le site n'en est pas affecté : les versions sont figées dans
    `docker/docs/requirements.txt`. Le sujet devra être réexaminé, mais il ne concerne que l'outillage, puisque les
    pages resteront du Markdown.

## Fichiers et dossiers principaux

| Fichier ou dossier | Description |
|---|---|
| **`mkdocs.yml`** | Configuration du site : titre, thème, extensions et menu. |
| **`docs/`** | Les pages de la documentation, une par fichier. |
| **`docs/stylesheets/extra.css`** | Police, taille du texte, tableaux et encadrés propres au projet. |
| **`docs/assets/fonts/`** | La police du site, fournie avec le dépôt plutôt que chargée depuis Internet. |
| **`docker/docs/requirements.txt`** | Fige les versions de MkDocs, du thème et des extensions. |
| **`docker/docs/Dockerfile`** | Fabrique l'image du site et installe l'outil de schémas D2. |
| **`docker/docs/nginx.conf`** | Configure le serveur qui sert le site de l'image. |

## Commandes essentielles

À lancer dans un terminal, depuis le dossier du projet, Docker démarré. `Ctrl+C` arrête une commande en cours.

| Commande | Description |
|---|---|
| **`make docs-serve`** | Ouvre l'aperçu du site et le met à jour à chaque enregistrement d'un fichier. |
| **`make docs-check`** | Vérifie qu'aucun lien n'est cassé et qu'aucune page n'est absente du menu. |
| **`make docs-image`** | Construit l'image Docker du site terminé. |
| **`make docs-run`** | Ouvre le site de l'image, tel qu'il sera livré. |
| **`make docs-stop`** | Arrête l'aperçu ou le site lancé précédemment. |

Pour ajouter une fiche :

1. Créer le fichier dans `docs/outils/`, à partir du [modèle de fiche](modele-fiche.md).
2. Ajouter la page au menu, dans `mkdocs.yml`.
3. Vérifier avec `make docs-check`, puis relire le rendu avec `make docs-serve`.

!!! warning "Attention"
    Un fichier du dépôt situé hors du dossier `docs/`, comme `.gitlab-ci.yml`, ne peut pas être lié par un chemin
    relatif : le lien fonctionnerait dans l'éditeur, mais pas dans le site. Il faut le citer par son adresse GitLab
    complète.

!!! tip "Astuce"
    L'aperçu ne se rafraîchit qu'une fois le fichier écrit sur le disque : penser à enregistrer avant de regarder le
    navigateur.

## Pour aller plus loin

- [Documentation de MkDocs](https://www.mkdocs.org/)
- [Documentation du thème Material](https://squidfunk.github.io/mkdocs-material/)
- [Documentation du langage D2](https://d2lang.com/)
- [Aide-mémoire Markdown](https://www.markdownguide.org/cheat-sheet/)
