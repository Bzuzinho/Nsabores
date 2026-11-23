#!/usr/bin/env bash
# O cron/systemd fornece RESTIC_REPOSITORY, RESTIC_PASSWORD_FILE e acesso ao destino privado.
set -euo pipefail
umask 077
cd -- "$(dirname -- "$0")"
: "${RESTIC_REPOSITORY:?}" "${RESTIC_PASSWORD_FILE:?}" "${TMPDIR:?diretório privado com espaço para a BD}"
file=$(mktemp "$TMPDIR/nsabores.XXXXXXXX")
trap 'rm -f -- "$file"' EXIT
docker compose --env-file /etc/nsabores/preview.env exec -T db pg_dump -U postgres -d nsabores -Fc > "$file"
docker compose --env-file /etc/nsabores/preview.env exec -T db pg_restore --list < "$file" >/dev/null
restic backup --tag nsabores --stdin --stdin-filename nsabores.dump < "$file"
