# @youmart/order-service

Checkout core: reads the caller's cart server-side, re-derives every price
from catalog (authoritative), splits line items by seller, and creates a
`PENDING_PAYMENT` order. Follows the auth/catalog/inventory/cart-service
skeleton template.

## Checkout security principle (locked)

The client **never** sends items or prices to `POST /orders/checkout` - any
body it sends is ignored entirely. The order is built entirely server-side:

1. Read the caller's cart via `cartClient.getMyCart` (`GET
/cart/internal/me`, forwarding the caller's own token).
2. For every cart line, look up the SKU via `catalogClient.getSku` -
   `unit_price` is the **live catalog `sellingPrice` at checkout time**,
   NOT the cart's `price_snapshot` (that snapshot is a UX convenience shown
   in the cart view; it is never charged). An inactive SKU/product ->
   `409 CONFLICT` naming the item.
3. `line_total = unit_price * quantity`, `subtotal = sum(line_total)`,
   `shipping_total = 0.00` (later chapter), `grand_total = subtotal +
shipping_total` - all via `@youmart/shared-utils`.
4. Every `order_item` carries its own `seller_id` (from catalog's
   `getSku`) - the multivendor split hook, required even in today's
   hard-off mode (= the one default seller). Settlement/fulfillment
   grouping by `seller_id` is future-chapter behavior.
5. `order` + `order_item`s + an initial `order_status_history` row
   (`null -> PENDING_PAYMENT`) are created in ONE `prisma.$transaction`.

**Not done in 4.5a (see `TODO(4.5b)` in `order.service.ts`)**: stock is not
reserved, and the source cart is not marked `CONVERTED`. 4.5b adds the
`inventoryClient.reserve` call (under inventory-service's Redis lock) and
cart conversion before this is a complete, safe checkout.

## `order_number`

`YM-<millis base36>-<4 random hex chars>` - short, human-readable, roughly
time-ordered. Uniqueness is a hand-added partial unique index (active rows
only), so generation is `findFirst` + retry-with-regenerate (not `upsert`).

## Database connection

Connects as the least-privilege `orders_svc` Postgres role - only the
`orders` schema. Cart contents, authoritative prices, and stock all come
from cart-service/catalog-service/inventory-service over HTTP
(`@youmart/service-client`), never by querying their schemas directly.
