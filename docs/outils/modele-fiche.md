# Modèle de fiche outil

Chaque outil du projet a sa fiche, construite sur le même modèle : on y trouve toujours les mêmes informations, au
même endroit. Une fiche tient sur un écran ou deux et se lit sans bagage technique.

## Comment créer une fiche

1. Copier le modèle ci-dessous dans un nouveau fichier, par exemple `docs/outils/rabbitmq.md`.
2. Remplacer les textes en italique par ceux de l'outil. Ne pas changer les titres.
3. Ajouter la page dans le menu (`nav`) du fichier `mkdocs.yml`.
4. Vérifier avec `make docs-check`, puis regarder le résultat avec `make docs-serve`.

## Conseils pour bien rédiger

- Des phrases courtes et simples.
- Une idée par phrase.
- Dans les tableaux des fichiers et des commandes, une seule phrase courte par ligne, sans lien ni code.

!!! tip "Astuce"
Enregistrer le fichier (`Ctrl+S`) : l'aperçu ne se met à jour qu'une fois le fichier écrit sur le disque.

!!! warning "Attention"
Un fichier du dépôt situé hors du dossier `docs/` (par exemple `.gitlab-ci.yml`) se cite par son **adresse GitLab
complète**. Un lien du type `../fichier` fonctionne dans l'éditeur, mais pas dans le site généré.

## Le modèle à copier

```markdown
# Nom de l'outil

## Fiche d'identité

| Information | Détail |
|---|---|
| **Rôle** | *Une ligne : ce que fait l'outil dans le projet* |
| **Version** | *Numéro de version utilisé* |
| **Adresse en local** | *http://localhost:… (ou « aucune »)* |

## Description

*Le descriptif nécessaire.*

## Rôle dans le projet

- *Trois ou quatre puces courtes.*
- *Où il intervient dans le parcours : connexion, dépôt d'une annonce, événement, modération.*
- *Ce qui ne marcherait plus sans lui.*

## Fichiers et dossiers principaux

| Fichier ou dossier | Description |
|---|---|
| `chemin/du/fichier` | *Une phrase courte, sans jargon.* |

## Commandes essentielles

| Commande | Description |
|---|---|
| `make …` | *Une phrase courte, sans jargon.* |

## Pour aller plus loin

- [Documentation officielle](https://exemple.org)
```

!!! note "Les titres ne changent jamais"
Les titres sont les mêmes pour tous les outils : on retrouve toujours les mêmes rubriques au même endroit.

## Les trois encadrés à connaître

À utiliser avec modération : un encadré, c'est une information qu'on ne doit pas rater.

!!! tip "Astuce"
Un raccourci ou une bonne pratique qui fait gagner du temps.

!!! warning "Attention"
Ce qu'il ne faut pas faire, ou ce qui peut faire perdre du travail.

!!! note "À savoir"
Une précision utile pour comprendre, sans conséquence si on la rate.

Dans le fichier Markdown, un encadré s'écrit ainsi (les quatre espaces avant le texte sont obligatoires) :

```markdown
!!! tip "Astuce"
Le texte de l'encadré.
```