# Publication des images Docker

## Objectif

Mettre à disposition les trois images de l'application dans un registre privé, uniquement après qu'elles ont réussi
tous les contrôles. Une image publiée est donc une image vérifiée.

**Définitions**

- **Registre de conteneurs** : entrepôt où l'on dépose et d'où l'on télécharge les images Docker. GitLab en fournit un par projet.
- **Étiquette (tag)** : nom de version d'une image, par exemple `a1b2c3d4`.
- **Étiquette immuable** : étiquette qui désigne toujours la même image et n'est jamais réécrite.
- **SHA court** : les 8 premiers caractères de l'identifiant d'un commit.
- **Dépôt d'images** : ensemble des versions d'une même image dans le registre.

## Intérêt

| Bénéfice | Explication |
|---|---|
| **Traçabilité** | Chaque image est liée à un commit précis. On sait quel code tourne dans quelle image. |
| **Image vérifiée** | L'image déployée est celle qui a passé les 22 contrôles et l'analyse Trivy, pas une reconstruction qui pourrait différer. |
| **Retour arrière** | En cas de problème, on redéploie l'étiquette précédente sans rien reconstruire. |
| **Livraison continue** | La pipeline ne s'arrête plus à « tester » : elle fournit un résultat prêt à déployer. |
| **Preuve** | Les exigences de déployabilité et de sécurité des images sont démontrées sur des images qui existent encore après la pipeline. |
| **Simplicité** | Le registre est fourni avec le projet GitLab. Il n'y a ni service à installer ni secret à gérer. |

## Ce qui est publié

| Image | Adresse dans le registre |
|---|---|
| **API** | `registry.gitlab.com/kitaah/pme/api:<sha>` |
| **Modération** | `registry.gitlab.com/kitaah/pme/moderation:<sha>` |
| **Interface** | `registry.gitlab.com/kitaah/pme/frontend:<sha>` |

`<sha>` est le SHA court du commit qui a produit l'image.

## Comment ça marche

La publication est la **dernière étape** du job `image-tests`, après la construction, les 22 contrôles de structure
et l'analyse Trivy.

1. Si un contrôle échoue, le job s'arrête : rien n'est publié.
2. Sinon, et seulement sur la branche principale, le job se connecte au registre.
3. Il étiquette les trois images avec le SHA court du commit.
4. Il envoie les trois images en parallèle.

Les images publiées sont exactement celles qui ont été contrôlées : elles ne sont pas reconstruites.

## Règles de publication

| Règle | Valeur |
|---|---|
| **Branche concernée** | Branche principale uniquement. |
| **Condition** | Tous les contrôles du job ont réussi. |
| **Étiquette** | SHA court du commit. Pas d'étiquette `latest`. |
| **Identifiants** | Fournis par GitLab pour la durée du job. Aucun secret à créer. |
| **Envoi** | Trois images en parallèle. |

!!! note "À savoir"
    **Pourquoi pas `latest` ?** `latest` change à chaque envoi : on ne sait plus quelle version tourne. Une étiquette liée au commit permet de
    retrouver le code exact d'une image et de revenir en arrière.

## Quand elle a lieu

La publication suit le déclenchement du job `image-tests` :

- **Automatiquement** quand une image ou son contrôle change.
- **À la demande** dans les autres cas, avec le bouton de lancement manuel.

Un commit qui ne touche ni image ni test d'image ne publie donc rien. La dernière version publiée reste valable.

## Où voir le résultat

- **Journal du job** : les lignes `docker push` des trois images.
- **Interface GitLab** : *Déployer* puis *Registre de conteneurs*, avec les étiquettes et leur date.

## Récupérer une image

Le registre est privé. Un jeton avec le droit `read_registry` est nécessaire.

```bash
docker login registry.gitlab.com
docker pull registry.gitlab.com/kitaah/pme/api:<sha>
```

## Limites connues

- Les images s'accumulent : une règle de nettoyage du registre doit être activée dans GitLab
  (*Paramètres* > *Paquets et registres* > *Règles de nettoyage*).
- Le déploiement dans Minikube construit encore ses images en local. Il ne télécharge pas celles du registre.
- Le job `image-tests` doit rester sous sa limite de 5 minutes, envoi compris.

## Pour aller plus loin

- [Registre de conteneurs GitLab](https://docs.gitlab.com/user/packages/container_registry/)
- [Règles de nettoyage du registre](https://docs.gitlab.com/user/packages/container_registry/reduce_container_registry_storage/)
- [Tests des images Docker](tests-images.md)
