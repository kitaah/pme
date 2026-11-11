# SonarCloud

## Fiche d'identité

| Information | Détail |
|---|---|
| **Rôle** | Mesure la qualité du code : défauts, failles, doublons et couverture des tests, avec un verdict à chaque analyse |
| **Version** | Service en ligne, analysé par SonarScanner CLI 11 dans la pipeline |
| **Adresse en local** | Aucune : <https://sonarcloud.io/project/overview?id=kitaah_pme> |

## Description

SonarCloud est un service en ligne d'**analyse statique** de code, édité par SonarSource. Un analyseur lit le code
source du dépôt, lui applique plusieurs centaines de règles, puis envoie le résultat au service, qui l'affiche et le
conserve.

**Ce qu'il analyse, en général.**
SonarCloud prend en charge plus de trente langages et classe ses constats en grandes familles :

- Les **bugs** risquent de provoquer un comportement erroné.
- Les **vulnérabilités** ouvrent une faille exploitable.
- Les **points sensibles de sécurité** sont à relire à la main.
- Les **écarts de maintenabilité** rendent le code difficile à faire évoluer.
- Les **duplications** sont des portions de code recopiées à plusieurs endroits.
- La **couverture** mesure la part du code exécutée par les tests.
- Les **secrets oubliés** dans les fichiers (mots de passe, clés) sont aussi détectés.

**Analyser sans exécuter.**
Contrairement aux tests, l'analyse statique n'exécute pas le programme : elle lit le code comme un relecteur très
méthodique. Elle repère ainsi des défauts qu'aucun test ne révélerait, parce qu'ils ne se manifestent que dans des cas
rares : une variable qui peut valoir « rien », une condition toujours vraie, une ressource laissée ouverte.

**Les quatre questions auxquelles il répond.**

| Question | Ce que SonarCloud mesure |
|---|---|
| **Le code risque-t-il de mal fonctionner ?** | Les défauts de fiabilité, comme un cas non traité. |
| **Présente-t-il un risque de sécurité ?** | Les failles, et les points sensibles à relire à la main. |
| **Sera-t-il facile à faire évoluer ?** | La complexité, les doublons et les écarts aux conventions. |
| **Est-il réellement testé ?** | La couverture, calculée à partir des rapports produits par les tests. |

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

tests: "Tests unitaires\nrapports de couverture" {class: boite}
analyseur: "Analyseur\nlit le code et les rapports" {class: boite}
service: "SonarCloud\nmesures et historique" {class: boite}
verdict: "Quality Gate\nréussi ou échoué" {class: boite}

tests -> analyseur
analyseur -> service
service -> verdict
```

**La Quality Gate donne un verdict, pas une note à commenter.**
Plutôt que de laisser interpréter des dizaines de chiffres, SonarCloud applique un ensemble de conditions, la
**Quality Gate**, et rend un verdict unique : réussi ou échoué. Le projet utilise la Quality Gate par défaut, qui
exige notamment 80 % de couverture et au plus 3 % de doublons.

**Ces conditions portent sur le nouveau code.**
C'est le point qui rend l'outil utilisable sur un projet existant. Les exigences s'appliquent à ce qui a été ajouté ou
modifié depuis une date de référence, et non à l'ensemble du dépôt. Le code ancien n'impose donc pas une remise à
niveau immédiate, tandis que tout ce qui s'écrit aujourd'hui respecte les règles : la qualité progresse au rythme des
modifications.

**Définitions**

| Terme | Définition |
|---|---|
| **Analyse statique** | Examen du code sans l'exécuter, pour y repérer des défauts et des écarts aux règles. |
| **Anomalie** | Défaut repéré dans le code : erreur probable, faille ou mauvaise pratique. |
| **Couverture** | Part du code réellement exécutée par les tests. |
| **Duplication** | Portion de code recopiée à plusieurs endroits, qu'il faudra corriger partout. |
| **Nouveau code** | Code ajouté ou modifié depuis une date de référence. |
| **Point sensible de sécurité** | Portion de code à relire à la main pour juger si elle présente un risque. |
| **Quality Gate** | Ensemble de conditions qui donne un verdict unique : réussi ou échoué. |

## Rôle dans le projet

- Il analyse les quatre modules écrits en TypeScript : le module commun, l'API, le service de modération et l'interface.
- Il rassemble la couverture des quatre modules en une seule mesure, à partir des rapports produits par les tests.
- Il signale aussi les secrets oubliés dans les fichiers du dépôt.
- Il conserve l'historique des analyses, ce qui montre l'évolution de la qualité dans le temps.
- Il rend un verdict lisible sans expertise, consultable dans son tableau de bord.
- Sans lui, la qualité du code ne reposerait que sur la relecture humaine, inégale par nature.

Certains fichiers sont volontairement exclus de l'analyse ou du calcul de couverture :

| Exclusion | Raison |
|---|---|
| **Les fichiers de tests** | Ils sont le moyen du contrôle, pas son objet. |
| **Les migrations de base de données** | Leur contenu est figé une fois appliqué : le modifier serait une erreur. |
| **Les points d'entrée et les modules** | Ils se contentent d'assembler des éléments déjà testés. |
| **Les fichiers de configuration** | Ils ne contiennent aucune règle de gestion à vérifier. |

!!! note "À savoir"
    Le job d'analyse est le seul de la pipeline qui attende un autre job : il a besoin des rapports de couverture
    produits par les tests unitaires.

## Fichiers et dossiers principaux

| Fichier ou dossier | Description |
|---|---|
| **`sonar-project.properties`** | Déclare le projet, les sources, les tests, les exclusions et les rapports de couverture. |
| **`.gitlab-ci.yml`** | Définit le job qui lance l'analyse. |
| **`libs/common/coverage/lcov.info`** | Rapport de couverture du module commun. |
| **`api/coverage/lcov.info`** | Rapport de couverture de l'API, lu par l'analyseur. |
| **`moderation-service/coverage/lcov.info`** | Rapport de couverture du service de modération. |
| **`frontend/coverage/lcov.info`** | Rapport de couverture de l'interface. |

## Commandes essentielles

À lancer dans un terminal, depuis le dossier du projet. La pipeline effectue déjà ce travail à chaque modification.

| Commande | Description |
|---|---|
| **`make coverage`** | Produit les rapports de couverture des quatre modules. |
| **`make sonar`** | Envoie une analyse à SonarCloud depuis l'ordinateur. |
| **`make lint`** | Signale localement une partie des mêmes défauts, avant d'envoyer quoi que ce soit. |

!!! note "À savoir"
    La Quality Gate par défaut exige 80 % de couverture sur le nouveau code. Le projet applique des seuils locaux à 100 %, donc
    la porte est réussie. Le détail figure sur la page
    [Analyse SonarCloud](../pipeline/analyse-sonarcloud.md).

!!! warning "Attention"
    L'offre gratuite de SonarCloud n'analyse que la branche principale. Une analyse lancée depuis une autre branche
    n'aboutit pas.

!!! tip "Astuce"
    Le jeton d'accès se définit dans les réglages CI/CD de GitLab, avec les variables `SONAR_TOKEN` et
    `SONAR_HOST_URL`. Il est masqué dans les logs et ne doit jamais être écrit dans un fichier du dépôt.

## Pour aller plus loin

- [Site de SonarQube Cloud](https://www.sonarsource.com/products/sonarcloud/)
- [Documentation de SonarQube Cloud](https://docs.sonarsource.com/sonarqube-cloud/)
- [Analyse depuis GitLab CI/CD](https://docs.sonarsource.com/sonarqube-cloud/advanced-setup/ci-based-analysis/gitlab-ci/)
- [Fiche Jest du projet](jest.md) et [Vitest](vitest.md), qui produisent les rapports de couverture
