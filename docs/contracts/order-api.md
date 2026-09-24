# Order API Contract

**FROZEN as of `chapter-6-complete` (2026-09-24), originally frozen at
`chapter-4-complete`.** This is the stable
surface other services and the frontend build against. Changes after this
freeze must be additive where possible (new optional fields, new endpoints)
or require a version bump communicated to all consumers - do not silently
change a shape or status code of an endpoint listed here.

## Base URL

Order service (`@youmart/order-service`), port **4005** in dev
(`http://localhost:4005`). No path prefix beyond what's listed below.

## Common envelope

Same `ApiError` shape as [auth-api.md](./auth-api.md): `{ "error": { "code",
"message", "details"? } }`, same `ApiErrorCode` set, same 404/400/500
defaults for unmatched routes / validation failures / internal errors.

Every route requires `requireAuth`. Customer-facing routes always resolve
"the order" as **the logged-in user's own** - there is no way to read
another user's order via `GET /:id`.

## Endpoints

### `GET /health` / `GET /ready`

Same shape as [auth-api.md](./auth-api.md) (`service: "order"`; `/ready`
checks Postgres as the `orders_svc` role).

### `POST /checkout`

**CHECKOUT SECURITY PRINCIPLE (locked):** this endpoint **never reads the
request body**. It takes only the caller's identity (from the bearer
token). The cart is read server-side (`cartClient.getMyCart`) and **every
price is re-derived from catalog** (`catalogClient.getSku`) - `unitPrice` on
the resulting order is the SKU's **live current `sellingPrice`** at
checkout time, never the cart's `priceSnapshot` (that snapshot is a UX
convenience shown in the cart view only - it is never charged). A tampered
client request cannot pay less than the real current price, because no
client-supplied price or item list is ever consulted.

No request body.

- **201**: `OrderView` (see shape below), `status: "PENDING_PAYMENT"`
- **400** `VALIDATION_ERROR`: `"Cart is empty"`
- **409** `CONFLICT`:
  - `"<title>" is no longer available` - a cart line's SKU is no longer on an `ACTIVE` product
  - `Insufficient stock for "<title>"` with the failing SKU's `details: { skuId, requested, available }` - thrown by an all-or-nothing reservation pass; **any** already-reserved lines for this order are automatically released and the order is cancelled before the error is returned (never leaves a dangling `HELD` reservation or a stuck order)

**Duplicate-click guard (best-effort, not a full idempotency-key system):**
if the caller already has a `PENDING_PAYMENT` order created within the last
30 seconds, checkout returns _that_ order instead of creating a new one and
reserving stock again. This is a documented limitation, not a client-
supplied idempotency key.

**Side effects on success:** the cart is converted (marked no longer
`ACTIVE`) via `cartClient.convertCart` - best-effort; a cart-service outage
here does **not** undo an otherwise-successful order (logged, not thrown).

`OrderView` shape (also returned by `GET /:id` and the internal endpoints
below, minus internal-only fields):

```json
{
  "orderId": "<uuid>",
  "orderNumber": "YM-<time><rand>",
  "status": "PENDING_PAYMENT | CONFIRMED | CANCELLED",
  "items": [
    {
      "skuId": "<uuid>",
      "productId": "<uuid>",
      "sellerId": "<uuid>",
      "title": "string",
      "unitPrice": "1299.00",
      "quantity": 2,
      "lineTotal": "2598.00",
      "sellerStatus": "PENDING | CONFIRMED | PACKED | SHIPPED | DELIVERED | CANCELLED | RETURNED"
    }
  ],
  "subtotal": "2598.00",
  "shippingTotal": "0.00",
  "grandTotal": "2598.00"
}
```

Every item carries its own `sellerId` (the multivendor split hook - see
[cross-cutting-notes.md](./cross-cutting-notes.md)). `shippingTotal` is
always `"0.00"` today; shipping calculation is a later chapter.

### `GET /`

Paginated order history for the caller.

Query params: `cursor?: string`, `limit?: number` (1-100, default 20).

- **200**:
  ```json
  {
    "items": [
      {
        "orderId": "<uuid>",
        "orderNumber": "string",
        "status": "PENDING_PAYMENT | CONFIRMED | CANCELLED",
        "grandTotal": "6597.00",
        "createdAt": "<ISO datetime>"
      }
    ],
    "nextCursor": "string | null"
  }
  ```
  Ordered newest-first (`createdAt desc`, `id desc` tiebreak).

### `GET /:id`

Full order detail (same `OrderView` shape as checkout's response).

- **200**: `OrderView`
- **404** `NOT_FOUND`: no such order, or it belongs to a different user (never distinguished)

### Internal endpoints (called by payment-service)

Registered **before** `GET /:id` so `internal` is never swallowed as an
`:id`. Protected by `requireAuth` + a forwarded bearer token only (no
dedicated service-to-service auth mechanism yet - see
[cross-cutting-notes.md](./cross-cutting-notes.md)); the `GET` has no
ownership filter, so the caller (payment-service) is responsible for its
own ownership check against the invoking user.

#### `GET /internal/:orderId`

- **200**: `{ "orderId": "<uuid>", "userId": "<uuid>", "status": "...", "grandTotal": "Money" }`
- **404** `NOT_FOUND`

#### `POST /internal/:orderId/confirm`

Confirms a `PENDING_PAYMENT` order (payment captured) **and** commits its
held stock reservations in the same operation - order-service owns this
pairing (not payment-service), so "order confirmed" and "stock committed"
always happen together. **Idempotent**: already-`CONFIRMED` is a no-op.

- **200**: `{ "confirmed": true }`
- **404** `NOT_FOUND`: no such order
- **409** `CONFLICT`: order is in a status other than `PENDING_PAYMENT`/`CONFIRMED` (e.g. already `CANCELLED`)

#### `POST /internal/:orderId/cancel`

Cancels a `PENDING_PAYMENT` order (payment failed) **and** releases its held
stock reservations. **Idempotent**: already-`CANCELLED` is a no-op.

- **200**: `{ "cancelled": true }`
- **404** `NOT_FOUND`: no such order
- **409** `CONFLICT`: order is in a status other than `PENDING_PAYMENT`/`CANCELLED`
