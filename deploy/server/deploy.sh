#!/usr/bin/env bash
# Deploys a built version (run on the server; GitHub Actions calls it through Session Manager):
#   /opt/youmart/server/deploy.sh <image-tag>      # e.g. the git commit sha
# Pulls the images, runs database migrations, re-applies the per-service database passwords,
# restarts what changed and checks the gateway is healthy. Exits non-zero if anything fails.
set -euo pipefail
cd /opt/youmart

TAG="${1:-latest}"
COMPOSE=(docker compose -f docker-compose.prod.yml --env-file .env)

echo "== deploying tag ${TAG}"
if grep -q '^IMAGE_TAG=' .env; then
  sed -i "s/^IMAGE_TAG=.*/IMAGE_TAG=${TAG}/" .env
else
  echo "IMAGE_TAG=${TAG}" >> .env
fi

"${COMPOSE[@]}" pull --quiet

echo '== database'
"${COMPOSE[@]}" up -d postgres redis typesense
"${COMPOSE[@]}" run --rm migrate
/opt/youmart/server/set-db-passwords.sh

echo '== services'
"${COMPOSE[@]}" up -d --remove-orphans

echo '== health check'
for i in $(seq 1 30); do
  if "${COMPOSE[@]}" exec -T gateway node -e \
      "fetch('http://localhost:4000/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"; then
    echo "gateway healthy"
    docker image prune -f --filter 'until=168h' >/dev/null
    echo "== deployed ${TAG}"
    exit 0
  fi
  sleep 5
done
echo 'gateway did not become healthy - check: docker compose -f docker-compose.prod.yml logs --tail=100'
exit 1
