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
6. Stock is RESERVED for every line via `inventoryClient.reserve(..., orderId)`
   (Ch4.3's Redis lock, ALL-OR-NOTHING: any failure releases everything
   reserved so far via `releaseByOrder` and cancels the order - see
   `checkout()` in `order.service.ts`).
7. The source cart is marked `CONVERTED` via `cartClient.convertCart` -
   best-effort/non-fatal (a cart-service hiccup here doesn't undo an
   otherwise-successful order).

Stock `commit` (payment success) and `release` (payment failure/expiry)
happen in Ch4.6, via `inventoryClient.commitByOrder`/`releaseByOrder` -
already wired here for checkout-time rollback, ready for 4.6 to reuse.

## `order_number`

`YM-<millis base36>-<4 random hex chars>` - short, human-readable, roughly
time-ordered. Uniqueness is a hand-added partial unique index (active rows
only), so generation is `findFirst` + retry-with-regenerate (not `upsert`).

## Database connection

Connects as the least-privilege `orders_svc` Postgres role - only the
`orders` schema. Cart contents, authoritative prices, and stock all come
from cart-service/catalog-service/inventory-service over HTTP
(`@youmart/service-client`), never by querying their schemas directly.
