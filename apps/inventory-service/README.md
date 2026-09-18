# @youmart/inventory-service

Stock levels + reservation lifecycle (reserve/release/commit), protected by a
Redis distributed lock per SKU - the anti-oversell mechanism. Follows the
auth/catalog-service skeleton template.

## Run

```
pnpm --filter @youmart/inventory-service dev
```

## The stock lock

Every stock mutation for a given `skuId` runs inside `withStockLock` (see
`src/inventory/stock-lock.ts`): `SET lock:stock:{skuId} <token> NX PX 5000`
to acquire (atomic set-if-not-exists with a 5s expiry so a crashed holder
self-heals), and a Lua compare-and-delete script to release (only deletes if
the value still matches the token we set, so we never release someone
else's lock). `reserve` re-checks `available` **inside** the lock, so two
concurrent reserves for the same SKU are serialized and can't both succeed
against stock that isn't really there.

## Endpoints

- `GET /health` / `GET /ready` - liveness/readiness (readiness runs `SELECT 1`).
- `GET /inventory/:skuId` - stock levels. `requireAuth`.
- `POST /inventory/:skuId/set` - set absolute available count. `requireAuth` + TEMPORARY manager guard (see `inventoryManager.middleware.ts`, replaced by real RBAC in Ch6).
- `POST /inventory/:skuId/reserve` - `{ quantity, orderId? }` -> reservation id. Called by order-service (Ch4.5) during checkout.
- `POST /inventory/reservations/:id/release` - return stock. Idempotent.
- `POST /inventory/reservations/:id/commit` - mark sold. Idempotent.

## Database connection

Connects as the least-privilege `inventory_svc` Postgres role - only the
`inventory` schema. `skuId`/`orderId` are soft references (no DB FK); this
service trusts the id it's given, the caller (catalog/order) validates it.
