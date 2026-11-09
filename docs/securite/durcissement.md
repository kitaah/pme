# Durcissement des conteneurs

## Fiche d'identité

| Information | Détail |
|---|---|
| **Rôle** | Réduit ce qu'un attaquant pourrait faire s'il parvenait à exécuter du code dans un conteneur |
| **Portée** | Les onze déploiements du namespace `pme` |
| **Mesures clés** | Aucun droit d'administrateur, capacités retirées, disque en lecture seule, aucun jeton de cluster |
| **Contrôles automatiques** | Hadolint, container-structure-test (22 contrôles), Trivy |
| **Limite connue** | Aucune politique réseau : les pods peuvent tous se joindre, même si leurs échanges sont chiffrés par le maillage |

## Description

Les pages précédentes cherchent à empêcher une intrusion. Celle-ci part de l'hypothèse inverse : **et si elle réussissait
quand même ?** Une faille dans une dépendance, une erreur de validation, et du code étranger s'exécute dans un
conteneur. Le durcissement consiste à faire en sorte que ce code ne puisse presque rien faire.

**Le problème : un conteneur n'est pas une machine virtuelle.**
Un conteneur partage le noyau de la machine qui l'héberge. Cet isolement est léger, et il repose sur des réglages : s'ils
sont laissés par défaut, le programme s'exécute souvent en administrateur, avec un jeu de capacités système larges, un
système de fichiers modifiable, et une clé d'accès au cluster montée automatiquement. Un attaquant y trouverait tout ce
qu'il lui faut pour s'installer, puis pour atteindre les autres composants.

**La réponse : retirer tout ce qui n'est pas nécessaire.**
Chaque réglage ci-dessous retire une possibilité dont les applications n'ont pas besoin. Prises une à une, ces mesures
semblent modestes ; ensemble, elles transforment une intrusion exploitable en une impasse.

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

comparaison: "" {
  grid-columns: 2
  style.opacity: 0

  defaut: "Réglages par défaut" {
    grid-rows: 4
    class: boite
    a: "Exécution en administrateur" {class: boite}
    b: "Toutes les capacités système" {class: boite}
    c: "Disque modifiable" {class: boite}
    d: "Jeton du cluster monté" {class: boite}
  }
  projet: "Réglages du projet" {
    grid-rows: 4
    class: boite
    a: "Compte sans privilège, identifiant fixé" {class: boite}
    b: "Toutes les capacités retirées" {class: boite}
    c: "Disque en lecture seule" {class: boite}
    d: "Aucun jeton monté" {class: boite}
  }
}
```

**Définitions**

| Terme | Définition |
|---|---|
| **Capacité** | Droit système fin, comme celui d'ouvrir un port réservé ou de modifier l'horloge. Un programme ordinaire n'en a besoin d'aucun. |
| **Élévation de privilèges** | Fait d'obtenir plus de droits que ceux accordés au départ. |
| **Politique réseau** | Règle Kubernetes qui décide quels pods peuvent se parler. |
| **root** | Compte administrateur d'un système Linux, qui peut tout faire. |
| **seccomp** | Mécanisme du noyau Linux qui limite les appels système qu'un programme peut utiliser. |
| **Service account** | Identité d'un pod auprès du cluster. Son jeton permet d'appeler l'API de Kubernetes, et le maillage Istio en tire l'identité du pod. |

## Ce qui est en place

**Les réglages appliqués aux pods**

| Réglage | Valeur | Ce qu'il empêche |
|---|---|---|
| **Exécution sans privilège** | `runAsNonRoot` avec un identifiant explicite | Le programme ne s'exécute pas en administrateur, même si son image l'y invitait. |
| **Capacités système** | Toutes retirées | Aucun accès aux fonctions privilégiées du noyau. |
| **Élévation de privilèges** | Interdite | Un programme ne peut pas obtenir plus de droits qu'il n'en a reçu. |
| **Profil seccomp** | Celui par défaut du moteur | Les appels système dangereux sont refusés par le noyau. |
| **Système de fichiers** | En lecture seule pour l'API, la modération et l'interface | Un attaquant ne peut déposer ni programme ni script. Un espace temporaire en mémoire couvre les besoins réels. |
| **Jeton du cluster** | Non monté, sauf pour Alloy | Un code étranger ne peut pas s'adresser à l'API de Kubernetes. |
| **Variables de liaison** | Désactivées | Kubernetes n'injecte pas d'adresses de services sous forme de variables, qui entraient en collision avec celles des applications. |
| **Ressources plafonnées** | Processeur et mémoire, sur chaque conteneur | Un composant emballé ne peut pas priver les autres de ressources. |

Les identifiants d'exécution sont choisis pour chaque image : 1000 pour l'API et la modération, 101 pour l'interface,
472 pour Grafana, 473 pour Alloy, 10001 pour Loki, 65534 pour Prometheus.

**La seule exception : Alloy**
Alloy est le seul composant à recevoir un jeton de cluster, parce qu'il doit interroger Kubernetes pour savoir quels
pods existent et lire leurs journaux. Ses droits sont limités à la lecture des pods et de leurs journaux, et à rien
d'autre.

**Les composants du maillage : des droits élevés, mais réduits au strict nécessaire**
Deux composants d'Istio ne peuvent pas respecter les règles ci-dessus. L'agent **istio-cni** et le proxy **ztunnel**
doivent entrer dans l'espace réseau de chaque pod pour y rediriger le trafic. Cela exige le compte root et des
capacités réseau et système sur le nœud. Ils ne sont pas pour autant en mode `privileged` : toutes les capacités sont
retirées, sauf celles qui sont indispensables. Le projet ajoute trois protections autour de ces droits.

| Protection | Ce qu'elle apporte |
|---|---|
| **Namespace dédié** | Les composants vivent seuls dans `istio-system`. Ce namespace est le seul à déclarer le niveau `privileged` des standards de sécurité des pods. `pme` reste en `baseline`. |
| **Profil seccomp par défaut** | L'agent istio-cni se voit appliquer le profil du moteur : le noyau refuse les appels système dangereux dont il n'a pas besoin. Le chart de ztunnel n'offre pas ce réglage. |
| **Images analysées** | `make istio-scan` et le job `istio-scan` de la pipeline recherchent les failles corrigeables dans les trois images d'Istio. Une faille CRITICAL fait échouer le contrôle. Les failles HIGH sont comptées et conservées dans un rapport, car ces images sont publiées par Istio : le correctif vient d'une nouvelle version d'Istio. |

**Des images qui n'embarquent que le nécessaire**
Les trois images sont construites en deux étapes : la première compile, la seconde ne reçoit que le résultat. Les
sources, les outils de développement et les dépendances de compilation restent dans l'étape de construction et ne sont
jamais livrés. L'interface est servie par une variante de nginx prévue pour s'exécuter sans privilège.

Cela n'est pas seulement déclaré, c'est vérifié à chaque passage de la pipeline :

| Contrôle | Ce qu'il vérifie |
|---|---|
| [Hadolint](../pipeline/controle-dockerfile.md) | Les recettes de construction, avant même de bâtir l'image. |
| [container-structure-test](../pipeline/tests-images.md) | 22 contrôles sur les images : compte non administrateur, absence de sources, absence de fichier `.env`, port et commande de démarrage attendus. |
| [Trivy](../pipeline/analyse-dependances.md) | Les failles connues des paquets livrés et des dépendances de développement. |

!!! note "À savoir"
PostgreSQL, NATS et Adminer ne fixent pas d'identifiant d'exécution : leurs images démarrent en administrateur puis
abandonnent elles-mêmes ces droits pour leur propre compte. C'est le fonctionnement prévu par leurs éditeurs ; les
autres réglages, eux, leur sont bien appliqués.

## Ce qui n'est pas couvert

- **Aucune politique réseau.** C'est la limite la plus importante de cette page. Rien n'empêche aujourd'hui un pod du
  namespace d'ouvrir une connexion vers PostgreSQL, NATS ou n'importe quel autre service. L'interface, qui ne sert que
  des fichiers, pourrait techniquement joindre la base. Des règles de type NetworkPolicy, déclarant qui a le droit de
  parler à qui, fermeraient cette porte. Minikube le permet, à condition d'activer un greffon réseau qui les applique.
  Le maillage [Istio](../outils/istio.md) chiffre ces échanges, mais il ne les filtre pas : une règle d'autorisation par
  composant demanderait en plus un compte de service par composant, car tous les pods partagent aujourd'hui le même.
- **Un seul compte PostgreSQL pour quatre bases.** L'API, le service de modération, Keycloak et Grafana se connectent
  avec le même compte, créé à l'initialisation du serveur. Chacun peut donc lire et modifier les données des autres, y
  compris les comptes de Keycloak. Un compte par base, avec les seuls droits nécessaires, est le premier correctif à
  apporter.
- **Le disque reste modifiable pour la plupart des composants.** Seuls l'API, la modération et l'interface l'ont en
  lecture seule. PostgreSQL, Keycloak, Grafana, Adminer, NATS, Prometheus, Loki et Alloy écrivent à plusieurs endroits
  (données, fichiers de travail, extensions) qu'il faudrait recenser et monter un à un, avec un essai composant par
  composant. Keycloak en mode développement reconstruit même une partie de son code au démarrage.
- **Les composants du maillage restent root avec des capacités élevées.** Pour rediriger le trafic des pods, ztunnel et
  istio-cni gardent le compte root et des capacités réseau et système sur le nœud. Ces droits sont inhérents au mode
  ambient : aucun réglage du chart ne les retire. Une faille dans l'un d'eux aurait donc une portée bien plus large que
  dans une application du projet. Les mesures ci-dessus en limitent l'exposition, sans l'annuler.
- **Les trois composants d'infrastructure gardent le compte de leur image**, comme expliqué ci-dessus. Un durcissement
  plus poussé reviendrait à reconstruire ces images.
- **Pas de contrôle à l'admission.** Rien n'empêche de déployer dans le cluster un pod qui ne respecterait aucune de ces
  règles. Les standards de sécurité des pods, intégrés à Kubernetes, le feraient respecter au niveau du namespace.
- **Des failles HIGH connues dans les images d'Istio.** L'analyse en relève plusieurs dizaines par image (bibliothèque
  standard Go, paquets Ubuntu), toutes corrigeables par une nouvelle version d'Istio. Elles sont suivies, sans bloquer la
  pipeline. La montée de version d'Istio (`ISTIO_VERSION` dans le `Makefile`) est le remède.
- **Pas de signature des images.** Rien ne prouve, au déploiement, que l'image provient bien de la pipeline du projet.

## Commandes de vérification

À lancer dans un terminal, depuis le dossier du projet, la plateforme déployée.

| Commande | Description |
|---|---|
| `make image-test` | Rejoue les 22 contrôles de structure et l'analyse Trivy sur les trois images. |
| `make lint-docker` | Contrôle les quatre Dockerfile avec Hadolint. |
| `make lint-k8s` | Valide les manifestes Kubernetes. |
| `make istio-scan` | Analyse Trivy des trois images d'Istio : affiche les failles HIGH, et échoue s'il reste une faille CRITICAL corrigeable. |
| `kubectl -n istio-system get pod -l k8s-app=istio-cni-node -o yaml \| grep -A1 seccompProfile` | Montre que le profil `RuntimeDefault` est bien appliqué à l'agent istio-cni. |
| `kubectl -n pme exec deploy/pme-api -- id` | Montre l'identifiant du compte qui exécute l'API : il ne doit pas valoir 0. |

Pour vérifier le disque en lecture seule, essayer d'écrire un fichier dans le conteneur de l'API : la commande échoue,
sauf dans l'espace temporaire monté à cet effet.

!!! warning "Attention"
Le disque en lecture seule casse tout composant qui écrit ailleurs que dans son espace temporaire : un cache, un
fichier de session, un journal sur disque. C'est à vérifier avant d'activer le réglage sur un nouveau service, pas
après.

!!! tip "Astuce"
`kubectl -n pme get pod <nom> -o yaml` affiche les réglages réellement appliqués à un pod, y compris ceux qu'il
hérite du niveau du pod. C'est la source de vérité, plus fiable que la relecture du manifeste.

## Fichiers principaux

| Fichier ou dossier | Description |
|---|---|
| `k8s/04-api.yaml` et `k8s/05-moderation.yaml` | Réglages les plus complets : compte sans privilège, disque en lecture seule, capacités retirées. |
| `k8s/06-frontend.yaml` | Mêmes réglages pour l'interface, avec le compte de nginx non privilégié. |
| `k8s/13-alloy.yaml` | La seule exception : jeton de cluster et droits de lecture sur les pods. |
| `api/Dockerfile`, `moderation-service/Dockerfile`, `frontend/Dockerfile` | Construction en deux étapes, image finale sans outils. |
| `tests/image/` | Les 22 contrôles de structure appliqués aux images. |
| `k8s/istio/namespace.yaml` et `k8s/istio/cni-values.yaml` | Namespace dédié aux composants privilégiés du maillage, et profil seccomp de l'agent istio-cni. |
| `.hadolint.yaml` | Niveau à partir duquel un écart de Dockerfile fait échouer la pipeline. |

## Pour aller plus loin

- [Standards de sécurité des pods de Kubernetes](https://kubernetes.io/docs/concepts/security/pod-security-standards/)
- [Politiques réseau de Kubernetes](https://kubernetes.io/docs/concepts/services-networking/network-policies/)
- [Fiche Trivy du projet](../outils/trivy.md)
- [Fiche container-structure-test du projet](../outils/container-structure-test.md)