#!/usr/bin/env bash
set -Eeuo pipefail

# Runs on the Oracle VM as root, from a systemd timer. No GitHub credentials needed:
# the public, quality-gated :production image is pulled from GHCR.
exec 9>/run/lock/nsabores-auto-deploy.lock
flock -n 9 || exit 0

APP_DIR=/opt/nsabores/deploy/oracle
ENV_FILE=/etc/nsabores/preview.env
STATE_DIR=/var/lib/nsabores-auto-deploy
REGISTRY_IMAGE=ghcr.io/bzuzinho/nsabores:production
mkdir -p "$STATE_DIR"
chmod 700 "$STATE_DIR"
cd "$APP_DIR"

get_app_tag() {
  sed -n 's/^APP_TAG=//p' "$ENV_FILE" | head -n 1
}

previous_tag="$(get_app_tag)"
if [[ -z "$previous_tag" ]] || ! docker image inspect "nsabores:$previous_tag" >/dev/null 2>&1; then
  echo "Refusing deployment: current local image is not available for rollback."
  exit 1
fi

docker pull "$REGISTRY_IMAGE"
new_id="$(docker image inspect --format '{{.Id}}' "$REGISTRY_IMAGE")"
previous_id="$(docker image inspect --format '{{.Id}}' "nsabores:$previous_tag")"

if [[ "$new_id" == "$previous_id" ]]; then
  echo "Image unchanged: $new_id"
  exit 0
fi

new_tag="auto-${new_id#sha256:}"
new_tag="${new_tag:0:21}"
if [[ -e "$STATE_DIR/rejected-$new_tag" ]]; then
  echo "Skipping previously rejected release $new_tag."
  exit 0
fi

docker tag "$REGISTRY_IMAGE" "nsabores:$new_tag"
backup="$STATE_DIR/preview.env.before-$new_tag"
cp -p "$ENV_FILE" "$backup"
chmod 600 "$backup"

rollback() {
  echo "Health checks failed; reverting to $previous_tag"
  cp -p "$backup" "$ENV_FILE"
  docker compose --env-file "$ENV_FILE" up -d --no-deps --pull never api website management || true
  touch "$STATE_DIR/rejected-$new_tag"
  exit 1
}

trap rollback ERR
sed -i "s/^APP_TAG=.*/APP_TAG=$new_tag/" "$ENV_FILE"
docker compose --env-file "$ENV_FILE" up -d --no-deps --pull never api website management

healthy=0
for attempt in $(seq 1 36); do
  healthy=1
  for path in / /loja /gestao /v1/products; do
    status="$(curl -sS -o /dev/null -w '%{http_code}' --max-time 8 "https://www.nsabores.pt$path" || true)"
    if [[ "$status" != 200 ]]; then
      healthy=0
      break
    fi
  done
  admin_status="$(curl -sS -o /dev/null -w '%{http_code}' --max-time 8 https://www.nsabores.pt/v1/admin/users || true)"
  if [[ "$admin_status" != 401 ]]; then healthy=0; fi
  if docker compose --env-file "$ENV_FILE" exec -T db pg_isready -U postgres -d nsabores >/dev/null 2>&1; then
    :
  else
    healthy=0
  fi
  if [[ "$healthy" -eq 1 ]]; then break; fi
  sleep 5
done

if [[ "$healthy" -ne 1 ]]; then rollback; fi
trap - ERR
echo "Successfully deployed $new_tag ($new_id); previous version $previous_tag remains available."
