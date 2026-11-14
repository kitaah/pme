# shadcn/ui

## Fiche d'identité

| Information | Détail |
|---|---|
| **Rôle** | Fournit les composants d'interface accessibles du front-end : le bouton aujourd'hui, puis la fenêtre modale, le menu et les onglets |
| **Version** | Aucune : le code des composants est copié dans le dépôt. Il s'appuie sur Radix UI 1.x |
| **Adresse en local** | Aucune |

## Description

shadcn/ui est un **catalogue de composants** React, publié en open source. Il se distingue d'une bibliothèque classique
par sa manière d'être utilisé : on n'installe rien, on copie le code du composant souhaité dans son propre dépôt.

**Installer ou copier : quelle différence ?**
Une bibliothèque classique s'installe comme une dépendance : son code reste dans le dossier `node_modules`, mis à jour
par `npm`, et on ne le modifie pas. Avec shadcn/ui, une commande récupère le fichier du composant et l'écrit dans le
projet, ici dans `frontend/src/components/ui`. Ce fichier appartient dès lors à l'équipe : il est versionné dans Git,
relu comme n'importe quel autre fichier et modifiable sans contrainte.

```d2
vars: {
  d2-config: {
    layout-engine: elk
    theme-id: 5
    pad: 8
  }
}
# Mise en forme commune : texte lisible à la largeur de la page, angles arrondis
classes: {
  boite: {
    style: {
      font-size: 24
      border-radius: 12
    }
  }
}

# Deux colonnes côte à côte, chacune de trois lignes
comparaison: "" {
  grid-columns: 2
  style.opacity: 0

  classique: "Bibliothèque classique" {
    grid-rows: 3
    class: boite
    emplacement: "Code dans node_modules" {class: boite}
    maj: "Mise à jour par npm" {class: boite}
    modif: "Personnalisation limitée" {class: boite}
  }

  shadcn: "shadcn/ui" {
    grid-rows: 3
    class: boite
    emplacement2: "Code dans le dépôt du projet" {class: boite}
    maj2: "Copié une fois, puis relu" {class: boite}
    modif2: "Modifiable librement" {class: boite}
  }
}
```

Ce choix a une contrepartie : aucune mise à jour n'arrive automatiquement. C'est acceptable pour un projet qui installe
peu de composants et préfère maîtriser leur apparence.

**Trois éléments pour un composant.**
Chaque composant copié combine :

- **Radix UI**, qui fournit le comportement sans aucun style : gestion du clavier, déplacement du focus, rôles
  d'accessibilité attendus par les lecteurs d'écran. C'est la partie la plus difficile à écrire correctement, et celle
  que l'équipe n'a pas à refaire.
- **Tailwind CSS**, qui fournit l'apparence, à partir des jetons de couleur déclarés dans le projet.
- **Les variantes**, qui déclinent un même composant selon son usage : un bouton principal, un bouton discret, un
  bouton à bordure.

**Un composant accessible dès le départ.**
Un bouton écrit à la main oublie souvent un détail : il ne réagit pas à la touche Entrée, le focus reste invisible, ou
le lecteur d'écran n'annonce pas son état. Radix UI traite ces cas, ce qui aide le projet à satisfaire les exigences du
RGAA sans multiplier les corrections.

**L'apparence reste celle du projet.**
Les composants récupérés arrivent avec une palette neutre. Le projet remplace ces couleurs par ses propres jetons, ceux
déclarés dans `styles.css` et vérifiés par le test de contraste. L'interface conserve donc son identité : le bouton
principal est rouge profond, comme le reste du site.

**Définitions**

| Terme | Définition |
|---|---|
| **Accessibilité** | Ensemble des pratiques qui rendent une interface utilisable par tous, notamment au clavier et avec un lecteur d'écran. |
| **Composant** | Élément d'interface réutilisable, comme un bouton ou une fenêtre modale. |
| **Dépendance** | Bibliothèque extérieure dont le projet a besoin, déclarée dans `package.json` et installée par `npm`. |
| **Focus** | Élément de la page qui reçoit les frappes du clavier. Il doit rester visible pour une navigation sans souris. |
| **Jeton de design** | Valeur nommée, par exemple une couleur, déclarée une seule fois et réutilisée partout. |
| **Lecteur d'écran** | Logiciel qui lit à voix haute le contenu d'une page pour les personnes déficientes visuelles. |
| **Radix UI** | Bibliothèque de comportements sans style, qui rend les composants accessibles au clavier et aux lecteurs d'écran. |
| **RGAA** | Référentiel français d'accessibilité, qui décline les règles internationales WCAG pour les services numériques. |
| **Variante** | Déclinaison d'un composant, par exemple un bouton principal ou un bouton discret. |

## Rôle dans le projet

- Il fournit la base du design system du front-end, enrichie au fur et à mesure des besoins réels.
- Il garantit un comportement accessible pour les composants interactifs : clavier, focus, lecteurs d'écran.
- Il reprend les jetons de la palette du projet : l'aspect de l'interface ne change pas lorsqu'un composant est
  remplacé.
- Il place le code des composants dans le dépôt, donc dans le périmètre des relectures et des analyses de qualité.
- Sans lui, chaque composant interactif devrait être écrit et rendu accessible à la main.

Deux composants sont installés : le bouton, et le gestionnaire de notifications (`sonner`), qui affiche la confirmation du dépôt en haut à droite, sous l'en-tête, pendant huit secondes. Le bouton propose les variantes suivantes :

| Variante | Apparence | Usage |
|---|---|---|
| **`default`** | Aplat rouge, texte blanc | Action principale, par exemple déposer une annonce. |
| **`ghost`** | Texte souligné, sans fond | Action secondaire, par exemple se déconnecter. |
| **`outline`** | Bordure fine sur fond clair | Action neutre, à utiliser au besoin. |

!!! note "À savoir"
    Les boutons écrits avant l'arrivée de shadcn/ui utilisent encore les classes `.btn` et `.btn-ghost` de
    `styles.css`. Les deux écritures produisent le même rendu : le remplacement se fait progressivement, sans
    modification visible pour l'utilisateur.

## Fichiers et dossiers principaux

| Fichier ou dossier | Description |
|---|---|
| **`frontend/components.json`** | Indique à l'outil shadcn où écrire les composants et où lire les styles. |
| **`frontend/src/components/ui/`** | Contient les composants copiés dans le projet. |
| **`frontend/src/components/ui/button.tsx`** | Le bouton du design system et ses variantes. |
| **`frontend/src/components/ui/sonner.tsx`** | Le gestionnaire de notifications : position, décalage et durée de huit secondes. |
| **`frontend/src/lib/utils.ts`** | Contient `cn`, qui assemble les classes Tailwind sans conflit. |
| **`frontend/src/styles.css`** | Relie les variables attendues par shadcn/ui aux couleurs du projet. |
| **`frontend/src/theme.test.ts`** | Vérifie le contraste de chaque association de couleurs utilisée. |

## Commandes essentielles

À lancer dans un terminal, depuis le dossier `frontend`.

| Commande | Description |
|---|---|
| **`npx shadcn@latest add dialog`** | Copie le composant « dialog », une fenêtre modale, dans le projet. |
| **`npx shadcn@latest add --help`** | Affiche la liste des composants disponibles et les options de l'outil. |
| **`npm test`** | Lance les tests, dont le contrôle des contrastes de la palette. |

Après l'ajout d'un composant, trois vérifications s'imposent :

1. Relire le fichier créé dans `src/components/ui`.
2. Remplacer les couleurs écrites en dur par les jetons du projet, par exemple `bg-blood`.
3. Ajouter au test de contraste toute nouvelle association de couleurs, puis relancer `npm test`.

!!! warning "Attention"
    Un composant copié ne reçoit plus aucune mise à jour. En cas de correction importante publiée par shadcn/ui, il
    faut copier à nouveau le fichier, puis y réappliquer les adaptations du projet.

!!! tip "Astuce"
    L'outil génère parfois des teintes neutres par défaut. Elles passent inaperçues à l'écran, mais trahissent la
    palette du projet : la relecture du fichier copié n'est pas facultative.

## Pour aller plus loin

- [Site officiel de shadcn/ui](https://ui.shadcn.com/)
- [Documentation de Radix UI](https://www.radix-ui.com/)
- [Référentiel RGAA](https://accessibilite.numerique.gouv.fr/)
