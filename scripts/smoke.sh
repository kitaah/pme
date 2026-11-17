#!/bin/sh
# Test de fumee : verifie, en une commande, que la plateforme deployee fonctionne de bout en bout (make smoke).
# Il ne laisse aucune donnee (l'image de test est supprimee) et ne demande aucune connexion : il lit l'etat du cluster et interroge l'ingress comme un
# visiteur anonyme. Chaque ligne affiche OK ou KO ; le code de sortie est 1 si au moins un controle echoue.
#
# Cinq familles de controles :
#   1. les douze deploiements sont disponibles ;
#   2. PostgreSQL : chaque compte de service ouvre SA base, et seulement elle (mot de passe, TLS et droits reels) ;
#   3. les donnees de base sont la : tables, listes de reference, flux NATS, bucket des photos ;
#   4. l'ingress repond comme prevu : site public, Keycloak joignable, API et moderation fermees sans jeton ;
#   5. les photos : une image aleatoire est envoyee dans Garage, relue, lue par URL signee a travers Traefik, puis supprimee.
set -u

NS="${NS:-pme}"
TRAEFIK_NS="${TRAEFIK_NS:-traefik}"
APP_HOST="${APP_HOST:-pme.localhost}"
KEYCLOAK_HOST="${KEYCLOAK_HOST:-keycloak.localhost}"

ok=0
ko=0

# ok_if LIBELLE COMMANDE... : OK si la commande reussit.
ok_if() {
  label=$1
  shift
  if "$@" >/dev/null 2>&1; then
    printf '  OK  %s\n' "$label"
    ok=$((ok + 1))
  else
    printf '  KO  %s\n' "$label"
    ko=$((ko + 1))
  fi
}

# refused LIBELLE COMMANDE... : OK si le SERVEUR refuse (la commande echoue ET le message contient FATAL). Un echec sans FATAL
# (pod introuvable, delai depasse) n'est pas un refus : il est compte KO, pour qu'un test ne reussisse pas par accident.
refused() {
  label=$1
  shift
  out=$("$@" 2>&1)
  rc=$?
  if [ "$rc" -ne 0 ] && printf '%s' "$out" | grep -q 'FATAL'; then
    printf '  OK  %s\n' "$label"
    ok=$((ok + 1))
  else
    printf '  KO  %s\n' "$label"
    ko=$((ko + 1))
  fi
}

# pg_login UTILISATEUR VARIABLE_DU_MOT_DE_PASSE BASE MODE_TLS : ouvre une vraie connexion par le reseau du pod PostgreSQL.
# La connexion part de l'adresse du pod (et non de 127.0.0.1, qui est en confiance) : elle subit donc les regles de
# pg_hba.conf, le TLS et le contrôle du mot de passe, comme celle d'un autre pod. Les mots de passe sont lus dans
# l'environnement du pod PostgreSQL (variables DB_*_PASSWORD), jamais affiches.
pg_login() {
  kubectl -n "$NS" exec deploy/postgres -- sh -c '
    h=$(hostname -i | cut -d" " -f1)
    eval "pw=\${$2}"
    PGPASSWORD="$pw" PGSSLMODE="$4" PGCONNECT_TIMEOUT=5 psql -h "$h" -U "$1" -d "$3" -tAc "select 1"
  ' sh "$1" "$2" "$3" "$4"
}

# sql_true BASE REQUETE : OK si la requete (compte d'administration, socket du pod) renvoie « t ».
sql_true() {
  out=$(kubectl -n "$NS" exec deploy/postgres -- sh -c 'psql -U "$POSTGRES_USER" -d "$1" -tAc "$2"' sh "$1" "$2" 2>/dev/null)
  [ "$out" = "t" ]
}

echo "== 1. Deploiements"
for d in postgres nats rabbitmq keycloak garage pme-api pme-moderation pme-frontend grafana prometheus loki alloy adminer; do
  ok_if "$d disponible" kubectl -n "$NS" wait --for=condition=available "deploy/$d" --timeout=10s
done

echo "== 2. Comptes PostgreSQL (un par service, limite a sa base)"
ok_if "adresse du pod PostgreSQL hors boucle locale (sinon pg_hba.conf ne s'applique pas au test)" \
  kubectl -n "$NS" exec deploy/postgres -- sh -c 'case $(hostname -i | cut -d" " -f1) in 127.*|::1) exit 1 ;; esac'
ok_if "pme_api ouvre la base pme" pg_login pme_api DB_API_PASSWORD pme require
ok_if "pme_moderation ouvre la base moderation" pg_login pme_moderation DB_MODERATION_PASSWORD moderation require
ok_if "pme_keycloak ouvre la base keycloak" pg_login pme_keycloak DB_KEYCLOAK_PASSWORD keycloak require
ok_if "pme_grafana ouvre la base grafana" pg_login pme_grafana DB_GRAFANA_PASSWORD grafana require
refused "pme_api refuse sur la base moderation" pg_login pme_api DB_API_PASSWORD moderation require
refused "pme_moderation refuse sur la base pme" pg_login pme_moderation DB_MODERATION_PASSWORD pme require
refused "pme_keycloak refuse sur la base grafana" pg_login pme_keycloak DB_KEYCLOAK_PASSWORD grafana require
refused "pme_grafana refuse sur la base keycloak" pg_login pme_grafana DB_GRAFANA_PASSWORD keycloak require
refused "mauvais mot de passe refuse" pg_login pme_api DB_MODERATION_PASSWORD pme require
refused "connexion en clair refusee (sans TLS)" pg_login pme_api DB_API_PASSWORD pme disable

echo "== 3. Donnees de base"
ok_if "table listings (base pme)" sql_true pme "select to_regclass('public.listings') is not null"
ok_if "categories remplie" sql_true pme "select count(*) > 0 from categories"
ok_if "handover_places remplie" sql_true pme "select count(*) > 0 from handover_places"
ok_if "table moderation_queue (base moderation)" sql_true moderation "select to_regclass('public.moderation_queue') is not null"
ok_if "realm Keycloak importe (base keycloak)" sql_true keycloak "select count(*) > 0 from realm where name = 'pme'"
ok_if "flux NATS LISTINGS present" sh -c "kubectl -n '$NS' exec deploy/nats -- wget --no-check-certificate -qO- 'https://localhost:8222/jsz?streams=1' | grep -q LISTINGS"
ok_if "file RabbitMQ listing.submitted presente" sh -c "kubectl -n '$NS' exec deploy/rabbitmq -- rabbitmqctl list_queues name | grep -q listing.submitted"
ok_if "bucket pme-photos present dans Garage" kubectl -n "$NS" exec deploy/garage -- /garage bucket info pme-photos

echo "== 4. Ingress (visiteur anonyme)"
ip=$(kubectl -n "$TRAEFIK_NS" get svc traefik -o jsonpath='{.spec.clusterIP}' 2>/dev/null)
if [ -z "$ip" ]; then
  printf '  KO  service traefik introuvable (make ingress)\n'
  ko=$((ko + 1))
else
  kubectl -n default delete pod smoke-http --ignore-not-found --now >/dev/null 2>&1
  kubectl -n default run smoke-http --restart=Never --image=curlimages/curl --env="IP=$ip" --command -- sh -c '
    code() { curl -sk -m 10 -o /dev/null -w "%{http_code}" --resolve "$1:443:$IP" "https://$1$2"; }
    echo "site $(code '"$APP_HOST"' /)"
    echo "keycloak $(code '"$KEYCLOAK_HOST"' /realms/pme/.well-known/openid-configuration)"
    echo "listings $(code '"$APP_HOST"' /api/v1/listings/mine)"
    echo "categories $(code '"$APP_HOST"' /api/v1/categories)"
    echo "moderation $(code '"$APP_HOST"' /api/v1/moderation/queue)"
    echo "http-vers-https $(curl -s -m 10 -o /dev/null -w "%{http_code}" --resolve "'"$APP_HOST"':80:$IP" "http://'"$APP_HOST"'/")"
  ' >/dev/null 2>&1
  kubectl -n default wait --for=jsonpath='{.status.phase}'=Succeeded pod/smoke-http --timeout=90s >/dev/null 2>&1
  res=$(kubectl -n default logs smoke-http 2>/dev/null)
  kubectl -n default delete pod smoke-http --now >/dev/null 2>&1
  got() { printf '%s\n' "$res" | sed -n "s/^$1 //p"; }
  expect() { # LIBELLE CLE ATTENDU
    v=$(got "$2")
    if [ "$v" = "$3" ]; then
      printf '  OK  %s (HTTP %s)\n' "$1" "$v"
      ok=$((ok + 1))
    else
      printf '  KO  %s (attendu : HTTP %s, obtenu : %s)\n' "$1" "$3" "${v:-aucune reponse}"
      ko=$((ko + 1))
    fi
  }
  expect "site public" site 200
  expect "Keycloak : configuration OpenID du realm pme" keycloak 200
  expect "API listings fermee sans jeton" listings 401
  expect "API categories fermee sans jeton" categories 401
  expect "moderation fermee sans jeton" moderation 401
  # Traefik repond 301 ou 308 selon sa version : toute redirection permanente convient.
  case "$(got http-vers-https)" in
    301|308) printf '  OK  HTTP redirige vers HTTPS (HTTP %s)\n' "$(got http-vers-https)"; ok=$((ok + 1)) ;;
    *) printf '  KO  HTTP redirige vers HTTPS (obtenu : %s)\n' "$(got http-vers-https)"; ko=$((ko + 1)) ;;
  esac

  echo "== 5. Photos (image aleatoire : envoi, relecture, lecture par l'ingress, suppression)"
  dir=$(dirname "$0")
  # Le pod de l'API est le seul autorise a parler a Garage : le script s'execute donc dedans (cle et adresse deja presentes).
  put=$(kubectl -n "$NS" exec -i deploy/pme-api -- node - put <"$dir/smoke-photo.js" 2>&1)
  sha=$(printf '%s\n' "$put" | sed -n 's/^SHA //p')
  url=$(printf '%s\n' "$put" | sed -n 's/^URL //p')
  if [ -n "$sha" ] && [ -n "$url" ]; then
    printf '  OK  image aleatoire envoyee dans Garage par l'"'"'API, puis relue identique\n'
    ok=$((ok + 1))
    photo_host=$(printf '%s' "$url" | sed 's|^https://\([^/]*\)/.*|\1|')
    kubectl -n default delete pod smoke-photo --ignore-not-found --now >/dev/null 2>&1
    kubectl -n default run smoke-photo --restart=Never --image=curlimages/curl --env="IP=$ip" --env="H=$photo_host" --env="U=$url" \
      --command -- sh -c 'curl -sk -m 15 --resolve "$H:443:$IP" -o /tmp/p -w "code %{http_code}\n" "$U"; echo "sha $(sha256sum /tmp/p | cut -d" " -f1)"' >/dev/null 2>&1
    kubectl -n default wait --for=jsonpath='{.status.phase}'=Succeeded pod/smoke-photo --timeout=90s >/dev/null 2>&1
    res=$(kubectl -n default logs smoke-photo 2>/dev/null)
    kubectl -n default delete pod smoke-photo --now >/dev/null 2>&1
    if [ "$(printf '%s\n' "$res" | sed -n 's/^code //p')" = "200" ] && [ "$(printf '%s\n' "$res" | sed -n 's/^sha //p')" = "$sha" ]; then
      printf '  OK  lecture par URL signee a travers Traefik : meme image (HTTP 200)\n'
      ok=$((ok + 1))
    else
      printf '  KO  lecture par URL signee a travers Traefik (%s)\n' "$(printf '%s' "$res" | tr '\n' ' ')"
      ko=$((ko + 1))
    fi
  else
    printf '  KO  envoi de l'"'"'image dans Garage (%s)\n' "$(printf '%s' "$put" | tail -n 1)"
    ko=$((ko + 1))
  fi
  ok_if "image de test supprimee de Garage" sh -c "kubectl -n '$NS' exec -i deploy/pme-api -- node - delete <'$dir/smoke-photo.js'"
fi

echo
echo "Resultat : $ok OK, $ko KO"
[ "$ko" -eq 0 ]
