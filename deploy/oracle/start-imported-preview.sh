#!/usr/bin/env bash
set -euo pipefail
umask 077
tag=78d699f7f892517592761875b74e97cb02ca692b
[[ $(hostname -s) == nsabores-vnic && $EUID == 0 ]]
docker image inspect "nsabores:$tag" >/dev/null
install -d -m 700 /etc/nsabores /opt/nsabores/deploy/oracle
exec 9>/etc/nsabores/preview.lock
flock -n 9
cd /opt/nsabores/deploy/oracle
tmp=$(mktemp -d)
trap 'rm -rf -- "$tmp"' EXIT
for file in compose.yaml Caddyfile restore-preview.sh; do
  curl -fsSL "https://raw.githubusercontent.com/Bzuzinho/Nsabores/$tag/deploy/oracle/$file" -o "$tmp/$file"
  install -m 600 "$tmp/$file" "$file"
done
mapfile -d '' dumps < <(find /home/ubuntu -type f -name production.dump -print0)
if (( ${#dumps[@]} != 1 )); then
  echo "Esperava encontrar um único production.dump na pasta do utilizador ubuntu."; exit 1
fi
dump=${dumps[0]}
(cd "$(dirname "$dump")" && sha256sum -c production.dump.sha256)
envfile=/etc/nsabores/preview.env
if [[ ! -e $envfile ]]; then
  envtmp=$(mktemp /etc/nsabores/env.XXXXXXXX)
  {
    echo "APP_TAG=$tag"
    echo PREVIEW_HOST=nsabores.test
    for key in DB_ADMIN_PASSWORD APP_DB_PASSWORD AUTH_SECRET PAYMENT_HOOK SHIPPING_HOOK CLUB_HOOK; do
      secret=$(openssl rand -hex 32)
      echo "$key=$secret"
    done
  } > "$envtmp"
  mv "$envtmp" "$envfile"
fi
dc=(docker compose --env-file "$envfile")
"${dc[@]}" config -q
"${dc[@]}" pull proxy
"${dc[@]}" up -d --wait --no-build --pull never db
dbid=$("${dc[@]}" exec -T db psql -XAt -U postgres -d nsabores -c 'SELECT system_identifier FROM pg_control_system()')
sig="$dbid $(sha256sum "$dump" | cut -d' ' -f1)"
marker=/etc/nsabores/preview-restored
if [[ ! -f $marker || $(cat "$marker") != "$sig" ]]; then
  bash restore-preview.sh "$dump"
  echo "$sig" > "$marker"
fi
"${dc[@]}" up -d --no-build --pull never
"${dc[@]}" ps
for attempt in {1..60}; do
  if "${dc[@]}" exec -T proxy cat /data/caddy/pki/authorities/local/root.crt > "$tmp/ca.pem" 2>/dev/null && [[ -s $tmp/ca.pem ]]; then break; fi
  sleep 2
done
fetch=(curl --silent --show-error --fail --max-time 12 --cacert "$tmp/ca.pem" --resolve nsabores.test:443:127.0.0.1)
for route in /v1/categories / /loja /gestao; do
  ok=false
  for attempt in {1..24}; do
    if status=$("${fetch[@]}" -o "$tmp/body" -w '%{http_code}' "https://nsabores.test$route" 2>"$tmp/error"); then
      if [[ $route == /v1/categories ]]; then
        if [[ $status == 200 ]] && python3 -c 'import json,sys; sys.exit(not isinstance(json.load(open(sys.argv[1])),list))' "$tmp/body"; then ok=true; fi
      elif [[ $status == 200 && -s $tmp/body || $route == /gestao && $status =~ ^30[1278]$ ]]; then ok=true; fi
    fi
    if $ok; then break; fi
    sleep 5
  done
  echo "$route HTTP $status"
  if ! $ok; then cat "$tmp/error"; "${dc[@]}" ps; exit 1; fi
done
echo 'ENSAIO HTTPS LOCAL OK'
