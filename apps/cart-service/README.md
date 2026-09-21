# @youmart/cart-service

Per-user shopping cart: add/update/remove line items, a price snapshot
captured at add-time, and a cart view with line totals + subtotal. Follows
the auth/catalog/inventory-service skeleton template.

## Run

```
pnpm --filter @youmart/cart-service dev
```

## What this service does NOT do

It does not check out. Order-service (Ch4.5) reads the cart to build an
order, then marks it `CONVERTED`. It does not reserve stock either - the
stock check here (`inventoryClient.getStock`) is a **soft/UX check only**,
done at add/update time so a user isn't shown a cart they obviously can't
complete. The **hard** anti-oversell guarantee only happens at checkout via
`inventoryClient.reserve`, under inventory-service's Redis lock (Ch4.3).

## Endpoints (all `requireAuth` - a cart is always the caller's own)

- `GET /cart` - the caller's active cart (empty shape if none exists yet).
- `POST /cart/items` - `{ skuId, quantity }`. Creates the active cart
  lazily if none exists. Merges into an existing line for the same SKU
  (quantity added, `price_snapshot` refreshed to the SKU's current price).
- `PATCH /cart/items/:cartItemId` - `{ quantity }` (>= 1; to remove a line,
  use DELETE instead).
- `DELETE /cart/items/:cartItemId` - soft-deletes the line.
- `POST /cart/clear` - soft-deletes every line in the active cart.

## Cross-schema data via HTTP, not the DB

`cart_svc` (the least-privilege Postgres role this service connects as) can
only read/write the `cart` schema - it's denied at the DB level from
reading `catalog`/`inventory`. SKU/price/product info comes from
catalog-service (`GET /catalog/skus/:skuId`, Ch4.4b) and stock info from
inventory-service (`GET /inventory/:skuId`), both via
`@youmart/service-client`, forwarding the caller's own bearer token.

Enriching each cart line with title/slug is one `getSku` call per line
(N+1) - acceptable for the small cart sizes expected here; a batch lookup
endpoint could replace this later if needed.

## Money

`price_snapshot` is stored as a Postgres `Decimal`, always handled as a
`Money` string (`"1299.00"`) at the API boundary. Line totals and the
subtotal are computed via `@youmart/shared-utils` (`multiplyByQuantity`,
`sum`) - never raw JS number arithmetic.
