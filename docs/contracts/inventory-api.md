# Inventory API Contract

**FROZEN as of `chapter-6-complete` (2026-09-24), originally frozen at
`chapter-4-complete`.** This is the stable
surface other services and the frontend build against. Changes after this
freeze must be additive where possible (new optional fields, new endpoints)
or require a version bump communicated to all consumers - do not silently
change a shape or status code of an endpoint listed here.

## Base URL

Inventory service (`@youmart/inventory-service`), port **4003** in dev
(`http://localhost:4003`). No path prefix beyond what's listed below.

## Common envelope

Same `ApiError` shape as [auth-api.md](./auth-api.md): `{ "error": { "code",
"message", "details"? } }`, same `ApiErrorCode` set, same 404/400/500
defaults for unmatched routes / validation failures / internal errors.

`inventory_svc` has no visibility into the catalog or orders schemas
(cross-schema isolation is enforced at the DB role level) - every `skuId`
and `orderId` passed to this service is trusted as given by the caller,
which is expected to have already validated it.

## Endpoints

### `GET /health` / `GET /ready`

Same shape as [auth-api.md](./auth-api.md) (`service: "inventory"`;
`/ready` checks Postgres as the `inventory_svc` role).

### `GET /:skuId`

Current stock summary. `requireAuth` only (read, used by cart/checkout or
an admin UI).

- **200**: `{ "skuId": "<uuid>", "available": number, "reserved": number }`
  Returns **zeros** for a SKU with no stock row yet (no side effect - a row
  is only ever created by `POST /:skuId/set`), never a 404.

### `POST /:skuId/set`

Admin op: sets the **absolute** `available` count. `reserved` is left
untouched. Requires `requireAdmin('inventory.manage')` (Ch6.7a real RBAC).
Reachable through the gateway at `/api/inventory/:skuId/set`.

Request body: `{ available: number (int, >= 0) }`

- **200**: `{ "skuId": "<uuid>", "available": number, "reserved": number }`
- **400** `VALIDATION_ERROR`: malformed body
- **403** `FORBIDDEN`: not an inventory manager

### `POST /:skuId/reserve`

**THE anti-oversell path.** Called by order-service during checkout, once
per line. `available` is re-checked **inside** a per-SKU lock (Redis-backed,
see `stock-lock.ts`) acquired before the check - two concurrent reserve
calls for the same SKU are serialized by the lock, so the second call
always observes the first one's decrement before deciding whether there's
enough stock left. This is what guarantees exactly one of two concurrent
checkouts for the last unit succeeds.

Request body: `{ quantity: number (int, > 0), orderId?: string (uuid) }`

`orderId` (when given) links the reservation to an order, so it can later
be bulk-released/committed via the `orders/:orderId/*` endpoints below
without the caller needing to track individual reservation ids.

- **201**:
  ```json
  {
    "reservationId": "<uuid>",
    "skuId": "<uuid>",
    "quantity": 1,
    "status": "HELD",
    "expiresAt": "<ISO datetime, now + 15 minutes>"
  }
  ```
- **400** `VALIDATION_ERROR`: malformed body
- **409** `CONFLICT`: `"Insufficient stock"` with
  `details: { skuId, requested, available }` - `available` reflects stock
  remaining **after** any other reservation(s) that won the race

### `POST /reservations/:id/release`

Returns a `HELD` reservation's quantity back to `available` and marks it
`RELEASED`. Called by order-service on payment failure/expiry, or
individually by the bulk `orders/:orderId/release` endpoint below.
**Idempotent**: releasing an already-`RELEASED`/`COMMITTED`/`EXPIRED`
reservation is a documented no-op (never double-counts stock, checked both
before and after acquiring the per-SKU lock).

- **204**: no body
- **404** `NOT_FOUND`: no such reservation

### `POST /reservations/:id/commit`

Marks a `HELD` reservation as sold (`available` was already decremented at
reserve time - only `reserved` moves, down). Called by order-service after
payment succeeds. Same idempotent double-check pattern as `release`.

- **204**: no body
- **404** `NOT_FOUND`: no such reservation

### `POST /orders/:orderId/release`

Releases **every** still-`HELD` reservation linked to this order (via
`reservation.order_id`, set at reserve time) - used by checkout's rollback
path when a partial reserve failure must leave no dangling reservations for
the order, and by payment-failure cleanup. Each line goes through the same
idempotent per-SKU-locked `release()` path individually.

- **204**: no body (always - even if there were zero matching reservations)

### `POST /orders/:orderId/commit`

Commits every still-`HELD` reservation for an order (payment success path,
called by payment-service's webhook handler via order-service's internal
confirm flow).

- **204**: no body (always - even if there were zero matching reservations)
