# One image for the API gateway and all 15 backend services (and database migrations).
# Each container runs a different entry point: `node apps/<service>/dist/index.js`.
# Built for the server's architecture in CI (linux/arm64 for Graviton, linux/amd64 for Intel).

FROM node:20.19-bookworm-slim AS build
WORKDIR /app
ENV PNPM_HOME=/pnpm PATH=/pnpm:$PATH CI=true
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate

COPY . .

# Everything except the phone app and the website (they have their own build).
RUN pnpm install --frozen-lockfile \
      --filter "./packages/**" \
      --filter "./apps/*-service" \
      --filter "@youmart/api-gateway"

# Prisma's config reads the repo-root .env; a placeholder is enough to generate the client.
RUN printf 'DATABASE_URL=postgresql://build:build@localhost:5432/build\n' > .env \
 && pnpm --filter @youmart/db exec prisma generate \
 && rm .env

RUN pnpm -r \
      --filter "./packages/**" \
      --filter "./apps/*-service" \
      --filter "@youmart/api-gateway" \
      --if-present run build

FROM node:20.19-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production PNPM_HOME=/pnpm PATH=/pnpm:$PATH
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate \
 && apt-get update && apt-get install -y --no-install-recommends ca-certificates tini \
 && rm -rf /var/lib/apt/lists/*

# The built workspace (compiled dist/ + installed node_modules + generated Prisma client).
COPY --from=build /app /app

# Runs as the image's unprivileged `node` user. /app/.env is mounted read-only by compose.
RUN mkdir -p /app/storage && chown -R node:node /app/storage
USER node

ENTRYPOINT ["/usr/bin/tini", "--"]
# compose sets the command per service, e.g. ["node", "apps/order-service/dist/index.js"]
CMD ["node", "apps/api-gateway/dist/index.js"]
