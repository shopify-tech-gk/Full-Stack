# Running YouMart locally (ops reference)

This is the practical reference for running, probing, and debugging the
full backend locally or during a deploy. See `docs/contracts/` for API
contracts and `docs/testing/` for integration test records.

## 1. Infra prerequisites

- Docker Desktop running, with `docker/docker-compose.yml`'s 3 containers
  up: Postgres 16 (host port `5433`), Redis 7, Typesense (host port
  `8108`).
- Node 20.19+ (portable install recommended on Windows - prepend to PATH).
- `pnpm install` at the repo root, then `pnpm -r build`.
- A single root `.env` (never committed) that every service loads via
  `process.loadEnvFile` at startup - see `.env.example` for the full list
  of required keys per service.

## 2. Port map

| Service                                 | Port |
| --------------------------------------- | ---- |
| api-gateway (single public entry point) | 4000 |
| auth-service                            | 4001 |
| catalog-service                         | 4002 |
| inventory-service                       | 4003 |
| cart-service                            | 4004 |
| order-service                           | 4005 |
| payment-service                         | 4006 |
| seller-service                          | 4007 |
| settlement-service                      | 4008 |
| logistics-service                       | 4009 |
| returns-service                         | 4010 |
| address-service                         | 4011 |
| notification-service                    | 4012 |
| search-service                          | 4013 |
| invoice-service                         | 4014 |
| admin-service                           | 4015 |

In production/deploy, only the gateway (4000) should be publicly
reachable - every other port is internal-network-only. All client and
admin traffic goes through `http://<gateway>/api/*`.

## 3. Starting a service

Each service is `node apps/<name>/dist/index.js` after `pnpm --filter
@youmart/<name> build`. Locally: `pnpm --filter @youmart/<name> dev` runs
it under `tsx watch` for hot-reload. There is no orchestration script in
this repo yet (deferred to the real deploy chapter) - start each service
process independently, gateway last (so its `/health/services` aggregation
has something to report on).

## 4. Health & readiness

Every service (and the gateway) exposes two endpoints:

- `GET /health` - **liveness**. Never touches the DB/Redis/Typesense.
  Returns `{status:"ok", service:"<name>", uptime, timestamp}` in ~1ms.
  Use this for "is the process alive" checks (e.g. a container
  orchestrator's liveness probe) - it should basically never fail while
  the process is running, even during a transient DB blip.
- `GET /ready` - **readiness**. Actually checks the service's critical
  dependencies and returns `503 {"error":{"code":"INTERNAL_ERROR",
"message":"..."}}` if any are unreachable, `200 {"status":"ready"}`
  otherwise. Use this for "can it serve traffic" checks (e.g. a
  readiness probe gating load-balancer registration).

What each `/ready` checks:

| Service                                                                                    | Checks                                                                                                                                                                                                                                                                                               |
| ------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| address, admin, auth, cart, catalog, inventory, logistics, order, payment, returns, seller | Postgres (`SELECT 1` via its own least-privilege DB role)                                                                                                                                                                                                                                            |
| notification, settlement, invoice                                                          | Postgres **AND** Redis (each has a BullMQ worker that needs Redis to pick up jobs)                                                                                                                                                                                                                   |
| search                                                                                     | Typesense **AND** Redis (2 BullMQ workers: reindex + full-reindex)                                                                                                                                                                                                                                   |
| api-gateway                                                                                | No `/ready` of its own (nothing to be "ready" for - pure proxy). `GET /health/services` makes a LIVE `fetch` to every downstream service's own `/health` (3s timeout each, run in parallel) and reports `up`/`down` per service - a diagnostic aggregation, not a gate (always itself responds 200). |

## 5. Request-id tracing

The gateway generates (or passes through, if already present) an
`x-request-id` header on every inbound request and echoes it on the
response. From there:

1. Every backend service mounts `requestIdMiddleware` (from
   `@youmart/request-context`) as its first middleware - it reads the
   header (already forwarded by the gateway's proxy unchanged), stamps
   `req.requestId`, and wires it into pino-http's `genReqId` so the
   service's OWN log `req.id` field for that request equals the
   gateway's id (not an unrelated per-service counter).
2. The SAME id is also stored in a `node:async_hooks` `AsyncLocalStorage`
   context for the duration of the request. `@youmart/service-client`
   reads it from there and automatically adds `x-request-id` to any
   outbound service-to-service call it makes - no call site needs to know
   about request ids at all.

Net effect: **one customer request is traceable end-to-end** (gateway ->
service A -> service B) by grepping a single id across every service's log
file, e.g.:

```
Select-String -Path "logs/*.out.log" -Pattern "<the-request-id>"
```

## 6. Structured logs

All services use `pino` with a sync destination (so shutdown can flush
before exit). Every log line is JSON with at minimum: `level`, `time`,
`pid`, `hostname`, `name` (which service wrote it, e.g. `"cart"`,
`"api-gateway"`), and for HTTP-request lines (from `pino-http`), `req.id`
(the correlated request-id, see above), `req`/`res` details, and
`responseTime`.

Log verbosity is controlled per-service by the `LOG_LEVEL` env var
(`fatal|error|warn|info|debug|trace`), defaulting to `info` if unset
(inherited from `@youmart/config`'s shared base schema, or declared
locally by the 2 services - api-gateway, search-service - that don't use
that shared schema).

Secrets (OTP codes, passwords, JWTs, Razorpay keys/signatures) are never
logged - OTP codes are hashed before persistence and redacted
(`[REDACTED]`) if the notification worker ever logs job data for that
template; admin/auth login never logs the password, only a generic
"Invalid email or password" on failure.

## 7. Graceful shutdown

Every service registers `SIGINT`/`SIGTERM` handlers that: stop accepting
new HTTP connections (`server.close()`) -> for services with a BullMQ
worker (notification, invoice, settlement, search), close the worker(s)
FIRST, then the shared queue/Redis connection -> close the Postgres pool
(`prisma.$disconnect()` + pool `.end()`) -> `process.exit(0)`. There is
currently no force-exit timeout backstop if a close hangs (relies on the
orchestrator's own hard-kill timeout) - a documented follow-up, not yet
implemented.

Note: on Windows, external tools (`taskkill`, `Stop-Process`) generally
cannot deliver a real `SIGTERM` to a background Node process the way a
Linux container orchestrator would - the process is just force-terminated
without running its handler. This is a sandbox/OS limitation, not a code
defect; the shutdown code itself is verified by direct inspection.

## 8. Startup behavior

- Config is loaded once at module-import time via `@youmart/config`'s
  `loadConfigWith` (Zod `.safeParse` under the hood) - a missing or
  invalid required env var throws immediately with every failing field
  listed (e.g. `Invalid environment configuration:\n  -
JWT_PRIVATE_KEY: ...\n  - DATABASE_URL: ...`), crashing the process
  before it ever binds a port. There is no way to boot with incomplete
  config.
- The Postgres connection (via `packages/db`) is LAZY - the process still
  starts successfully even if `DATABASE_URL`/`<SERVICE>_DATABASE_URL`
  points at an unreachable host. `/health` stays 200; `/ready` is the
  first thing to notice and fail (503) until the DB comes back.

## 9. Startup env requirements (by category)

- **Every service**: `NODE_ENV`, `LOG_LEVEL` (optional, defaults `info`),
  `SERVICE_JWT_SECRET` (service-to-service auth), `JWT_PUBLIC_KEY`
  (verifying user/admin tokens), its own `<SERVICE>_DATABASE_URL` (except
  api-gateway/search-service, which have no Postgres role).
- **auth-service/admin-service** additionally hold `JWT_PRIVATE_KEY`
  (they're the only 2 services that MINT tokens).
- **Services that call other services** (most of them) need each
  dependency's `<SERVICE>_SERVICE_URL`.
- **payment-service** additionally needs `RAZORPAY_KEY_ID`,
  `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET`.
- **notification-service** additionally needs the WhatsApp/SMS provider
  credentials (MSG91) and Zoho mail credentials, plus `REDIS_URL`/
  `REDIS_HOST`/`REDIS_PORT` (shared by every queue-using service via
  `@youmart/queue`).
- **search-service** additionally needs `TYPESENSE_HOST`,
  `TYPESENSE_PORT`, `TYPESENSE_API_KEY`.
- See `.env.example` for the exhaustive, currently-accurate list.
