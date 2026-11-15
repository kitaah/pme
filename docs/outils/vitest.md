# Vitest

## Fiche d'identité

| Information | Détail |
|---|---|
| **Rôle** | Exécute les tests automatiques de l'interface et mesure la couverture du code |
| **Version** | Vitest 5, avec @vitest/coverage-v8 5 et jsdom 30 |
| **Adresse en local** | Aucune : se lance en ligne de commande |

## Description

Vitest est un outil open source qui **lance des tests automatiques** sur du code JavaScript ou TypeScript. Il joue pour
l'interface le rôle que [Jest](jest.md) joue pour les services, et s'écrit presque de la même façon.

**Le problème : un deuxième outil à configurer.**
L'interface est construite avec Vite, qui déclare déjà les raccourcis d'import, les extensions de React et le traitement
des styles. Un outil de test indépendant obligerait à redéclarer tout cela une seconde fois, avec le risque que les deux
configurations divergent. Vitest est un produit de la même famille que Vite : il relit sa configuration et teste le code
exactement tel qu'il sera construit.

**Comment il fonctionne.**
Vitest cherche les fichiers `*.test.ts` et `*.test.tsx`, exécute chaque test et compare le résultat à l'attente. Comme
l'interface est faite pour un navigateur, alors que les tests tournent dans Node, il s'appuie sur **jsdom**, un faux
navigateur écrit en JavaScript qui fournit une page, des éléments et des événements. Les composants peuvent ainsi être
affichés et manipulés sans ouvrir de vrai navigateur. Pour s'en servir, voir [Testing Library](testing-library.md).

**La couverture avec V8.**
V8 est le moteur JavaScript de Chrome et de Node. Il sait déjà noter, tout seul, quelles parties du code il exécute. Le
module `@vitest/coverage-v8` récupère cette information : le code n'a pas besoin d'être modifié avant la mesure, ce qui
la rend rapide. Le résultat est le même type de rapport *lcov* que pour les services, si bien que
[SonarCloud](sonarcloud.md) additionne les quatre couvertures.

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

vite: "vite.config.ts\nune seule\nconfiguration" {class: boite}
vitest: "Vitest\nexécute les tests\ndans jsdom" {class: boite}
v8: "V8\nnote les lignes\nexécutées" {class: boite}
rapport: "Rapport\nlcov.info" {class: boite}

vite -> vitest
vitest -> v8
v8 -> rapport
```

**Définitions**

| Terme | Définition |
|---|---|
| **Couverture** | Part du code exécutée par les tests, en lignes et en branches. |
| **jsdom** | Faux navigateur qui tourne dans Node, pour tester une interface sans navigateur réel. |
| **Seuil de couverture** | Couverture minimale exigée : en dessous, la commande échoue. |
| **V8** | Moteur JavaScript de Chrome et de Node, qui sait mesurer le code qu'il exécute. |
| **Vite** | Outil qui assemble et sert l'interface pendant le développement. |

## Rôle dans le projet

- Il exécute les 136 tests unitaires de l'interface dans la pipeline.
- Il vérifie notamment les contrastes de la palette de couleurs, selon les exigences du RGAA.
- Il mesure la couverture avec V8 et fait échouer le job si elle passe sous le seuil.
- Il produit un rapport JUnit, affiché dans l'onglet « Tests » de GitLab.
- Sans lui, une modification de l'interface pourrait casser le formulaire ou l'affichage sans qu'on s'en aperçoive.

Sa configuration se trouve dans le bloc `test` de `vite.config.ts` :

| Réglage | Valeur | Effet |
|---|---|---|
| **Environnement** | jsdom | Fournit un faux navigateur aux tests. |
| **Fichier de préparation** | `src/test/setup.ts` | Charge les vérifications dédiées à l'interface et nettoie la page après chaque test. |
| **Fichiers mesurés** | `src/**/*.ts` et `.tsx` | Tout le code de l'interface, hors démarrage (`main.tsx`) et fichiers de test. |
| **Seuils** | 100 % | Lignes, instructions, fonctions et branches : en dessous, la commande échoue. |

!!! note "À savoir"
    Contrairement aux services, l'interface ne démarre aucun conteneur : tous ses tests s'exécutent dans jsdom, en
    quelques secondes, sans Docker. Il n'y a donc qu'une seule commande de test à lancer, et non deux.

## Fichiers et dossiers principaux

| Fichier ou dossier | Description |
|---|---|
| **`frontend/vite.config.ts`** | Contient la configuration des tests et de la couverture. |
| **`frontend/src/test/setup.ts`** | Prépare chaque test : vérifications dédiées à l'interface, nettoyage de la page. |
| **`frontend/src/**/*.test.ts(x)`** | Les tests, placés à côté des composants qu'ils vérifient. |
| **`frontend/coverage/lcov.info`** | Rapport de couverture, lu par SonarCloud. |
| **`frontend/reports/junit.xml`** | Rapport JUnit, affiché par GitLab. |

## Commandes essentielles

À lancer dans un terminal, depuis le dossier `frontend`.

| Commande | Description |
|---|---|
| **`npm test`** | Lance tous les tests une fois, puis s'arrête. |
| **`npm run test:watch`** | Relance les tests concernés à chaque modification d'un fichier. |
| **`npm run test:cov`** | Lance les tests avec la couverture et ses seuils. |
| **`npx vitest run`**<br>**`src/components/Header.test.tsx`** | Ne lance qu'un seul fichier de test. |

Depuis la racine du projet, `make test` lance les tests des quatre modules et `make coverage` leur couverture.

!!! warning "Attention"
    Les fonctions `describe`, `it`, `expect` et `vi` doivent être importées depuis `vitest` en tête de chaque fichier.
    Sans cet import, le test échoue avec une erreur « is not defined », alors que le même code fonctionne avec Jest.

!!! tip "Astuce"
    Pendant l'écriture d'un test, `npm run test:watch` donne un retour en une ou deux secondes à chaque enregistrement,
    sans relancer la commande.

## Pour aller plus loin

- [Site officiel de Vitest](https://vitest.dev/)
- [Guide de la couverture avec V8](https://vitest.dev/guide/coverage.html)
- [Fiche Testing Library du projet](testing-library.md)
- [Fiche Jest du projet](jest.md)
