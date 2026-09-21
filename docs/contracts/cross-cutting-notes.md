# Cross-cutting notes: temporary auth model (pending Chapter 6)

**FROZEN as of `chapter-5-complete` (2026-09-21), originally frozen at
`chapter-4-complete`.** This note is referenced by every service contract
doc in this directory - it describes authorization/identity mechanisms
that are **known, documented stop-gaps**, not final design. Real RBAC and
service-to-service auth are Chapter 6/7 work.

## 1. `ADMIN_USER_IDS` (catalog & inventory write-endpoint gate)

Access tokens issued by auth-service carry no admin/role claim today (see
[auth-api.md](./auth-api.md)'s JWT claims - just `sub`, `iss`, `aud`, `typ`,
`phone`). Until real roles exist, two services gate their admin/write
endpoints behind a simple allow-list of user ids, configured via the
`ADMIN_USER_IDS` env var (comma-separated user ids), read into each
service's own `config.adminUserIds`:

- **catalog-service**: `requireCatalogManager` middleware
  (`catalogManager.middleware.ts`) gates every product/SKU/image/category
  write endpoint in [catalog-api.md](./catalog-api.md).
- **inventory-service**: `requireInventoryManager` middleware
  (`inventoryManager.middleware.ts`) gates `POST /:skuId/set` in
  [inventory-api.md](./inventory-api.md).
- **seller-service** (Ch5.1): `requireSellerAdmin` middleware
  (`sellerAdmin.middleware.ts`) gates every `/admin/sellers/*` endpoint in
  [seller-api.md](./seller-api.md).
- **settlement-service** (Ch5.3): `requireSettlementAdmin` middleware
  gates `POST /admin/settlements/run` and the admin list/detail views in
  [settlement-api.md](./settlement-api.md).
- **logistics-service** (Ch5.4): `requireLogisticsAdmin` middleware gates
  the `PLATFORM`-fulfillment admin routes in
  [logistics-api.md](./logistics-api.md).
- **returns-service** (Ch5.5): `requireReturnsAdmin` middleware gates
  every `/admin/returns/*` endpoint in [returns-api.md](./returns-api.md).

All six middlewares are byte-for-byte the same pattern: run after
`requireAuth` (so `req.auth.userId` is populated), reject with
`403 FORBIDDEN` if the userId isn't in the list. **This is a per-service,
independently-configured list** - there is no shared "admin" concept across
services yet (the same literal `ADMIN_USER_IDS` value happens to be reused
verbatim in dev's single shared root `.env`, but each service reads its own
env var independently). Replace with a real role check (JWT claim or an
admin schema lookup) once Chapter 6 lands.

## 2. `MARKETPLACE_MODE` (single-seller hard-off today, now proven both ways)

As of Chapter 5, this toggle is **fully implemented and live-verified in
both positions**, not just a future hook: `seller-service`'s
`POST /sellers/register` (self-registration) is directly gated by
`assertMarketplaceOpen()` - real integration testing confirmed `DISABLED`
produces a real `403 FORBIDDEN` and `ENABLED` allows real seller
onboarding through to an `active: true` seller (see
[seller-api.md](./seller-api.md)). Launch default is `DISABLED` (reset and
confirmed at the end of the Chapter 5 integration run).

The **data model already supports multiple sellers per order** (each
`order_item` independently carries its own `sellerId` - see
[order-api.md](./order-api.md)'s "multivendor split hook" note), and
catalog-service's seller-scoped routes ([seller-api.md](./seller-api.md),
[catalog-api.md](./catalog-api.md)), order-service's seller-owned item
status routes, logistics-service's seller-owned shipment creation, and
settlement-service's per-seller settlement engine are now **all fully
built and live-verified end-to-end** (Chapter 5) - a real seller can
register, get approved, own catalog products (with cross-seller ownership
isolation proven via a real `404` on a second seller's edit attempt),
fulfill orders, get settled, and process returns, all while
`MARKETPLACE_MODE` stays a simple, restartable env toggle.

## 3. Service-to-service calls: forwarded user token, not a service credential

There is no dedicated service-to-service authentication mechanism yet
(flagged consistently across cart-service, order-service, and
payment-service). Every internal call between services
(`cart/internal/*`, `orders/internal/*`, catalog's `GET /skus/:skuId`,
inventory's reserve/release/commit) is authenticated by **forwarding the
originating end-user's own bearer access token** - the callee runs the same
`requireAuth` middleware as any public endpoint and does its own
authorization/ownership check using that forwarded identity. There is no
separate "service" principal or client-credentials flow.

The one exception where this breaks down is the **Razorpay webhook**
(`POST /webhook` on payment-service, see [payment-api.md](./payment-api.md)):
Razorpay itself calls it, with no user token at all. This is bridged today
via `pendingAuthTokens`, an in-memory, process-local cache of the
originating user's token keyed by `orderId` - a deliberate, documented
stop-gap with known limitations (lost on process restart; a token that has
expired by the time the webhook fires causes a logged, manually-
reconciled failure rather than a silent one). A real service-to-service
credential (e.g. a client-credentials token for inter-service calls) should
replace both this cache and the forwarded-token pattern above in a later
chapter.

**Chapter 5 extends this same gap to three more places, now flagged
explicitly:**

- **payment-service's webhook** (above) remains the sharpest case - no
  user context at all, bridged only by the in-memory `pendingAuthTokens`
  cache.
- **settlement-service's weekly scheduled job**
  (`settlement.queue.ts`, `Queue.upsertJobScheduler`): the scheduler itself
  has **no service credential** to call seller-service/order-service with
  at all - when it fires unattended, it logs a warning and skips rather
  than silently failing or fabricating a token. Only the admin
  manual-trigger endpoint (`POST /admin/settlements/run`, which forwards a
  real logged-in admin's bearer token) actually performs settlement today.
  See [settlement-api.md](./settlement-api.md).
- **returns-service's `processRefund`**: `paymentClient.createRefund`,
  `inventoryClient.restock`, and `orderClient.setSellerItemStatus` are all
  called by forwarding the admin caller's own bearer token, exactly the
  same forwarded-token pattern as everywhere else - meaning returns
  processing can **only** ever be admin-initiated (there is no unattended/
  scheduled returns processing path, by design, but also as a direct
  consequence of this same missing service-credential gap).

All three are real, live-verified-safe today (nothing is broken or
insecure as configured), but all three are explicitly flagged here as a
Chapter 6/7 priority: a real service-to-service credential should replace
the forwarded-token pattern **and** give the settlement scheduler (and any
future unattended job) a legitimate way to call other services without an
end-user in the loop.
