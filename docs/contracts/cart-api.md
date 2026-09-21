# Cart API Contract

**FROZEN as of `chapter-4-complete` (2026-09-21).** This is the stable
surface other services and the frontend build against. Changes after this
freeze must be additive where possible (new optional fields, new endpoints)
or require a version bump communicated to all consumers - do not silently
change a shape or status code of an endpoint listed here.

## Base URL

Cart service (`@youmart/cart-service`), port **4004** in dev
(`http://localhost:4004`). No path prefix beyond what's listed below.

## Common envelope

Same `ApiError` shape as [auth-api.md](./auth-api.md): `{ "error": { "code",
"message", "details"? } }`, same `ApiErrorCode` set, same 404/400/500
defaults for unmatched routes / validation failures / internal errors.

## Auth model

**Every** route below requires `requireAuth` (a valid bearer access token) -
a cart is always the logged-in user's own, identified by `req.auth.userId`.
There is no way to address another user's cart by id - none of these routes
take a cart id path param. The caller's own bearer token is forwarded to
catalog-service and inventory-service on their behalf for every operation
that needs a SKU/stock lookup (see
[cross-cutting-notes.md](./cross-cutting-notes.md)).

## Endpoints

### `GET /health` / `GET /ready`

Same shape as [auth-api.md](./auth-api.md) (`service: "cart"`; `/ready`
checks Postgres as the `cart_svc` role).

### `GET /cart`

Returns the caller's current `ACTIVE` cart, enriched with live catalog data
(title, slug, productId) per line via `catalogClient.getSku`.

- **200**:
  ```json
  {
    "cartId": "<uuid> | null",
    "items": [
      {
        "cartItemId": "<uuid>",
        "skuId": "<uuid>",
        "productId": "<uuid>",
        "productSlug": "string",
        "title": "string",
        "quantity": 2,
        "priceSnapshot": "1299.00",
        "lineTotal": "2598.00"
      }
    ],
    "subtotal": "2598.00",
    "itemCount": 2
  }
  ```
  If the user has no `ACTIVE` cart, returns the empty shape:
  `{ "cartId": null, "items": [], "subtotal": "0.00", "itemCount": 0 }` -
  never a 404. `itemCount` is the **sum of quantities** across all lines,
  not the distinct line count.

### `GET /cart/internal/me`

Internal, service-to-service read used by order-service during checkout.
Deliberately identical behavior to `GET /cart` (no `:userId` param - always
the forwarded token's own cart) so there is no way to read another user's
cart by supplying a different id.

- **200**: same shape as `GET /cart`

### `POST /cart/internal/convert`

Internal, service-to-service write called by order-service immediately
after a successful checkout, to mark the cart used for that checkout as no
longer `ACTIVE`. If the caller has no `ACTIVE` cart (already converted, or
never had one), this is a **benign no-op** - it never hard-fails, since the
order it's being called for already exists regardless.

- **200**: `{ "converted": boolean, "cartId": "<uuid> | null" }`

### `POST /cart/items`

Add a SKU to the cart, or merge into an existing line for the same SKU.

Request body (Zod):

```
{ skuId: string (uuid), quantity: number (int, >= 1) }
```

- **200**: updated `CartView` (same shape as `GET /cart`)
- **400** `VALIDATION_ERROR`: malformed body
- **409** `CONFLICT`:
  - `"This product is not currently available"` - SKU's product isn't `ACTIVE` (well-formed request, conflicts with current sellable state)
  - `"Insufficient stock"` with `details: { skuId, requested, available }` - **soft/UX check only** (see note below)

Merging into an existing line **refreshes `priceSnapshot`** to the SKU's
current `sellingPrice` (so the cart always reflects what would actually be
charged right now) rather than preserving the original snapshot.

> **Stock check is soft here.** This 409 is a UX convenience at add-time
> only - it does **not** reserve anything. The hard anti-oversell guarantee
> happens only at checkout, via `inventoryClient.reserve` under
> inventory-service's per-SKU lock (see [inventory-api.md](./inventory-api.md)
> and [order-api.md](./order-api.md)). Two users can both pass this check
> for the last unit; only one will actually get it at checkout.

### `PATCH /cart/items/:cartItemId`

Set a line's quantity to an absolute value (never removes a line - use
`DELETE` for that).

Request body: `{ quantity: number (int, >= 1) }`

- **200**: updated `CartView`
- **400** `VALIDATION_ERROR`: `quantity < 1` (message points to `DELETE` instead)
- **404** `NOT_FOUND`: no such item in the caller's active cart
- **409** `CONFLICT`: `"Insufficient stock"` (same soft check as add-item)

### `DELETE /cart/items/:cartItemId`

Soft-deletes one line.

- **200**: updated `CartView`
- **404** `NOT_FOUND`: no such item in the caller's active cart

### `POST /cart/clear`

Soft-deletes every line in the caller's active cart. No-op (returns the
empty `CartView`) if there is no active cart.

- **200**: updated (now-empty) `CartView`
