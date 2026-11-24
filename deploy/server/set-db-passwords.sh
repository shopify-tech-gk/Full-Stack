#!/usr/bin/env bash
# The database migrations create one login per service (auth_svc, orders_svc, ...) with the
# DEVELOPMENT passwords written in the migration files. This sets each of them to the password in
# that service's *_DATABASE_URL in /opt/youmart/.env, so production never runs with a known
# password. deploy.sh runs it after every migration; safe to run any time.
# Use letters and digits only in these passwords (they sit inside URLs).
set -euo pipefail
cd /opt/youmart

ADMIN_USER="$(grep -E '^POSTGRES_USER=' .env | cut -d= -f2-)"
DB_NAME="$(grep -E '^POSTGRES_DB=' .env | cut -d= -f2-)"

grep -E '^[A-Z_]*DATABASE_URL=postgresql://' .env | while IFS='=' read -r key url; do
  creds="${url#postgresql://}"
  creds="${creds%%@*}"
  user="${creds%%:*}"
  pass="${creds#*:}"
  if [ "$user" = "$ADMIN_USER" ]; then continue; fi
  if [ -z "$pass" ] || [ "$pass" = "CHANGE_ME" ]; then
    echo "!! ${key}: password not set in .env - fill it in" >&2
    exit 1
  fi
  if ! [[ "$pass" =~ ^[A-Za-z0-9]+$ ]]; then
    echo "!! ${key}: use letters and digits only in database passwords" >&2
    exit 1
  fi
  docker compose -f docker-compose.prod.yml --env-file .env exec -T postgres \
    psql -v ON_ERROR_STOP=1 -q -U "$ADMIN_USER" -d "$DB_NAME" \
    -c "DO \$\$ BEGIN IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = '${user}') THEN ALTER ROLE \"${user}\" PASSWORD '${pass}'; END IF; END \$\$;"
  echo "password set for ${user}"
done
