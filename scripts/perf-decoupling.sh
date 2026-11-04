#!/usr/bin/env bash
# Depose des annonces avec le service de moderation en marche, puis arrete : les temps de reponse doivent rester
# sous le meme seuil. Le service est relance a la fin, meme en cas d'echec.
# Usage : make perf-decoupling   (necessite k6, kubectl et une limitation de debit relevee : make perf-prepare)
set -euo pipefail

NS="${NS:-pme}"
DIR="$(cd "$(dirname "$0")/.." && pwd)"
OUT="$(mktemp -d)"

trap 'kubectl -n "$NS" scale deployment pme-moderation --replicas=1 >/dev/null' EXIT

run_phase() {
  echo
  echo "=== $2 ==="
  k6 run -e PHASE="$1" --summary-export "$OUT/$1.json" "$DIR/tests/performance/decoupling.js"
}

run_phase up "Phase 1 : service de moderation en marche"

kubectl -n "$NS" scale deployment pme-moderation --replicas=0 >/dev/null
kubectl -n "$NS" wait --for=delete pod -l app=pme-moderation --timeout=90s >/dev/null 2>&1 || true
run_phase down "Phase 2 : service de moderation arrete"

echo
echo "=== Messages en attente dans RabbitMQ (moderation arretee) ==="
kubectl -n "$NS" exec deploy/rabbitmq -- rabbitmqctl list_queues name messages consumers

python3 - "$OUT" <<'PY'
import json, sys
out = sys.argv[1]
def p95(phase):
    metrics = json.load(open(f"{out}/{phase}.json"))["metrics"]
    for key in ("http_req_duration{name:create_listing}", "http_req_duration"):
        if key in metrics:
            return metrics[key].get("p(95)")
print()
print("p95 du depot, service de moderation en marche : %.0f ms" % p95("up"))
print("p95 du depot, service de moderation arrete    : %.0f ms" % p95("down"))
PY
