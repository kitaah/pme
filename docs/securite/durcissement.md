# Durcissement des conteneurs

## Fiche d'identité

| Information | Détail |
|---|---|
| **Rôle** | Réduit ce qu'un attaquant pourrait faire s'il parvenait à exécuter du code dans un conteneur |
| **Portée** | Les douze déploiements du namespace `pme` |
| **Mesures clés** | Aucun droit d'administrateur, capacités retirées, disque en lecture seule, aucun jeton de cluster, politiques réseau |
| **Contrôles automatiques** | Hadolint, container-structure-test (24 contrôles), Trivy |
| **Limite connue** | Les connexions sortantes des pods ne sont pas filtrées : seules les entrées le sont |

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
| **Étiquette (label)** | Paire nom et valeur attachée à un pod. Les politiques réseau s'en servent pour désigner les pods concernés. |
| **Politique réseau** | Règle Kubernetes qui décide quels pods peuvent se parler. Elle n'a d'effet que si le plugin réseau du cluster l'applique (ici [Calico](../outils/calico.md)). |
| **Refus par défaut** | Principe qui consiste à tout interdire, puis à autoriser explicitement chaque échange nécessaire. |
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
| **Politiques réseau** | Refus par défaut en entrée, puis une règle par composant (Calico) | Un pod compromis ne peut pas ouvrir de connexion vers un composant dont il n'est pas l'un des appelants prévus. |
| **Compte de service** | Un par composant, sans droit sur l'API de Kubernetes | Les composants ne partagent plus d'identité : le maillage peut limiter chacun à ce qu'il doit joindre (voir [Istio](../outils/istio.md)). |
| **Variables de liaison** | Désactivées | Kubernetes n'injecte pas d'adresses de services sous forme de variables, qui entraient en collision avec celles des applications. |
| **Ressources plafonnées** | Processeur et mémoire, sur chaque conteneur | Un composant emballé ne peut pas priver les autres de ressources. |

Les identifiants d'exécution sont choisis pour chaque image : 1000 pour l'API et la modération, 101 pour l'interface,
472 pour Grafana, 473 pour Alloy, 10001 pour Loki, 65534 pour Prometheus.

**La seule exception : Alloy**
Alloy est le seul composant à recevoir un jeton de cluster, parce qu'il doit interroger Kubernetes pour savoir quels
pods existent et lire leurs logs. Ses droits sont limités à la lecture des pods et de leurs logs, et à rien
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

**Qui peut joindre quoi : les politiques réseau**
Dans un cluster Kubernetes, tout pod peut joindre n'importe quel autre. Une **politique réseau** supprime cette
liberté. Le projet applique le **refus par défaut** : une première politique coupe toute connexion entrante vers les pods
du namespace `pme`, puis une politique par composant rouvre uniquement les appelants prévus. [Calico](../outils/calico.md)
applique ces règles au niveau du réseau du cluster, avant que la connexion n'atteigne le pod.

Ce filtre s'ajoute à celui du maillage [Istio](../outils/istio.md) : les deux utilisent les mêmes listes d'appelants, mais
le premier lit l'**étiquette** du pod appelant, le second son **identité** cryptographique. Un appel doit passer par les
deux.

| Composant appelé | Port | Appelants autorisés |
|---|---|---|
| **PostgreSQL** | 5432 | API, service de modération, Keycloak, Grafana, Adminer |
| **NATS** | 4222 | API, service de modération |
| **Keycloak** | 8080 | Ingress (Traefik : connexion et clés des jetons), API, service de modération, tâche d'administration |
| **Garage** | 3900 | API (écriture des photos), Ingress (Traefik : lecture par URL signée). Le service de modération n'y a aucun accès, et le port d'administration (3903) n'est ouvert à personne |
| **API** | 3000 | Ingress (Traefik), Prometheus |
| **Service de modération** | 3001 | Ingress (Traefik), Prometheus |
| **Interface** | 8080 | Ingress (Traefik) |
| **Adminer** | 8080 | Ingress (Traefik) |
| **Grafana** | 3000 | Ingress (Traefik) |
| **Prometheus** | 9090 | Ingress (Traefik), Grafana |
| **Loki** | 3100 | Grafana, Alloy |
| **Alloy** | 12345 | Ingress (Traefik) |
| **Tout autre appelant ou port** | Tous | Personne : refus par défaut |

Chaque règle ouvre aussi le port 15008 aux mêmes appelants : c'est celui du tunnel que le maillage utilise entre les
pods. Le port de supervision de NATS (8222) n'est ouvert à personne. Les sondes de santé de Kubernetes ne sont pas
bloquées, car le trafic d'un nœud vers ses propres pods est toujours autorisé. `make netpol-check` vérifie ce filtre.

Garage reçoit les mêmes réglages que les autres composants (sans droit d'administrateur, capacités retirées, disque en lecture
seule, aucun jeton de cluster) et son image est **épinglée par empreinte** (`sha256`) : la version vérifiée par la pipeline est
exactement celle qui s'exécute, même si l'étiquette de l'image était un jour réécrite.

**Des images qui n'embarquent que le nécessaire**
Les trois images sont construites en plusieurs étapes : les premières installent et compilent, la dernière ne reçoit que le résultat. Les
sources, les outils de développement et les dépendances de compilation restent dans l'étape de construction et ne sont
jamais livrés. L'interface est servie par une variante de nginx prévue pour s'exécuter sans privilège.

Les images de l'API et de la modération ne contiennent pas non plus `npm`, `corepack` ni `yarn` : ces outils de l'image Node ne servent pas à lancer l'application, et leurs paquets embarqués portaient des failles signalées par Trivy. L'image de l'interface met à jour ses paquets système à la construction, pour la même raison.

Cela n'est pas seulement déclaré, c'est vérifié à chaque passage de la pipeline :

| Contrôle | Ce qu'il vérifie |
|---|---|
| **[Hadolint](../pipeline/controle-dockerfile.md)** | Les recettes de construction, avant même de bâtir l'image. |
| **[container-structure-test](../pipeline/tests-images.md)** | 24 contrôles sur les images : compte non administrateur, absence de sources, absence de fichier `.env`, port et commande de démarrage attendus. |
| **[Trivy](../pipeline/analyse-dependances.md)** | Les failles connues des paquets livrés et des dépendances de développement. |

!!! note "À savoir"
    PostgreSQL, NATS et Adminer ne fixent pas d'identifiant d'exécution : leurs images démarrent en administrateur puis
    abandonnent elles-mêmes ces droits pour leur propre compte. C'est le fonctionnement prévu par leurs éditeurs ; les
    autres réglages, eux, leur sont bien appliqués.

## Ce qui n'est pas couvert

- **Les connexions sortantes ne sont pas filtrées.** Les politiques réseau ne contrôlent que ce qui entre dans un pod.
  Cela vaut aussi pour Traefik, qui télécharge son plugin de contrôle des jetons depuis GitHub à chaque démarrage : filtrer
  les sorties imposerait de lui ouvrir cette destination.
  Un pod compromis pourrait donc ouvrir une connexion vers l'extérieur du cluster, par exemple pour exfiltrer des
  données, ou vers un composant dont la politique d'entrée l'autorise. Filtrer les sorties demanderait de déclarer, pour
  chaque composant, les destinations qu'il a le droit de joindre, y compris le service de noms (DNS) du cluster.
- **Les politiques réseau lisent des étiquettes, pas des identités.** Elles s'appuient sur les étiquettes des pods, qu'un
  administrateur du namespace peut modifier. L'identité cryptographique des pods, vérifiée par le maillage
  [Istio](../outils/istio.md), complète ce filtre.
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
- **Le contrôle à l'admission s'arrête au niveau `baseline`.** Le namespace `pme` applique bien les standards de
  sécurité des pods intégrés à Kubernetes : `baseline` est imposé, ce qui écarte les conteneurs privilégiés et les accès
  à l'hôte. Mais `restricted`, le niveau qui exigerait le compte non-root et le disque en lecture seule partout, n'est
  qu'audité : les écarts sont signalés dans les logs de l'API Kubernetes sans rien bloquer, parce que PostgreSQL
  démarre en root pour initialiser son volume. Aucun des réglages plus fins décrits dans cette page — capacités
  retirées, jeton du cluster non monté, compte de service dédié — n'est donc imposé à l'admission : un pod déployé à la
  main dans `pme` peut tous les ignorer. Un moteur de politiques (Kyverno, Gatekeeper) serait nécessaire pour les
  rendre obligatoires.
- **Des failles HIGH connues dans les images d'Istio.** L'analyse en relève plusieurs dizaines par image (bibliothèque
  standard Go, paquets Ubuntu), toutes corrigeables par une nouvelle version d'Istio. Elles sont suivies, sans bloquer la
  pipeline. La montée de version d'Istio (`ISTIO_VERSION` dans le `Makefile`) est le remède.
- **Pas de signature des images.** Rien ne prouve, au déploiement, que l'image provient bien de la pipeline du projet.

## Commandes de vérification

À lancer dans un terminal, depuis le dossier du projet, la plateforme déployée.

| Commande | Description |
|---|---|
| **`make image-test`** | Rejoue les 24 contrôles de structure et l'analyse Trivy sur les trois images. |
| **`make lint-docker`** | Contrôle les quatre Dockerfile avec Hadolint. |
| **`make lint-k8s`** | Valide les manifestes Kubernetes. |
| **`make netpol-check`** | Vérifie les politiques réseau : un pod sans l'étiquette prévue est coupé, même avec la bonne identité. |
| **`make istio-scan`** | Analyse Trivy des trois images d'Istio : affiche les failles HIGH, et échoue s'il reste une faille CRITICAL corrigeable. |
| **`kubectl -n istio-system get pod`**<br>**`-l k8s-app=istio-cni-node -o yaml`**<br>**`\| grep -A1 seccompProfile`** | Montre que le profil `RuntimeDefault` est bien appliqué à l'agent istio-cni. |
| **`kubectl -n pme exec deploy/pme-api -- id`** | Montre l'identifiant du compte qui exécute l'API : il ne doit pas valoir 0. |

Pour vérifier le disque en lecture seule, essayer d'écrire un fichier dans le conteneur de l'API : la commande échoue,
sauf dans l'espace temporaire monté à cet effet.

!!! warning "Attention"
    Le disque en lecture seule casse tout composant qui écrit ailleurs que dans son espace temporaire : un cache, un
    fichier de session, un log sur disque. C'est à vérifier avant d'activer le réglage sur un nouveau service, pas
    après.

!!! tip "Astuce"
    `kubectl -n pme get pod <nom> -o yaml` affiche les réglages réellement appliqués à un pod, y compris ceux qu'il
    hérite du niveau du pod. C'est la source de vérité, plus fiable que la relecture du manifeste.

## Fichiers principaux

| Fichier ou dossier | Description |
|---|---|
| **`k8s/04-api.yaml`**<br>**`k8s/05-moderation.yaml`** | Réglages les plus complets : compte sans privilège, disque en lecture seule, capacités retirées. |
| **`k8s/06-frontend.yaml`** | Mêmes réglages pour l'interface, avec le compte de nginx non privilégié. |
| **`k8s/13-alloy.yaml`** | La seule exception : jeton de cluster et droits de lecture sur les pods. |
| **`k8s/18-network-policies.yaml`** | Refus par défaut des connexions entrantes, puis une règle par composant qui nomme ses appelants. |
| **`api/Dockerfile`**<br>**`moderation-service/Dockerfile`**<br>**`frontend/Dockerfile`** | Construction en plusieurs étapes, image finale sans outils de développement ni `npm`. |
| **`tests/image/`** | Les 24 contrôles de structure appliqués aux images. |
| **`k8s/istio/namespace.yaml`**<br>**`k8s/istio/cni-values.yaml`** | Namespace dédié aux composants privilégiés du maillage, et profil seccomp de l'agent istio-cni. |
| **`.hadolint.yaml`** | Niveau à partir duquel un écart de Dockerfile fait échouer la pipeline. |

## Pour aller plus loin

- [Standards de sécurité des pods de Kubernetes](https://kubernetes.io/docs/concepts/security/pod-security-standards/)
- [Politiques réseau de Kubernetes](https://kubernetes.io/docs/concepts/services-networking/network-policies/)
- [Fiche Trivy du projet](../outils/trivy.md)
- [Fiche container-structure-test du projet](../outils/container-structure-test.md)
