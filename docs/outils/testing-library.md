# Testing Library

## Fiche d'identité

| Information | Détail |
|---|---|
| **Rôle** | Affiche les composants de l'interface dans les tests et les manipule comme le ferait une personne |
| **Version** | React Testing Library 16, jest-dom 7 et user-event 14 |
| **Adresse en local** | Aucune : utilisée par les tests de l'interface |

## Description

Testing Library est un ensemble open source de bibliothèques qui permettent de **tester une interface du point de vue de
la personne qui l'utilise**. Trois modules sont employés dans le projet : `@testing-library/react` pour afficher les
composants, `@testing-library/user-event` pour simuler les gestes, et `@testing-library/jest-dom` pour vérifier ce qui
s'affiche.

**Le problème : des tests qui cassent sans raison.**
On peut tester un composant en inspectant ses rouages internes : le nom de ses variables, le nombre de fois où il se
redessine. Mais ces détails changent dès qu'on réorganise le code, même quand l'interface reste identique. Le test
échoue alors que rien n'est cassé, et l'équipe finit par ne plus lui faire confiance. À l'inverse, un test qui
décrit ce que voit et fait la personne, comme « cliquer sur *Déconnexion* », continue de passer tant que l'interface
fonctionne.

**Comment il fonctionne.**
Un test suit toujours le même parcours : afficher le composant, le manipuler, vérifier le résultat. Les éléments sont
retrouvés par leur **rôle** (un bouton, un champ, un titre) ou par leur texte visible, jamais par un identifiant
technique. Cette façon de faire pousse aussi vers une interface accessible : un bouton qui ne peut pas être retrouvé par
son rôle est un bouton que les lecteurs d'écran ne reconnaîtront pas non plus.

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

afficher: "1. Afficher\nle composant\n(React Testing Library)" {class: boite}
agir: "2. Agir\ncliquer, saisir\n(user-event)" {class: boite}
verifier: "3. Vérifier\nce qui est visible\n(jest-dom)" {class: boite}

afficher -> agir
agir -> verifier
```

**Définitions**

| Terme | Définition |
|---|---|
| **Composant** | Morceau d'interface réutilisable, comme un bouton, un formulaire ou un en-tête. |
| **jsdom** | Faux navigateur qui tourne dans Node et sur lequel les composants sont affichés pendant les tests. |
| **Lecteur d'écran** | Logiciel qui lit l'écran à voix haute pour les personnes aveugles ou malvoyantes. |
| **Rôle** | Nature d'un élément pour un outil d'accessibilité : bouton, lien, champ de saisie, titre. |
| **Vérificateur (matcher)** | Formule de test lisible, comme « doit être présent dans la page », fournie par jest-dom. |

## Rôle dans le projet

- Il affiche les composants dans un faux navigateur (jsdom), à l'intérieur des tests de [Vitest](vitest.md).
- Il simule les gestes d'une personne : clic sur un bouton, saisie dans le formulaire de dépôt.
- Il vérifie le texte affiché : nom et rôle du membre, libellé de chaque statut d'annonce, messages d'erreur.
- Il rend le test indépendant de l'organisation interne du code, ce qui évite de le réécrire à chaque amélioration.
- Sans lui, les tests de l'interface se limiteraient à des fonctions isolées, et non à des écrans.

Quatre fichiers l'utilisent :

| Fichier | Ce qui est vérifié |
|---|---|
| `Header.test.tsx` | Nom et rôle affichés, déconnexion au clic. |
| `ListingForm.test.tsx` | Erreurs de l'API affichées, dépôt confirmé et formulaire vidé. |
| `MyListings.test.tsx` | Libellé de chaque statut, erreur affichée si l'API ne répond pas. |
| `ui/button.test.tsx` | Variantes du bouton et rendu en lien. |

!!! note "À savoir"
    Les tests de l'interface sont commentés en « Given / Then » : une phrase décrit la situation de départ, une autre le
    résultat attendu. Ce découpage rend chaque test lisible sans connaître le code du composant.

## Fichiers et dossiers principaux

| Fichier ou dossier | Description |
|---|---|
| `frontend/src/test/setup.ts` | Active les vérificateurs de jest-dom et nettoie la page après chaque test. |
| `frontend/src/components/*.test.tsx` | Les tests des composants de l'application. |
| `frontend/src/components/ui/button.test.tsx` | Le test du composant de bouton issu de [shadcn/ui](shadcn-ui.md). |
| `frontend/package.json` | Liste les trois modules dans les dépendances de développement. |

## Commandes essentielles

Testing Library n'a pas de commande propre : elle se lance avec [Vitest](vitest.md), depuis le dossier `frontend`.

| Commande | Description |
|---|---|
| `npm test` | Lance tous les tests de l'interface. |
| `npm run test:watch` | Relance les tests à chaque modification. |
| `npx vitest run src/components/ListingForm.test.tsx` | Ne lance que les tests du formulaire. |

!!! warning "Attention"
    Le nettoyage de la page après chaque test est fait par `setup.ts`. Si ce fichier est retiré ou contourné, les
    composants des tests précédents restent affichés, et un test peut réussir ou échouer à cause d'un autre.

!!! tip "Astuce"
    Pour choisir comment retrouver un élément, partir du plus proche de la personne : son rôle, puis son texte visible.
    Un identifiant technique n'est qu'un dernier recours.

## Pour aller plus loin

- [Site officiel de Testing Library](https://testing-library.com/docs/react-testing-library/intro/)
- [Documentation de user-event](https://testing-library.com/docs/user-event/intro/)
- [Fiche Vitest du projet](vitest.md)
- [Fiche React du projet](react.md)
