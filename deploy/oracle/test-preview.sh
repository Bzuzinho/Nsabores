#!/usr/bin/env bash
set -euo pipefail
: "${PREVIEW_HOST:?}" "${CA_CERT:?}"
fetch() {
  curl --silent --show-error --fail --max-time 20 --cacert "$CA_CERT" --resolve "$PREVIEW_HOST:443:127.0.0.1" "https://$PREVIEW_HOST$1"
}
for route in / /loja /gestao; do
  page=$(fetch "$route")
  [[ -n "$page" ]] || { echo "Resposta vazia em $route" >&2; exit 1; }
done
fetch /v1/categories | python3 -c 'import json,sys; assert isinstance(json.load(sys.stdin), list)'
