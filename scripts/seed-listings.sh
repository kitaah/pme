#!/bin/sh
# Annonces de demonstration pour un utilisateur Keycloak (make seed-listings SEED_USER=<identifiant>).
# Cree COUNT annonces PUBLIEES (statut PUBLISHED), chacune avec une image aleatoire envoyee dans Garage. L'API ne sait creer que
# des annonces en attente (la decision de moderation est hors perimetre du POC) : elles sont donc inserees directement en base,
# avec le compte d'administration PostgreSQL.
# Rien n'apparait dans l'annonce : `make seed-listings-clean` retrouve les annonces creees ici par leur photo, rangee sous published/
# (l'API, elle, ne range les photos que sous pending/).
#   sh scripts/seed-listings.sh seed  UTILISATEUR [NOMBRE]
#   sh scripts/seed-listings.sh clean UTILISATEUR
set -eu

NS="${NS:-pme}"
mode="${1:-}"
user="${2:-}"
count="${3:-6}"
here=$(dirname "$0")

if [ -z "$mode" ] || [ -z "$user" ]; then
  echo "Usage : make seed-listings SEED_USER=<identifiant Keycloak> [COUNT=6]" >&2
  exit 2
fi
case "$count" in '' | *[!0-9]* | 0) echo "COUNT doit etre un entier positif" >&2; exit 2 ;; esac
case "$user" in *[!A-Za-z0-9._@-]*) echo "Identifiant invalide : $user" >&2; exit 2 ;; esac

psql_in() { # BASE [options psql] : le SQL est lu sur l'entree standard
  db=$1
  shift
  kubectl -n "$NS" exec -i deploy/postgres -- sh -c 'db=$1; shift; psql -U "$POSTGRES_USER" -d "$db" -v ON_ERROR_STOP=1 -tAq "$@"' sh "$db" "$@"
}

# L'API ne stocke aucun compte : le proprietaire d'une annonce est le « sub » Keycloak, lu dans la base de Keycloak.
sub=$(printf "select id from user_entity where username = lower('%s') and realm_id = (select id from realm where name = 'pme');" "$user" | psql_in keycloak)
if [ -z "$sub" ]; then
  echo "Utilisateur « $user » introuvable dans le realm pme. Utilisateurs existants :" >&2
  echo "select username from user_entity where realm_id = (select id from realm where name = 'pme') order by 1;" | psql_in keycloak >&2
  exit 1
fi

photos() { kubectl -n "$NS" exec -i deploy/pme-api -- node - "$@" <"$here/seed-photos.js"; }

if [ "$mode" = "clean" ]; then
  keys=$(echo "select photo_key from listings where owner_id = '$sub' and status = 'PUBLISHED' and photo_key like 'published/%';" | psql_in pme)
  # shellcheck disable=SC2086
  [ -z "$keys" ] || photos delete $keys >/dev/null
  n=$(echo "with d as (delete from listings where owner_id = '$sub' and status = 'PUBLISHED' and photo_key like 'published/%' returning 1) select count(*) from d;" | psql_in pme)
  echo "$n annonce(s) de demonstration supprimee(s) pour $user."
  exit 0
fi

[ "$mode" = "seed" ] || { echo "Mode inconnu : $mode" >&2; exit 2; }

# Une cle d'objet par annonce, sous published/ (le prefixe des annonces publiees).
rows=""
keys=""
n=0
while [ "$n" -lt "$count" ]; do
  n=$((n + 1))
  key="published/$(cat /proc/sys/kernel/random/uuid 2>/dev/null || uuidgen).webp"
  keys="$keys $key"
  rows="$rows${rows:+,}($n,'PUBLISHED','$key')"
done

# shellcheck disable=SC2086
photos put $keys >/dev/null
echo "$n image(s) aleatoire(s) envoyee(s) dans Garage."

psql_in pme -v sub="$sub" -v owner="$user" <<SQL
insert into listings (owner_id, owner_username, title, description, condition, category_id, kind, price_cents,
                      wanted_in_exchange, handover_place_id, photo_key, photo_mime, status)
select :'sub', :'owner',
       t.title,
       t.description,
       (array['NEW','VERY_GOOD','GOOD','FAIR'])[1 + floor(random() * 4)::int],
       (select id from categories where active order by random() + v.n limit 1),
       t.kind,
       case when t.kind = 'SALE' then 500 + floor(random() * 9500)::int end,
       case when t.kind = 'EXCHANGE' then 'Un objet de l''univers de l''horreur' end,
       (select id from handover_places where active order by random() + v.n limit 1),
       v.key, 'image/webp', v.status
from (values $rows) as v(n, status, key)
cross join lateral (
  select (array['Masque de tueur en série','Figurine de vampire','Roman d''épouvante','Poupée hantée','Affiche de film culte',
                'Lot de DVD d''horreur','Cape de comte Dracula','Citrouille lumineuse','Grimoire décoratif','Squelette articulé'])[1 + (v.n * 7 + floor(random() * 10)::int) % 10] as title,
         (array['Objet en très bon état, à venir chercher en main propre.','Peu servi, vendu avec son emballage d''origine.','Pièce de collection, idéale pour une décoration d''Halloween.','Parfait pour une soirée à thème, jamais utilisé.'])[1 + floor(random() * 4)::int] as description,
         (array['EXCHANGE','GIFT','SALE'])[1 + (v.n % 3)] as kind
) t;
select status, count(*) from listings where owner_id = :'sub' and status = 'PUBLISHED' and photo_key like 'published/%' group by status order by status;
SQL
