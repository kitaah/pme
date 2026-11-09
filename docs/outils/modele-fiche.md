# Modèle de fiche outil

Chaque outil du projet a sa fiche, construite sur le même modèle : les mêmes rubriques, toujours dans le même ordre.
Une fiche doit pouvoir être lue par une personne sans bagage technique : elle explique d'abord à quoi sert l'outil et
quel problème il résout, avant d'entrer dans les détails du projet.

## Les six rubriques

Les titres ne changent jamais d'une fiche à l'autre.

| Rubrique | Ce qu'on y met |
|---|---|
| **Fiche d'identité** | Un tableau de trois à cinq lignes : rôle, version, adresse en local, et toute information d'emblée utile. |
| **Description** | Le cœur de la fiche : ce qu'est l'outil, le problème qu'il résout, comment il fonctionne, et un tableau de définitions à la fin. |
| **Rôle dans le projet** | Ce que l'outil fait ici, concrètement, et ce qui ne fonctionnerait plus sans lui. |
| **Fichiers et dossiers principaux** | Un tableau des fichiers à connaître, avec une phrase par ligne. |
| **Commandes essentielles** | Un tableau des commandes, puis, si l'ordre compte, une liste numérotée. |
| **Pour aller plus loin** | Deux à quatre liens : site officiel, documentation, fiches liées du projet. |

## Comment rédiger la description

C'est la partie qui distingue une fiche utile d'une fiche creuse. Elle se construit en paragraphes courts, chacun
introduit par une phrase en gras qui annonce son sujet, sur le modèle de **Pourquoi un broker ?** ou
**Le chiffrement s'arrête à l'ingress.**

L'enchaînement qui fonctionne le mieux est le suivant :

1. **Ce qu'est l'outil**, en une phrase, avec le mot « open source » s'il l'est.
2. **Le problème qu'il résout.** C'est le paragraphe le plus important : sans lui, le lecteur apprend ce que fait
   l'outil sans comprendre pourquoi il existe.
3. **Comment il fonctionne**, avec un schéma si le sujet s'y prête.
4. **Ce qui mérite d'être souligné** : un choix du projet, une limite assumée, un piège courant.
5. **Les définitions**, sous forme de tableau, classées par ordre alphabétique.

Quelques règles de vocabulaire valables partout :

- Expliquer chaque terme technique à sa première apparition, ou le renvoyer au tableau de définitions.
- Écrire « ordinateur » plutôt que « poste de travail », « open source » plutôt que « libre ».
- Préférer une phrase simple à une phrase savante, sans pour autant appauvrir le propos : une fiche peut être longue
  si chaque paragraphe apprend quelque chose.
- Renvoyer aux autres fiches par un lien, plutôt que de répéter leur contenu.

!!! tip "Astuce"
    Le test de relecture : une personne qui ne connaît pas l'outil doit pouvoir expliquer, après lecture, à quoi il
    sert et pourquoi le projet l'utilise. Si ce n'est pas le cas, c'est le paragraphe « problème résolu » qui manque.

## Les tableaux

Tous les tableaux suivent les mêmes règles de forme, pour que la colonne de gauche se lise de la même façon partout.

- **La colonne de gauche est toujours en gras.** Pour une commande ou un chemin de fichier, le gras s'ajoute au code :
  `` **`make deploy`** ``.
- **Une cellule trop longue passe à la ligne.** Au-delà d'environ quarante caractères, la commande ou le chemin se coupe
  avec `<br>`, en deux ou trois lignes, chacune en gras et en code. Un chemin se coupe après une barre oblique, une
  commande avant une option ou avant un tube (`|`).
- **Un élément par ligne.** Quand une cellule cite plusieurs fichiers ou commandes, chacun a sa propre ligne, au lieu
  d'être séparé par « et » ou par une virgule.

```markdown
| Fichier ou dossier | Description |
|---|---|
| **`moderation-service/src/moderation/`**<br>**`moderation.service.spec.ts`** | Une phrase. |
| **`k8s/04-api.yaml`**<br>**`k8s/05-moderation.yaml`** | Une phrase. |
```

## Les schémas

Les schémas sont écrits en [D2](https://d2lang.com/), directement dans la page : l'extension de MkDocs les transforme
en images à la construction du site. Un schéma n'est justifié que s'il montre quelque chose qu'un paragraphe
expliquerait mal : un enchaînement d'étapes, un emboîtement, une comparaison.

Tous les schémas commencent par le même en-tête, qui fixe le moteur de mise en page, le thème et la taille du texte :

````markdown
```d2
vars: {
  d2-config: {
    layout-engine: elk
    theme-id: 5
    pad: 8
  }
}
direction: right

classes: {
  boite: {
    style: {
      font-size: 24
      border-radius: 12
    }
  }
}

premier: "Première étape" {class: boite}
second: "Seconde étape" {class: boite}

premier -> second
```
````

Trois points d'attention :

- **La largeur.** Un schéma trop large devient illisible une fois réduit à la largeur de la page. Au-delà de cinq
  boîtes à la suite, il vaut mieux raccourcir les textes ou repenser le découpage.
- **Les conteneurs.** Pour un conteneur imbriqué dans un autre, `label.near: bottom-left` place proprement son titre.
  Pour un conteneur de premier niveau, laisser le titre à sa place par défaut : sinon, un titre long déborde de
  l'image.
- **Les comparaisons.** `grid-columns` range les éléments en colonnes régulières, ce qui convient mieux qu'un
  enchaînement de flèches pour opposer deux approches.

## Les encadrés

Trois encadrés seulement, à utiliser avec parcimonie : un encadré signale une information qu'on ne doit pas rater.

Chaque fiche en contient les trois types, avec ces titres exacts. Le titre ne se personnalise pas : c'est lui qui donne
au lecteur le réflexe de reconnaître le type d'information. Les encadrés « À savoir » se placent dans la rubrique
**Rôle dans le projet**, les encadrés « Attention » puis « Astuce » à la fin de **Commandes essentielles**, dans cet
ordre.

!!! note "À savoir"
    Une précision utile pour comprendre, sans conséquence si on la rate.

!!! warning "Attention"
    Ce qu'il ne faut pas faire, ou ce qui peut faire perdre du travail.

!!! tip "Astuce"
    Un raccourci ou une bonne pratique qui fait gagner du temps.

Dans le fichier Markdown, un encadré s'écrit ainsi. Les quatre espaces devant le texte sont obligatoires : sans eux,
le texte sort de l'encadré.

```markdown
!!! tip "Astuce"
    Le texte de l'encadré.
```

## Les pages de la pipeline

Les pages du dossier `docs/pipeline/` suivent le même esprit que les fiches d'outils : une **fiche d'identité** (rôle,
job, outils, déclencheur), une **description** qui explique d'abord le problème résolu, un schéma D2 quand il aide, un
tableau de **définitions**, puis les rubriques propres à un contrôle (*Ce qui est vérifié*, *Quand il se lance*,
*Où voir le résultat*). Les trois encadrés et leurs titres sont les mêmes que dans les fiches.

## Les pages de la sécurité

Les pages du dossier `docs/securite/` suivent la même trame, avec deux rubriques propres à la sécurité :
**Ce qui est en place** décrit les mesures, et **Ce qui n'est pas couvert** énonce sans détour les écarts avec un
environnement de production. Cette seconde rubrique n'est jamais vide : une page de sécurité qui ne nomme aucune limite
n'est pas rassurante, elle est incomplète.

## Créer une nouvelle fiche

1. Créer le fichier dans `docs/outils/`, par exemple `docs/outils/rabbitmq.md`.
2. Reprendre les six rubriques ci-dessus, dans l'ordre, sans en changer les titres.
3. Ajouter la page au menu, dans `mkdocs.yml`, à sa place alphabétique.
4. Vérifier avec `make docs-check`, qui refuse un lien cassé ou une page absente du menu.
5. Relire le rendu avec `make docs-serve`, en particulier les schémas et les tableaux.

!!! warning "Attention"
    Un fichier du dépôt situé hors du dossier `docs/`, comme `.gitlab-ci.yml`, se cite par son adresse GitLab
    complète. Un lien du type `../fichier` fonctionne dans l'éditeur, mais pas dans le site généré.

## Le squelette à copier

```markdown
# Nom de l'outil

## Fiche d'identité

| Information | Détail |
|---|---|
| **Rôle** | *Une ligne : ce que l'outil fait dans le projet* |
| **Version** | *Numéro de version utilisé* |
| **Adresse en local** | *http://localhost:… ou « Aucune »* |

## Description

*Ce qu'est l'outil, en une phrase.*

**Le problème qu'il résout.**
*Ce qui se passerait sans lui.*

**Comment il fonctionne.**
*Le mécanisme, avec un schéma si nécessaire.*

**Définitions**

| Terme | Définition |
|---|---|
| **Terme** | *Définition en une phrase.* |

## Rôle dans le projet

- *Ce qu'il fait ici, concrètement.*
- *Les choix du projet et leurs raisons.*
- *Ce qui ne fonctionnerait plus sans lui.*

## Fichiers et dossiers principaux

| Fichier ou dossier | Description |
|---|---|
| **`chemin/du/fichier`** | *Une phrase.* |

## Commandes essentielles

| Commande | Description |
|---|---|
| **`make …`** | *Une phrase.* |

## Pour aller plus loin

- [Documentation officielle](https://exemple.org)
```
