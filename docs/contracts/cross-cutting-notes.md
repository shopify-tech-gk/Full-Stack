# Cross-cutting notes: temporary auth model (pending Chapter 6)

**FROZEN as of `chapter-4-complete` (2026-09-21).** This note is referenced
by every service contract doc in this directory - it describes
authorization/identity mechanisms that are **known, documented stop-gaps**,
not final design. Real RBAC and service-to-service auth are Chapter 6 work.

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

Both middlewares are byte-for-byte the same pattern: run after
`requireAuth` (so `req.auth.userId` is populated), reject with
`403 FORBIDDEN` if the userId isn't in the list. **This is a per-service,
independently-configured list** - there is no shared "admin" concept across
services yet. Replace with a real role check (JWT claim or an admin schema
lookup) once Chapter 6 lands.

## 2. `MARKETPLACE_MODE` (single-seller hard-off today)

Every service that touches sellers (`catalog-service`,
`order-service`) currently operates in `MARKETPLACE_MODE=DISABLED` - there
is exactly one implicit default seller, and every product's `sellerId` /
every order line's `sellerId` is that same value. The **data model already
supports multiple sellers per order** (each `order_item` independently
carries its own `sellerId` - see [order-api.md](./order-api.md)'s
"multivendor split hook" note), and `catalog.service.ts`'s product-creation
path already assigns `sellerId` per-product rather than globally - so
turning on `MARKETPLACE_MODE=ENABLED` in a later chapter is additive
(assigning real, distinct sellers to products) rather than a schema
migration. Per-seller settlement/fulfillment (grouping order lines by
`sellerId` for payout/shipping) is explicitly future-chapter behavior, not
implemented today.

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
