# Trivy

## Fiche d'identité

| Information | Détail |
|---|---|
| **Rôle** | Recherche les failles de sécurité connues dans les images Docker et dans les dépendances du projet |
| **Version** | Trivy 0.71.2 |
| **Adresse en local** | Aucune |

## Description

Trivy est un outil open source d'analyse de sécurité, édité par Aqua Security. Son principe est simple : il dresse la
liste de tout ce qu'une image ou un projet contient, puis compare cette liste au catalogue public des **failles**
connues.

**D'où viennent les failles ?**
Une application n'est pas seulement constituée du code écrit par l'équipe. Elle embarque une image de base, ses
bibliothèques système, et des dizaines de dépendances installées par `npm`, qui elles-mêmes en dépendent d'autres. Une
faille découverte dans n'importe lequel de ces éléments devient une faille de l'application, sans qu'une seule ligne du
code du projet soit en cause.

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

contenu: "Contenu analysé\npaquets de l'image,\ndépendances du projet" {class: boite}
trivy: "Trivy\ncompare" {class: boite}
base: "Catalogue public\ndes failles connues" {class: boite}
rapport: "Rapport\nfaille, gravité,\nversion corrigée" {class: boite}

contenu -> trivy
base -> trivy
trivy -> rapport
```

**Deux analyses complémentaires.**
Trivy intervient deux fois dans la pipeline, sur des périmètres différents. L'analyse des **images** porte sur ce qui
part réellement en production : l'image de base et les bibliothèques installées. L'analyse des **dépendances** porte
sur les fichiers du dépôt, outils de développement compris. Ces derniers n'arrivent jamais en production, mais une
faille dans un outil de construction peut compromettre l'ordinateur d'un développeur ou la pipeline elle-même.

**Le projet ne bloque que ce qui est corrigeable.**
Seules les failles de gravité élevée ou critique font échouer la pipeline, et uniquement lorsqu'un correctif existe.
Une faille sans correctif publié est signalée, mais ne bloque rien : l'équipe ne pourrait rien en faire, et une alerte
sur laquelle on ne peut pas agir finit par être ignorée, y compris lorsqu'elle devient importante.

**Les exceptions sont datées.**
Lorsqu'une correction est impossible dans l'immédiat, une exception peut être déclarée dans un fichier dédié. Elle est
toujours accompagnée d'une justification et d'une date d'expiration : passé ce délai, la faille bloque de nouveau la
pipeline. Une exception sans échéance deviendrait une dette oubliée.

**Définitions**

| Terme | Définition |
|---|---|
| **Catalogue des failles** | Liste publique des failles connues, que Trivy télécharge avant chaque analyse. |
| **Dépendance** | Bibliothèque extérieure dont le projet a besoin pour fonctionner ou pour être construit. |
| **Exception** | Faille acceptée volontairement pour une durée limitée, avec sa justification. |
| **Faille (CVE)** | Défaut de sécurité public, identifié par un code du type `CVE-2026-00000`. |
| **Faille corrigeable** | Faille pour laquelle l'éditeur a déjà publié une version corrigée. |
| **Gravité** | Niveau de risque d'une faille : faible, moyen, élevé ou critique. |
| **Image de base** | Image sur laquelle une image est construite, par exemple `node:24-alpine`. |

## Rôle dans le projet

- Il analyse les trois images avant leur publication : l'API, le service de modération et l'interface.
- Il analyse aussi les dépendances des trois modules, outils de développement compris.
- Il bloque la pipeline dès qu'une faille élevée ou critique dispose d'un correctif.
- Il conserve un rapport par analyse, ce qui garde une trace de l'état de sécurité à chaque publication.
- Sans lui, une image pourrait partir en production avec une faille connue et déjà corrigée ailleurs.

Les deux analyses se répartissent ainsi :

| Analyse | Ce qu'elle examine | Ce qu'elle ne voit pas |
|---|---|---|
| Images | Les paquets réellement présents dans l'image livrée. | Les outils de développement, absents de l'image. |
| Dépendances | Les dépendances déclarées, outils de développement compris. | Le système de l'image, comme Alpine ou nginx. |

!!! note "À savoir"
    Trivy sait aussi chercher des secrets et des erreurs de configuration. Ces fonctions ne sont pas activées ici :
    les secrets sont déjà recherchés par [SonarCloud](sonarcloud.md) et, sur l'ordinateur, par gitleaks.

## Fichiers et dossiers principaux

| Fichier ou dossier | Description |
|---|---|
| `.trivyignore` | Liste les exceptions : identifiant de la faille, justification et date d'expiration. |
| `.gitlab-ci.yml` | Définit les deux analyses, dans les jobs des images et des dépendances. |
| `docker-bake.hcl` | Décrit la construction des images analysées. |
| `api/Dockerfile` | Décrit la fabrication de l'image de l'API, dont son image de base. |
| `moderation-service/Dockerfile` | Même rôle pour le service de modération. |
| `frontend/Dockerfile` | Même rôle pour l'interface. |

## Commandes essentielles

À lancer dans un terminal, depuis le dossier du projet, Docker et le cluster démarrés.

| Commande | Description |
|---|---|
| `make image` | Construit les images à analyser. |
| `make image-test` | Contrôle la structure des images, puis leurs failles. |
| `make audit` | Recherche les failles des dépendances avec l'outil fourni par `npm`. |
| `trivy image --severity HIGH,CRITICAL --ignore-unfixed pme-api:dev` | Analyse l'image de l'API seule. |

Pour corriger une faille :

1. Lire dans le rapport la dépendance ou le paquet en cause, et la version qui corrige le problème.
2. Mettre à jour la dépendance, ou l'image de base si la faille vient du système.
3. Reconstruire l'image, puis relancer l'analyse.
4. Si la mise à jour est impossible dans l'immédiat, ajouter une exception datée et justifiée.

!!! warning "Attention"
    Une exception sans date d'expiration n'est pas acceptée : elle reviendrait à ignorer la faille indéfiniment. La
    date force un réexamen.

!!! tip "Astuce"
    La plupart des failles d'image se règlent en mettant à jour l'image de base, et non les dépendances du projet :
    c'est le premier réflexe à avoir à la lecture d'un rapport.

## Pour aller plus loin

- [Site officiel de Trivy](https://trivy.dev/)
- [Documentation de Trivy](https://trivy.dev/latest/docs/)
- [Fiche container-structure-test du projet](container-structure-test.md)
