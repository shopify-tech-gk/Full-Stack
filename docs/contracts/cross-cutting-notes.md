# Cross-cutting notes: auth model (Chapter 6 closed all three gaps)

**FROZEN as of `chapter-6-complete` (2026-09-24).** This note is
referenced by every service contract doc in this directory. It previously
described three known, documented stop-gaps (admin authorization,
marketplace/commission config, service-to-service auth) - **all three are
now closed** as of Chapter 6. This file is kept (renamed in spirit, not in
filename) as the historical record of what changed and why, so a reader
of an older contract doc referencing "TEMPORARY" or "ADMIN_USER_IDS" knows
exactly what replaced it.

## 1. `ADMIN_USER_IDS` - RETIRED (Ch6.7a), replaced by real RBAC

Every service that used to gate admin/write endpoints behind a comma-
separated user-id allow-list (`catalogManager.middleware.ts`,
`inventoryManager.middleware.ts`, `sellerAdmin.middleware.ts`,
`settlementAdmin.middleware.ts`, `logisticsAdmin.middleware.ts`,
`returnsAdmin.middleware.ts`, `searchAdmin.middleware.ts`,
`invoiceAdmin.middleware.ts`) has had that middleware file DELETED and
every one of its routes now uses `requireAdmin('<permission>')` from
`@youmart/auth-middleware` (Ch6.7a) - a real RS256 `typ:"admin"` token,
role-based permission check, zero DB call per request. See
[admin-api.md](./admin-api.md) for the full role/permission model.
`ADMIN_USER_IDS` no longer exists anywhere in `.env`/`.env.example` or any
service's config schema - grep-verified clean at every subsequent
chapter's freeze.

Endpoint -> permission mapping (the full retirement audit):

| Service            | Permission(s)                                                                |
| ------------------ | ---------------------------------------------------------------------------- |
| catalog-service    | `catalog.manage`                                                             |
| inventory-service  | `inventory.manage`                                                           |
| invoice-service    | `invoices.view` (read), `invoices.manage` (regenerate)                       |
| logistics-service  | `fulfillment.manage`                                                         |
| returns-service    | `returns.manage` (workflow), `refunds.manage` (process-refund)               |
| search-service     | `search.manage`                                                              |
| seller-service     | `sellers.approve` (dormant multivendor), `sellers.kyc` (dormant multivendor) |
| settlement-service | `settlements.manage` (run), `settlements.view` (list/detail)                 |

## 2. `MARKETPLACE_MODE` / commission-tax envs - RETIRED (Ch6.7b), replaced by admin settings

`MARKETPLACE_MODE` (seller-service, catalog-service) and
`COMMISSION_ENABLED`/`COMMISSION_DEFAULT_PERCENT`/`TCS_ENABLED`/
`TCS_PERCENT`/`TDS_ENABLED`/`TDS_PERCENT` (settlement-service) no longer
exist as env vars anywhere. The single source of truth is now
`admin.marketplace_settings` (one row), changeable ONLY via
`PATCH /admin/settings` (`requireAdmin('settings.manage')`, SUPER_ADMIN),
consumed by services through `@youmart/service-client`'s
`createSettingsClient` (cached, ~30s TTL, fail-closed - see
[service-auth.md](./service-auth.md) and [admin-api.md](./admin-api.md)).

catalog-service's `MARKETPLACE_MODE` was found to be dead config (declared
but never actually read anywhere in its business logic) and was simply
deleted rather than wired to the settings client - documented explicitly
at the time (Ch6.7b), not an oversight.

**The marketplace toggle is real and live-verified multiple times now**
(Ch6.7b, re-confirmed Ch6.8): `PATCH /admin/settings {marketplaceMode:
"ENABLED"}` opens seller self-registration with NO code change, NO
redeploy, NO env edit (within the cache TTL); flipping back to `DISABLED`
closes it again. **Launch default is `DISABLED`**, confirmed at the end of
every integration run including Ch6.8's.

## 3. Service-to-service auth - CLOSED (Ch6.5)

The old forwarded-user-token pattern (every internal call authenticated by
forwarding the originating end-user's own bearer token, with NO real
service principal) and the `pendingAuthTokens` in-memory webhook bridge
are both **gone**. Every `/internal/*`-style endpoint across all 15
services now requires a real, dedicated HS256 service token (Ch6.5) - see
[service-auth.md](./service-auth.md) for the full mechanism. Specifically:

- **payment-service's webhook**: no longer needs any user/service token at
  all for its OWN authentication - the HMAC signature over the raw request
  body IS the security boundary (unchanged design), and it now calls
  `orderClient.confirmOrder`/`cancelOrder` with a self-minted service
  token instead of a token plucked from the retired in-memory cache.
- **settlement-service's weekly scheduled job**: now mints its own service
  token per call (`serviceClients.ts`) and runs unconditionally - no
  longer skips when unattended.
- **returns-service's `processRefund`**: `paymentClient`/`inventoryClient`/
  `orderClient` calls all self-mint service tokens - no longer depends on
  an admin's forwarded bearer token, so unattended/automated returns
  processing is no longer structurally blocked.

The API gateway (Ch6.6) adds a second, independent layer on top: it
blocks any path containing an `/internal` segment before it can even
reach a service's proxy route - see [gateway-api.md](./gateway-api.md).
Both layers were verified together, live, in Ch6.8's integration run
(step 13).
