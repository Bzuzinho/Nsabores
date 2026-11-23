#!/usr/bin/env bash
# Executar antes do primeiro arranque da API. O dump vem da origem verificada.
set -euo pipefail
cd -- "$(dirname -- "$0")"
dump=${1:?indique o dump PostgreSQL em formato custom}
[[ -s "$dump" ]]
# Ficheiro local gerado pelo administrador, com valores hexadecimais e sem comandos.
set -a
source /etc/nsabores/preview.env
set +a
[[ "$APP_DB_PASSWORD" =~ ^[a-f0-9]{64}$ ]]
compose=(docker compose --env-file /etc/nsabores/preview.env)
db=("${compose[@]}" exec -T db)
"${db[@]}" pg_restore --list < "$dump" >/dev/null
"${db[@]}" psql -X -U postgres -d nsabores -v ON_ERROR_STOP=1 <<'SQL'
DO $$ BEGIN
  IF EXISTS (SELECT FROM pg_class c JOIN pg_namespace n ON c.relnamespace=n.oid
             WHERE n.nspname='public' AND c.relkind IN ('r','p','S','v','m','f'))
  THEN RAISE EXCEPTION 'O destino já contém dados'; END IF;
END $$;
SQL
# A palavra-passe via stdin evita incluí-la nos argumentos do processo.
printf "SELECT 'CREATE ROLE nsabores_app LOGIN' WHERE NOT EXISTS (SELECT FROM pg_roles WHERE rolname='nsabores_app')\\n\\\\gexec\\nALTER ROLE nsabores_app PASSWORD '%s';\\nGRANT CREATE, USAGE ON SCHEMA public TO nsabores_app;\\n" "$APP_DB_PASSWORD" |
  "${db[@]}" psql -X -q -U postgres -d nsabores -v ON_ERROR_STOP=1 >/dev/null
"${db[@]}" pg_restore --single-transaction --exit-on-error --no-owner --no-acl --role=nsabores_app -U postgres -d nsabores < "$dump"
