# shadcn/ui

## Fiche d'identité

| Information | Détail |
|---|---|
| **Rôle** | Fournit les composants d'interface accessibles du front (bouton, puis modale, menu, onglets) |
| **Version** | Modèle de composants copiés dans le dépôt, sur Radix UI 1.x |
| **Adresse en local** | aucune |

## Description

shadcn/ui n'est pas une bibliothèque installée en bloc. C'est un catalogue de composants React dont le code est copié
dans le dépôt, dans le dossier `frontend/src/components/ui`. Chaque composant s'appuie sur Radix UI, qui gère le clavier,
le focus et les rôles d'accessibilité, et il est stylé avec Tailwind CSS. Le code appartient au projet : on le modifie
librement.

**Définitions**

- **Composant** : élément d'interface réutilisable, comme un bouton ou une fenêtre modale.
- **Radix UI** : bibliothèque de comportements sans style, qui rend les composants accessibles au clavier et aux lecteurs
  d'écran.
- **Jeton de design** : valeur nommée, comme une couleur, déclarée une seule fois et réutilisée partout.
- **Variante** : déclinaison d'un composant, par exemple un bouton principal ou un bouton discret.

## Rôle dans le projet

- Il fournit la base du design system du front, au fur et à mesure des besoins.
- Il reprend les jetons de la palette du projet : l'aspect de l'interface ne change pas.
- Il garantit un comportement accessible pour les composants interactifs (clavier, focus, lecteurs d'écran), comme l'exige le RGAA.
- Pour l'instant, seul le bouton est installé. Les boutons existants (`.btn`, `.btn-ghost`) restent en place et seront
  remplacés progressivement.

## Fichiers et dossiers principaux

| Fichier ou dossier | Description |
|---|---|
| `frontend/components.json` | Indique à l'outil shadcn où écrire les composants et où lire les styles. |
| `frontend/src/components/ui/` | Contient les composants copiés dans le projet. |
| `frontend/src/lib/utils.ts` | Contient `cn`, qui assemble les classes Tailwind sans conflit. |
| `frontend/src/styles.css` | Relie les variables de shadcn/ui aux couleurs du projet. |

## Commandes essentielles

À lancer dans un terminal, depuis le dossier `frontend`.

| Commande | Description |
|---|---|
| `npx shadcn@latest add dialog` | Ajoute le composant « dialog » (fenêtre modale) au projet. |
| `npx shadcn@latest add --help` | Liste les options de l'outil. |
| `npm test` | Lance les tests, dont le contrôle des contrastes de la palette. |

!!! tip "Astuce"
Après un ajout, relire le fichier créé dans `src/components/ui` et remplacer les couleurs codées en dur par les
jetons du projet, par exemple `bg-blood`. L'outil génère parfois des teintes neutres par défaut.

!!! note "À savoir"
Les couleurs restent définies dans le bloc `@theme` de `src/styles.css`. Le test `src/theme.test.ts` les contrôle. Toute
nouvelle association de couleurs utilisée par un composant doit y être ajoutée.

## Pour aller plus loin

- [Site officiel de shadcn/ui](https://ui.shadcn.com/)
- [Documentation de Radix UI](https://www.radix-ui.com/)