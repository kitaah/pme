# Jest

## Fiche d'identité

| Information | Détail |
|---|---|
| **Rôle** | Exécute les tests automatiques de l'API et du service de modération, et mesure la couverture du code |
| **Version** | Jest 30, avec ts-jest 29 pour le TypeScript et jest-junit 17 pour les rapports |
| **Adresse en local** | Aucune : se lance en ligne de commande |

## Description

Jest est un outil open source qui **lance des tests automatiques** écrits en JavaScript ou en TypeScript. Un test est un
petit programme qui appelle une partie du code avec des valeurs connues, puis vérifie que le résultat est celui qu'on
attend.

**Le problème : vérifier à la main ne tient pas.**
Chaque modification du code peut casser, sans que personne s'en aperçoive, une fonction qui marchait la veille. Contrôler
à la main toutes les fonctions après chaque changement est long, et on finit par en oublier. Avec Jest, ces vérifications
sont écrites une fois, puis rejouées en quelques secondes, aussi souvent que nécessaire, y compris par la pipeline à
chaque envoi de code.

**Comment il fonctionne.**
Jest cherche les fichiers de test, exécute chaque test l'un après l'autre et compare ce qui s'est produit à ce qui était
attendu. Le test réussit si les deux concordent, échoue sinon, avec un message qui indique l'écart. Comme le code du
projet est en TypeScript, **ts-jest** le traduit à la volée avant l'exécution.

**Les doublures.**
Un test unitaire vérifie une pièce isolée. Quand cette pièce dépend de la base de données ou du broker, Jest permet de les
remplacer par des *doublures* : de faux composants qui répondent ce que le test décide. Le test est ainsi rapide et ne
dépend d'aucune installation. Les tests qui, au contraire, ont besoin des vrais composants s'appuient sur
[Testcontainers](testcontainers.md).

**La couverture : combien de code les tests exécutent-ils ?**
Jest embarque **Istanbul**, un outil qui surveille les lignes exécutées pendant les tests. À la fin, il calcule la
**couverture** : la part des lignes, et des embranchements (les « si… sinon »), que les tests ont réellement parcourue.
Une ligne jamais exécutée par un test n'est protégée par rien. Le résultat est écrit dans un rapport au format *lcov*,
que [SonarCloud](sonarcloud.md) lit ensuite.

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

tests: "Jest\nexécute les tests" {class: boite}
istanbul: "Istanbul\nnote les lignes\nexécutées" {class: boite}
rapport: "Rapport\nlcov.info" {class: boite}
sonar: "SonarCloud\naffiche la\ncouverture" {class: boite}

tests -> istanbul
istanbul -> rapport
rapport -> sonar
```

**Définitions**

| Terme | Définition |
|---|---|
| **Assertion** | Vérification écrite dans un test, du type « le résultat doit valoir 3 ». |
| **Branche** | Chemin possible dans le code, par exemple le cas « oui » et le cas « non » d'une condition. |
| **Couverture** | Part du code exécutée par les tests, en lignes et en branches. |
| **Doublure** | Faux composant qui remplace un vrai service pendant un test. |
| **Istanbul** | Outil de mesure de couverture intégré à Jest. |
| **JUnit** | Format de rapport de tests que GitLab sait afficher dans l'onglet « Tests » de la pipeline. |
| **lcov** | Format de rapport de couverture, lu par SonarCloud. |
| **Seuil de couverture** | Couverture minimale exigée : en dessous, la commande échoue. |

## Rôle dans le projet

- Il exécute les tests unitaires de l'API et du service de modération, en parallèle dans la pipeline.
- Il exécute aussi les tests d'intégration des deux services, avec les vrais PostgreSQL et NATS.
- Il mesure la couverture avec Istanbul et fait échouer le job si elle passe sous le seuil.
- Il produit le rapport JUnit, affiché dans l'onglet « Tests » de GitLab, grâce à jest-junit.
- Sans lui, aucune régression des deux services ne serait détectée avant la mise en ligne.

Chaque service déclare **deux projets** Jest, qui se lancent séparément :

| Projet | Fichiers recherchés | Particularité |
|---|---|---|
| **unit** | `src/**/*.spec.ts` | Rapide, sans Docker : les dépendances sont remplacées par des doublures. |
| **integration** | `test/integration/**/*.integration-spec.ts` | Démarre de vrais conteneurs, avec un délai de 180 secondes par test. |

Les seuils de couverture, mesurés sur les tests unitaires, sont les suivants :

| Module | Seuil de lignes | Seuil de branches |
|---|---|---|
| **API** | 40 % | 20 % |
| **Service de modération** | 40 % | 20 % |

!!! note "À savoir"
    ts-jest vérifie aussi les types : une erreur de typage fait échouer le test, même si le code se serait exécuté
    correctement. Les fichiers exclus de la mesure sont ceux qui n'ont pas de logique à tester : démarrage de
    l'application, migrations et modules d'assemblage.

## Fichiers et dossiers principaux

| Fichier ou dossier | Description |
|---|---|
| `api/jest.config.js` | Déclare les deux projets, les fichiers mesurés et les seuils de couverture de l'API. |
| `moderation-service/jest.config.js` | Même configuration pour le service de modération. |
| `*/src/**/*.spec.ts` | Les tests unitaires, placés à côté du code qu'ils vérifient. |
| `*/test/integration/` | Les tests d'intégration. |
| `*/test/support/jest-setup.ts` | Règle le délai des tests d'intégration. |
| `*/coverage/lcov.info` | Rapport de couverture, lu par SonarCloud. |
| `*/reports/junit.xml` | Rapport JUnit, affiché par GitLab. |

## Commandes essentielles

À lancer dans un terminal, depuis le dossier `api` ou `moderation-service`.

| Commande | Description |
|---|---|
| `npm test` | Lance les tests unitaires. |
| `npm run test:cov` | Lance les tests unitaires avec la couverture et ses seuils. |
| `npm run test:integration` | Lance les tests d'intégration, Docker démarré. |
| `npm test -- -t "texte"` | Ne lance que les tests dont le nom contient ce texte. |

Depuis la racine du projet, `make test` lance les tests unitaires des trois modules, `make coverage` leur couverture et
`make test-integration` les tests d'intégration.

!!! warning "Attention"
    Les commandes de test passent l'option `--experimental-vm-modules` à Node. Dans WebStorm, il faut l'ajouter aux
    options de Node de la configuration Jest, sinon les tests ne démarrent pas.

!!! tip "Astuce"
    Après `npm run test:cov`, ouvrir `coverage/lcov-report/index.html` dans un navigateur : les lignes jamais
    exécutées y apparaissent en rouge, ce qui indique où ajouter un test.

## Pour aller plus loin

- [Site officiel de Jest](https://jestjs.io/fr/)
- [Documentation de ts-jest](https://kulshekhar.github.io/ts-jest/)
- [Fiche Vitest du projet](vitest.md)
- [Page des tests unitaires de la pipeline](../pipeline/tests-unitaires.md)
