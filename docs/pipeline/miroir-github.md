# Miroir GitLab vers GitHub

## Fiche d'identité

| Information | Détail |
|---|---|
| **Rôle** | Tient à jour une copie du dépôt sur GitHub et y lance la pipeline GitHub Actions |
| **Sens de la copie** | De GitLab (dépôt de référence) vers GitHub, en miroir « push » |
| **Dépôts** | `gitlab.com/kitaah/pme` vers `github.com/kitaah/pme` |
| **Fréquence** | À chaque envoi sur GitLab, dans les cinq minutes |
| **Mise en place** | Une seule fois, en une dizaine de minutes |

## Description

Le miroir GitLab vers GitHub tient à jour, automatiquement, une copie du dépôt sur GitHub, et y lance la pipeline [GitHub Actions](../outils/github-actions.md). Le dépôt de référence reste sur GitLab : on y pousse, on y fusionne, et GitLab recopie vers GitHub.

**Le problème qu'il résout.**
Sans miroir, il faudrait envoyer le même code à la main vers les deux plateformes, avec le risque qu'elles divergent. Le miroir fait la copie seul, dans un seul sens.

**Comment il fonctionne.**
GitLab envoie chaque modification à GitHub (miroir en *push*) avec un jeton d'accès GitHub à droits limités. Quand la copie de `main` arrive, le workflow **CI** se lance sur GitHub.

**Définitions**

| Terme | Définition |
|---|---|
| **Branche protégée** | branche dont les modifications sont encadrées par des règles, comme `main`. |
| **Jeton d'accès** | mot de passe à droits limités, créé sur GitHub, que GitLab présente pour écrire dans la copie. |
| **Miroir** | copie d'un dépôt tenue à jour automatiquement à partir d'un autre. Ici, GitLab envoie chaque modification à GitHub (*push mirror*). |
| **Secret** | valeur sensible, comme un jeton, enregistrée dans les réglages d'un dépôt et masquée dans les logs. |
| **Workflow** | fichier YAML de `.github/workflows/` qui décrit la pipeline de GitHub Actions. |

## Les étapes, dans l'ordre

À faire une seule fois. Compter une dizaine de minutes.

### 1. Créer le dépôt vide sur GitHub

1. Sur <https://github.com>, cliquer sur **+** en haut à droite, puis **New repository** (ou ouvrir <https://github.com/new>).
2. **Repository name** : `pme`.
3. Choisir **Private** (recommandé) ou **Public**.
4. Ne cocher **aucune** option : ni README, ni `.gitignore`, ni licence. Le dépôt doit rester vide, sinon la première copie est refusée.
5. Cliquer sur **Create repository**.

### 2. Créer le jeton d'accès GitHub

1. Photo de profil, puis **Settings**.
2. En bas du menu de gauche : **Developer settings**.
3. **Personal access tokens**, puis **Fine-grained tokens**, puis **Generate new token**.
4. **Token name** : `gitlab-miroir`. **Expiration** : une date que l'on note (voir « Entretien »).
5. **Repository access** : **Only select repositories**, puis choisir `pme`.
6. Sous **Permissions**, cliquer sur **Add permissions** et ajouter :

    | Permission | Niveau |
    |---|---|
    | **Contents** | Read and write |
    | **Workflows** | Read and write |
    | **Metadata** | Read-only (ajoutée automatiquement) |

7. Cliquer sur **Generate token**, puis **copier le jeton tout de suite** : GitHub ne l'affiche qu'une fois.

La permission **Workflows** est indispensable : le dépôt contient `.github/workflows/ci.yml`, et GitHub refuse sans elle
qu'un jeton crée ou modifie un workflow. Avec un jeton classique, il faut cocher **repo** et **workflow**.

### 3. Configurer le miroir dans GitLab

1. Ouvrir le projet GitLab, puis **Settings**, **Repository**.
2. Déplier **Mirroring repositories**.
3. **Git repository URL** : `https://github.com/kitaah/pme.git`.
4. **Mirror direction** : **Push**.
5. **Authentication method** : mot de passe. **Username** : `kitaah`. **Password** : le jeton de l'étape 2.
6. Laisser **Only mirror protected branches** décoché pour copier aussi les branches de travail, ou le cocher pour ne
   copier que les branches protégées, comme `main`.
7. Cliquer sur **Mirror repository**, puis sur **Update now** (flèches circulaires) pour lancer la première copie.

### 4. Vérifier la copie

1. Dans **Mirroring repositories**, la colonne **Last successful update** doit afficher une date, sans étiquette
   rouge **Error**.
2. Sur `https://github.com/kitaah/pme`, recharger la page : les fichiers, les branches et l'historique sont là.
3. Le dossier `.github/` doit être présent.

### 5. Créer le secret de l'analyse SonarCloud

Le job `sonar` utilise le même jeton SonarCloud que GitLab : on le recopie.

1. Dans GitLab : **Settings**, **CI/CD**, **Variables**. Sur la ligne `SONAR_TOKEN`, cliquer sur le crayon pour modifier la
   variable, puis copier sa valeur (cliquer sur l'œil si elle est masquée à l'écran). Ne rien enregistrer : fermer la
   fenêtre sans modifier.
2. Sur GitHub, dans le dépôt : **Settings**, **Secrets and variables**, **Actions**, **New repository secret**.
3. **Name** : `SONAR_TOKEN`. **Secret** : la valeur copiée. Cliquer sur **Add secret**.

Si la valeur n'est pas affichable (variable de type « masquée et cachée »), générer un nouveau jeton sur
<https://sonarcloud.io/account/security> : saisir un nom (par exemple `github-actions`), cliquer sur **Generate Token**,
puis le coller à l'étape 3. L'ancien jeton continue de fonctionner dans GitLab.

La variable `SONAR_HOST_URL` de GitLab n'est pas à recopier : le workflow écrit l'adresse de SonarCloud lui-même.

### 6. Vérifier que les workflows sont autorisés

Sur GitHub : **Settings**, **Actions**, **General**. **Actions permissions** doit être sur **Allow all actions and
reusable workflows**. Dans **Workflow permissions**, le workflow demande lui-même l'écriture dans les paquets pour
publier les images : si la publication est refusée, choisir **Read and write permissions**.

### 7. Lancer la pipeline

1. Sur GitHub, ouvrir l'onglet **Actions**. Après la première copie, le workflow **CI** y apparaît.
2. Il se lance à chaque envoi sur `main`. Pour le lancer à la main : **CI**, **Run workflow**.
3. Tous les jobs doivent être verts, `ci-ok` compris.

## Les variables de SonarCloud : où elles sont et où les mettre

Le job d'analyse a besoin de deux valeurs, que chaque plateforme garde à sa façon.

| Valeur | Où la trouver | Où la mettre |
|---|---|---|
| **`SONAR_TOKEN`** | SonarCloud : photo de profil, **My Account**, onglet **Security**. Les jetons existants sont listés, la valeur n'est visible qu'à la création. À défaut, la valeur est déjà dans les variables de GitLab. | GitLab : variable. GitHub : secret. |
| **`SONAR_HOST_URL`** | Toujours `https://sonarcloud.io`. | GitLab : variable. GitHub : rien, le workflow l'écrit. |
| **Clé de l'organisation** (`kitaah`) | SonarCloud : l'adresse `https://sonarcloud.io/organizations/<clé>`, ou **My Account**, onglet **Organizations**, colonne **Key**. | Le fichier `sonar-project.properties` du dépôt (`sonar.organization`), déjà renseigné. |
| **Clé du projet** (`kitaah_pme`) | SonarCloud : ouvrir le projet importé, rubrique **Information** du menu de gauche, ligne **Project Key**. | Le fichier `sonar-project.properties` du dépôt (`sonar.projectKey`), déjà renseigné. |

Les deux clés ne sont pas secrètes : elles sont versionnées dans le dépôt, et rien n'est à créer pour elles dans GitLab
ni dans GitHub.

### Ajouter les variables dans GitLab

1. Ouvrir le projet GitLab, puis **Settings**, **CI/CD**.
2. Déplier **Variables**, puis cliquer sur **Add variable**.
3. Pour le jeton : **Key** `SONAR_TOKEN`, **Value** le jeton, **Visibility** **Masked** (la valeur est cachée dans les
   logs et reste relisible en modifiant la variable). Laisser **Protect variable** décoché, sauf si la branche `main`
   est protégée. Laisser **Environments** sur **All (default)**.
4. Cliquer sur **Add variable**, puis recommencer pour `SONAR_HOST_URL` : **Key** `SONAR_HOST_URL`, **Value**
   `https://sonarcloud.io`, **Visibility** **Visible**.

Si **Protect variable** est coché alors que `main` n'est pas protégée, GitLab ne fournit pas la variable au job : le
job `sonar` échoue sans trouver le jeton.

### Ajouter le secret dans GitHub

Voir l'étape 5 : **Settings**, **Secrets and variables**, **Actions**, **New repository secret**. GitHub ne conserve que
`SONAR_TOKEN`.

## Désactiver ou réactiver la CI/CD

Les deux pipelines sont indépendantes : il faut désactiver chacune de son côté. Un miroir qui continue de copier ne
consomme aucune minute de pipeline.

| Plateforme | Pour désactiver | Pour réactiver |
|---|---|---|
| **GitLab, tout le projet** | **Settings**, **General**, déplier **Visibility, project features, permissions**, désactiver **CI/CD**, puis **Save changes**. | Réactiver le même interrupteur, puis **Save changes**. |
| **GitHub, le workflow seul** | Onglet **Actions**, cliquer sur **CI** dans la liste de gauche, menu **⋯**, **Disable workflow**. | Même endroit : **Enable workflow**. |
| **GitHub, toutes les Actions du dépôt** | **Settings**, **Actions**, **General**, **Actions permissions**, choisir **Disable actions**, puis **Save**. | Choisir **Allow all actions and reusable workflows**, puis **Save**. |

Désactiver la CI/CD de GitLab n'arrête pas celle de GitHub, et inversement. Pour ne plus rien lancer, il faut donc
désactiver les deux. Le job `sonar` et les tests ne tournent alors plus nulle part : à réserver aux périodes où le quota
de minutes est épuisé.

## Comment ça marche ensuite

| Action | Résultat |
|---|---|
| **Pousser ou fusionner sur GitLab** | GitLab recopie vers GitHub dans les cinq minutes, ou dans la minute si l'option des branches protégées est cochée. |
| **Fusion dans `main`** | La copie de `main` arrive sur GitHub, et le workflow **CI** se lance. |
| **Bouton « Update now »** | Force la copie immédiate, au plus une fois toutes les cinq minutes. |
| **Désactiver la CI/CD de GitLab** | Le miroir continue, et la pipeline de GitHub continue aussi : les deux sont indépendantes. |

## Dépannage

L'infobulle de l'étiquette rouge **Error**, dans **Mirroring repositories**, donne la cause exacte.

| Message | Cause | Correction |
|---|---|---|
| **`refusing to allow a Personal Access Token`**<br>**`to create or update workflow ...`**<br>**`without workflow scope`** | Le jeton n'a pas la permission **Workflows**. | Éditer le jeton sur GitHub, ajouter **Workflows : Read and write**, puis **Update now**. |
| **`403`, `401` ou erreur d'authentification** | Jeton expiré, révoqué, ou limité à un autre dépôt. | Créer un jeton selon l'étape 2 et le coller dans **Password** du miroir. |
| **`non-fast-forward` ou références divergentes** | GitHub contient un commit absent de GitLab (README créé avec le dépôt, ou envoi direct sur GitHub). | Recréer le dépôt GitHub vide, ou supprimer le commit en trop. |
| **Rien n'est copié, sans erreur** | « Only mirror protected branches » est coché et la branche n'est pas protégée. | Protéger la branche (**Settings**, **Repository**, **Protected branches**) ou décocher l'option. |
| **Le job `sonar` échoue** | Le secret `SONAR_TOKEN` n'existe pas dans GitHub. | Étape 5. |
| **La publication des images est refusée** | Le jeton du workflow n'a pas le droit d'écrire dans les paquets. | Étape 6, **Read and write permissions**. |

!!! note "À savoir"
    Le miroir est du Git, pas de la CI : il transmet les commits, jamais les variables ni les secrets de GitLab. Le
    secret `SONAR_TOKEN` se crée donc à part sur GitHub, et le registre d'images de GitHub (`ghcr.io`) est distinct de
    celui de GitLab.

!!! warning "Attention"
    **Ne jamais pousser directement sur GitHub.** Le miroir écrase ou refuse les commits ajoutés de ce côté, et
    l'erreur de références divergentes bloque la copie suivante. Toute modification passe par GitLab.

!!! tip "Astuce"
    Noter la date d'expiration du jeton dans un agenda. Un miroir qui passe soudain en rouge sans changement de code est
    presque toujours un jeton expiré : en créer un nouveau et le remplacer dans le champ **Password** du miroir.

## Entretien

- **Expiration du jeton** : à renouveler avant la date choisie à l'étape 2.
- **Surveillance** : **Last successful update** et l'étiquette **Error**, dans **Mirroring repositories**.
- **Révocation** : si le jeton est exposé, le supprimer dans les réglages de GitHub, puis en créer un autre.

## Pour aller plus loin

- [Fiche GitHub Actions du projet](../outils/github-actions.md)
- [Fiche GitLab CI du projet](../outils/gitlab-ci.md)
- [Documentation de GitLab sur le miroir en push](https://docs.gitlab.com/user/project/repository/mirror/push/)
