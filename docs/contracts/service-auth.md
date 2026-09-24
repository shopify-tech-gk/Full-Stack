# Service-to-Service Auth Contract (HS256 service tokens)

**FROZEN as of `chapter-6-complete` (2026-09-24).** This is the stable
mechanism every service builds against. Changes after this freeze must be
additive where possible or require a version bump communicated to all
consumers.

## Problem this closes (Ch6.5)

Before Ch6.5, several internal endpoints (e.g. inventory's stock
read/reserve, order's internal confirm) had NO authentication at all, or
relied on forwarding a customer's own bearer token even for machine-
initiated calls (webhooks, scheduled jobs) that have no such token. Ch6.5
closed this gap completely - every `/internal/*`-style endpoint across all
15 services now requires a valid service token.

## Token shape

HS256, signed with a shared secret (`SERVICE_JWT_SECRET`, identical across
every service - a shared internal-network credential, deliberately NOT a
per-service keypair). Claims: `{ sub: callerServiceName, typ: "service",
iss: "youmart-internal", iat, exp }`. Short-lived (`SERVICE_TOKEN_TTL_SECONDS`,
default 300s), minted FRESH per outbound call (not cached - HS256 signing
is cheap).

**Separation from user tokens**: user access tokens are RS256, `typ:
"access"`; admin tokens are RS256, `typ:"admin"`; service tokens are
HS256, `typ:"service"`. `jsonwebtoken`'s `algorithms` allowlist rejects a
token whose header `alg` isn't in the list BEFORE attempting verification

- an RS256 token handed to `requireServiceAuth` (HS256-only), or an HS256
  token handed to `requireAuth`/`requireAdmin` (RS256-only), is rejected
  immediately. Verified live across every combination.

## Middleware (`@youmart/auth-middleware`)

- `mintServiceToken(callerServiceName, {serviceSecret, ttlSeconds})` -
  called by `@youmart/service-client`'s `mintCallerServiceToken` on every
  outbound internal HTTP call.
- `createServiceAuthMiddleware({serviceSecret, logger?})` ->
  `{ requireServiceAuth, requireServiceOrUser(userRequireAuth) }`.
  - `requireServiceAuth`: rejects anything that isn't a valid service
    token; attaches `req.service = {name}`.
  - `requireServiceOrUser(requireAuth)`: tries service-token verification
    first, falls through to the passed user middleware if that fails - for
    endpoints a customer hits directly AND a backend service may also call
    (e.g. invoice download).

## Consuming client (`@youmart/service-client`)

Every typed client factory (`createOrderClient`, `createSellerClient`,
`createSettingsClient`, etc.) takes a `serviceAuth: ServiceAuthOptions`
option and mints a fresh token per call - this package never reads
`process.env` or holds a secret itself; the consuming service's own config
supplies it.

## Settings client fail-safety (Ch6.7b, layered on top)

`createSettingsClient` additionally caches its target endpoint's response
(default 30s TTL) and, on a fetch failure, serves the last-known cached
value if one exists; if NO cache has EVER existed, it rethrows. The
generic client does NOT hard-code a "safe default" - each CALLER decides:
seller-service's marketplace hard-off gate catches and fails CLOSED
(`DISABLED`); settlement-service's `getSettlementRules()` does not catch
at all, failing the settlement run outright rather than guessing a rate.
Verified live (Ch6.7b): admin-service stopped + consumer restarted fresh
(no cache) -> hard-off gate still returned a clean 403 `DISABLED`, never
opened.

## What's still NOT covered (documented, not a gap)

The gateway itself never mints or verifies service tokens - it is a pure
proxy (see [gateway-api.md](./gateway-api.md)). Blocking `/internal/*` at
the gateway (a path-based check) and requiring a real service token at
each service (an identity check) are two INDEPENDENT layers - either one
alone would be insufficient (a leaked gateway bypass without the token
check would expose everything; the token check without the gateway
block would still let a client probe for the path even if every attempt
401s).
