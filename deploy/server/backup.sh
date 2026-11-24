#!/usr/bin/env bash
# Nightly database backup (cron, 03:30 IST - see bootstrap.sh): a compressed pg_dump of the whole
# database, uploaded to S3 with the instance's IAM role. The S3 bucket's lifecycle rule decides how
# long copies are kept (deploy/README.md, step 3). Daily disk snapshots (AWS Backup) are the
# second layer.
set -euo pipefail
cd /opt/youmart

ADMIN_USER="$(grep -E '^POSTGRES_USER=' .env | cut -d= -f2-)"
DB_NAME="$(grep -E '^POSTGRES_DB=' .env | cut -d= -f2-)"
TARGET="$(grep -E '^BACKUP_S3_URI=' .env | cut -d= -f2-)"
STAMP="$(date +%Y-%m-%d_%H%M)"
FILE="backups/youmart_${STAMP}.dump"

echo "== $(date) backup ${FILE}"
docker compose -f docker-compose.prod.yml --env-file .env exec -T postgres \
  pg_dump -U "$ADMIN_USER" -d "$DB_NAME" --format=custom --compress=6 > "$FILE"

aws s3 cp "$FILE" "${TARGET%/}/youmart_${STAMP}.dump" --only-show-errors
echo "uploaded $(du -h "$FILE" | cut -f1) to ${TARGET%/}/"

# Keep only the last 3 local copies (S3 holds the history).
ls -1t backups/youmart_*.dump | tail -n +4 | xargs -r rm -f
