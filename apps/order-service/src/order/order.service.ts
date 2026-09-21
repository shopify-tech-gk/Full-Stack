import { randomBytes } from 'node:crypto';
import type { Prisma } from '@youmart/db';
import type { Money } from '@youmart/shared-types';
import { add, multiplyByQuantity, sum } from '@youmart/shared-utils';
import { AppError } from '@youmart/errors';
import { prisma } from '../db';
import { cartClient, catalogClient, inventoryClient } from '../serviceClients';

function decimalToMoney(value: Prisma.Decimal): Money {
  return value.toFixed(2) as Money;
}

export type OrderStatusValue = 'PENDING_PAYMENT' | 'CONFIRMED' | 'CANCELLED';
export type OrderItemStatusValue =
  'PENDING' | 'CONFIRMED' | 'PACKED' | 'SHIPPED' | 'DELIVERED' | 'CANCELLED' | 'RETURNED';

export interface OrderItemView {
  skuId: string;
  productId: string;
  sellerId: string;
  title: string;
  unitPrice: Money;
  quantity: number;
  lineTotal: Money;
  sellerStatus: OrderItemStatusValue;
}

export interface OrderView {
  orderId: string;
  orderNumber: string;
  status: OrderStatusValue;
  items: OrderItemView[];
  subtotal: Money;
  shippingTotal: Money;
  grandTotal: Money;
}

export interface OrderListItem {
  orderId: string;
  orderNumber: string;
  status: OrderStatusValue;
  grandTotal: Money;
  createdAt: string;
}

const ORDER_WITH_ITEMS_INCLUDE = {
  items: { where: { deletedAt: null }, orderBy: { createdAt: 'asc' as const } },
} satisfies Prisma.OrderInclude;

type OrderWithItems = Prisma.OrderGetPayload<{ include: typeof ORDER_WITH_ITEMS_INCLUDE }>;

function toOrderView(order: OrderWithItems): OrderView {
  return {
    orderId: order.id,
    orderNumber: order.orderNumber,
    status: order.status,
    items: order.items.map((item) => ({
      skuId: item.skuId,
      productId: item.productId,
      sellerId: item.sellerId,
      title: item.titleSnapshot,
      unitPrice: decimalToMoney(item.unitPrice),
      quantity: item.quantity,
      lineTotal: decimalToMoney(item.lineTotal),
      sellerStatus: item.sellerStatus,
    })),
    subtotal: decimalToMoney(order.subtotal),
    shippingTotal: decimalToMoney(order.shippingTotal),
    grandTotal: decimalToMoney(order.grandTotal),
  };
}

async function loadOrderView(orderId: string, userId: string): Promise<OrderView> {
  const order = await prisma.order.findFirst({
    where: { id: orderId, userId, deletedAt: null },
    include: ORDER_WITH_ITEMS_INCLUDE,
  });

  if (!order) {
    throw new AppError('NOT_FOUND', 404, 'Order not found');
  }

  return toOrderView(order);
}

// "YM-<millis base36>-<4 random hex chars>" - short, readable, roughly
// time-ordered (sorts close to creation order), not sequential/guessable.
function generateOrderNumber(): string {
  const timePart = Date.now().toString(36).toUpperCase();
  const randomPart = randomBytes(2).toString('hex').toUpperCase();
  return `YM-${timePart}-${randomPart}`;
}

// order_number uniqueness is a hand-added PARTIAL unique index (WHERE
// deleted_at IS NULL), not a Prisma `@unique` - findFirst + retry, not
// upsert (same pattern as catalog/cart slug generation).
async function generateUniqueOrderNumber(): Promise<string> {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const candidate = generateOrderNumber();
    const clash = await prisma.order.findFirst({
      where: { orderNumber: candidate, deletedAt: null },
    });
    if (!clash) {
      return candidate;
    }
  }
  throw new AppError('CONFLICT', 409, 'Could not generate a unique order number');
}

interface RepricedLine {
  skuId: string;
  productId: string;
  sellerId: string;
  title: string;
  unitPrice: Money;
  quantity: number;
  lineTotal: Money;
}

// Best-effort duplicate-click guard, NOT a full idempotency-key system: if
// the user already has a PENDING_PAYMENT order created within this window,
// checkout returns that order instead of reserving stock a second time.
// A more robust mechanism (client-supplied idempotency key) is deferred -
// documented as a known limitation, not implemented here.
const DOUBLE_CHECKOUT_WINDOW_MS = 30 * 1000;

async function cancelOrder(orderId: string, note: string): Promise<void> {
  await prisma.$transaction([
    prisma.order.update({ where: { id: orderId }, data: { status: 'CANCELLED' } }),
    prisma.orderStatusHistory.create({
      data: { orderId, fromStatus: 'PENDING_PAYMENT', toStatus: 'CANCELLED', note },
    }),
  ]);
}

/**
 * CHECKOUT SECURITY PRINCIPLE (locked): the client sends NO items/prices -
 * `checkout` takes only `userId`/`authToken` and never reads `req.body`.
 * The cart is read server-side (`cartClient.getMyCart`) and EVERY price is
 * re-derived from catalog (`catalogClient.getSku`) - `unit_price` is the
 * LIVE catalog `sellingPrice` at checkout time, NOT the cart's
 * `priceSnapshot` (that snapshot is a UX convenience only, shown in the
 * cart view - it is never charged). This is what prevents a tampered
 * client request from paying less than the real current price.
 */
export async function checkout(userId: string, authToken: string): Promise<OrderView> {
  const recentOrder = await prisma.order.findFirst({
    where: {
      userId,
      status: 'PENDING_PAYMENT',
      deletedAt: null,
      createdAt: { gte: new Date(Date.now() - DOUBLE_CHECKOUT_WINDOW_MS) },
    },
    orderBy: { createdAt: 'desc' },
  });
  if (recentOrder) {
    return loadOrderView(recentOrder.id, userId);
  }

  const cart = await cartClient.getMyCart(authToken);

  if (cart.items.length === 0) {
    throw new AppError('VALIDATION_ERROR', 400, 'Cart is empty');
  }

  const lines: RepricedLine[] = [];
  for (const cartItem of cart.items) {
    const sku = await catalogClient.getSku(cartItem.skuId, authToken);

    if (!sku.active) {
      throw new AppError('CONFLICT', 409, `"${sku.title}" is no longer available`, {
        skuId: cartItem.skuId,
      });
    }

    lines.push({
      skuId: sku.skuId,
      productId: sku.productId,
      sellerId: sku.sellerId,
      title: sku.title,
      unitPrice: sku.sellingPrice,
      quantity: cartItem.quantity,
      lineTotal: multiplyByQuantity(sku.sellingPrice, cartItem.quantity),
    });
  }

  // SPLIT: every order_item carries its own seller_id (the multivendor
  // split hook) - in today's hard-off mode every line's seller_id is the
  // same DEFAULT_SELLER_ID (one implicit group), but the data model
  // already supports multiple sellers per order once marketplace mode
  // opens. Per-seller settlement/fulfillment (grouping by seller_id) is
  // future-chapter behavior; this order-building step just records the
  // seller_id correctly on each line.
  const subtotal = sum(lines.map((line) => line.lineTotal));
  const shippingTotal = '0.00' as Money; // shipping calculation is a later chapter
  const grandTotal = add(subtotal, shippingTotal);

  const orderNumber = await generateUniqueOrderNumber();

  // Order is created PENDING_PAYMENT FIRST (atomically, with its items and
  // an initial status-history row) so its id exists to link reservations
  // via reservation.order_id - reserve() calls happen AFTER, outside this
  // transaction (they're HTTP calls to inventory-service, not something a
  // Prisma transaction can span).
  const orderId = await prisma.$transaction(async (tx) => {
    const order = await tx.order.create({
      data: {
        userId,
        orderNumber,
        status: 'PENDING_PAYMENT',
        subtotal,
        shippingTotal,
        grandTotal,
      },
    });

    for (const line of lines) {
      await tx.orderItem.create({
        data: {
          orderId: order.id,
          skuId: line.skuId,
          productId: line.productId,
          sellerId: line.sellerId,
          titleSnapshot: line.title,
          unitPrice: line.unitPrice,
          quantity: line.quantity,
          lineTotal: line.lineTotal,
          sellerStatus: 'PENDING',
        },
      });
    }

    await tx.orderStatusHistory.create({
      data: {
        orderId: order.id,
        fromStatus: null,
        toStatus: 'PENDING_PAYMENT',
        note: 'Order created',
      },
    });

    return order.id;
  });

  // ALL-OR-NOTHING stock reservation. Reservations link to this order via
  // reservation.order_id (no orders-schema column needed - the orders
  // schema was NOT changed). Reserve calls go through inventory-service's
  // per-SKU Redis lock (Ch4.3), so this is safe under concurrency: if two
  // checkouts race for the last unit, exactly one `reserve` succeeds and
  // the other gets a 409 here, triggering its own rollback below.
  try {
    for (const line of lines) {
      await inventoryClient.reserve(line.skuId, line.quantity, authToken, orderId);
    }
  } catch (err) {
    // Roll back EVERYTHING reserved so far for this order (never leave a
    // dangling HELD reservation), and cancel the order (soft - keeps the
    // audit trail via order_status_history, never deleted).
    try {
      await inventoryClient.releaseByOrder(orderId, authToken);
    } catch (releaseErr: unknown) {
      // Best-effort: even if the release call itself fails (e.g. inventory
      // briefly unreachable), the order is still cancelled below so it's
      // never left PENDING_PAYMENT while actually broken. A stuck HELD
      // reservation from this edge case is a reconciliation concern
      // (out of scope here), not silently ignored - so it's logged.
      // eslint-disable-next-line no-console
      console.error('failed to release reservations after checkout rollback', releaseErr);
    }

    await cancelOrder(orderId, 'Stock reservation failed - released and order cancelled');

    if (err instanceof AppError && err.code === 'CONFLICT') {
      const failedSkuId = (err.details as { skuId?: string } | undefined)?.skuId;
      const failedLine = lines.find((line) => line.skuId === failedSkuId);
      if (failedLine) {
        throw new AppError(
          'CONFLICT',
          409,
          `Insufficient stock for "${failedLine.title}"`,
          err.details,
        );
      }
    }
    throw err;
  }

  // Best-effort / non-fatal: the order + its stock reservations are valid
  // regardless of whether the source cart got marked CONVERTED. A cart
  // stuck ACTIVE after a successful checkout is a minor cleanup issue, not
  // a checkout failure - so a cart-service outage here must not undo an
  // otherwise-successful order.
  try {
    await cartClient.convertCart(authToken);
  } catch (convertErr: unknown) {
    // eslint-disable-next-line no-console
    console.error('failed to mark cart CONVERTED after successful checkout', convertErr);
  }

  return loadOrderView(orderId, userId);
}

export async function getOrder(userId: string, orderId: string): Promise<OrderView> {
  return loadOrderView(orderId, userId);
}

export interface InternalOrderView {
  orderId: string;
  userId: string;
  status: OrderStatusValue;
  grandTotal: Money;
}

/**
 * Internal/service lookup (no ownership filter - payment-service calls this
 * to fetch grand_total + userId, then does its own ownership check against
 * the calling user). Protected by requireAuth + a forwarded token for now;
 * a dedicated service-to-service auth mechanism is a documented future
 * improvement (see payment-service's report / README).
 */
export async function getInternalOrder(orderId: string): Promise<InternalOrderView> {
  const order = await prisma.order.findFirst({ where: { id: orderId, deletedAt: null } });
  if (!order) {
    throw new AppError('NOT_FOUND', 404, 'Order not found');
  }
  return {
    orderId: order.id,
    userId: order.userId,
    status: order.status,
    grandTotal: decimalToMoney(order.grandTotal),
  };
}

/**
 * Confirms a PENDING_PAYMENT order (payment captured) AND commits its held
 * stock reservations in the same operation - order-service owns this
 * pairing (not payment-service) so "order confirmed" and "stock committed"
 * always happen together, and payment-service never needs to know about
 * inventory at all. Idempotent: already-CONFIRMED is a no-op (payment
 * webhooks retry).
 */
export async function confirmOrder(orderId: string, authToken: string): Promise<void> {
  const order = await prisma.order.findFirst({ where: { id: orderId, deletedAt: null } });
  if (!order) {
    throw new AppError('NOT_FOUND', 404, 'Order not found');
  }
  if (order.status === 'CONFIRMED') {
    return;
  }
  if (order.status !== 'PENDING_PAYMENT') {
    throw new AppError('CONFLICT', 409, `Cannot confirm an order in status ${order.status}`);
  }

  await inventoryClient.commitByOrder(orderId, authToken);

  // Each line's OWN seller_status moves PENDING -> CONFIRMED alongside the
  // order itself (Ch5.2 addition) - this is what makes a line reachable by
  // its owning seller's CONFIRMED -> PACKED transition
  // (seller-order.service.ts). Never touches a line already past PENDING
  // (e.g. a re-entrant call after a partial failure) - same idempotent
  // spirit as the rest of this function.
  await prisma.$transaction([
    prisma.order.update({ where: { id: orderId }, data: { status: 'CONFIRMED' } }),
    prisma.orderItem.updateMany({
      where: { orderId, sellerStatus: 'PENDING', deletedAt: null },
      data: { sellerStatus: 'CONFIRMED' },
    }),
    prisma.orderStatusHistory.create({
      data: {
        orderId,
        fromStatus: 'PENDING_PAYMENT',
        toStatus: 'CONFIRMED',
        note: 'Payment captured',
      },
    }),
  ]);
}

/**
 * Cancels a PENDING_PAYMENT order (payment failed) AND releases its held
 * stock reservations - mirrors `confirmOrder`'s pairing. Idempotent:
 * already-CANCELLED is a no-op.
 */
export async function cancelOrderForPaymentFailure(
  orderId: string,
  authToken: string,
): Promise<void> {
  const order = await prisma.order.findFirst({ where: { id: orderId, deletedAt: null } });
  if (!order) {
    throw new AppError('NOT_FOUND', 404, 'Order not found');
  }
  if (order.status === 'CANCELLED') {
    return;
  }
  if (order.status !== 'PENDING_PAYMENT') {
    throw new AppError('CONFLICT', 409, `Cannot cancel an order in status ${order.status}`);
  }

  await inventoryClient.releaseByOrder(orderId, authToken);
  await cancelOrder(orderId, 'Payment failed - stock released and order cancelled');
}

export interface GetMyOrdersQuery {
  cursor?: string;
  limit: number;
}

export interface PaginatedOrders {
  items: OrderListItem[];
  nextCursor: string | null;
}

export async function getMyOrders(
  userId: string,
  query: GetMyOrdersQuery,
): Promise<PaginatedOrders> {
  const { cursor, limit } = query;

  const rows = await prisma.order.findMany({
    where: { userId, deletedAt: null },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    take: limit + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
  });

  const hasMore = rows.length > limit;
  const pageRows = hasMore ? rows.slice(0, limit) : rows;
  const nextCursor = hasMore ? (pageRows[pageRows.length - 1]?.id ?? null) : null;

  return {
    items: pageRows.map((order) => ({
      orderId: order.id,
      orderNumber: order.orderNumber,
      status: order.status,
      grandTotal: decimalToMoney(order.grandTotal),
      createdAt: order.createdAt.toISOString(),
    })),
    nextCursor,
  };
}

export interface SettleableItemView {
  orderItemId: string;
  orderId: string;
  sellerId: string;
  lineTotal: Money;
  deliveredAt: string;
}

/**
 * Internal, service-to-service read for settlement-service (Ch5.3) -
 * requireAuth + a forwarded token for now, same temporary pattern as every
 * other internal endpoint. Returns every DELIVERED, non-deleted order_item
 * for `sellerId` whose `updatedAt` falls in `[from, to)`.
 *
 * DELIVERED-detection approximation: `order_item` has no `delivered_at`
 * column (no schema changes in this prompt) - `updated_at` is used as a
 * proxy for "when it became DELIVERED", since that's the last time the row
 * changed and (today) nothing updates a DELIVERED row afterwards. A
 * precise `delivered_at` timestamp would need a schema change, deferred.
 *
 * "Not-yet-settled" is NOT filtered here - order-service has no concept of
 * settlement at all (cross-schema isolation: it can't see the settlements
 * schema). This intentionally returns ALL matching DELIVERED items;
 * settlement-service is the one that knows which order_item_ids it has
 * already settled (via its own `settlement_line` rows) and excludes them.
 */
export async function getSettleableItems(
  sellerId: string,
  from: Date,
  to: Date,
): Promise<SettleableItemView[]> {
  const rows = await prisma.orderItem.findMany({
    where: {
      sellerId,
      sellerStatus: 'DELIVERED',
      deletedAt: null,
      updatedAt: { gte: from, lt: to },
    },
    orderBy: { updatedAt: 'asc' },
  });

  return rows.map((row) => ({
    orderItemId: row.id,
    orderId: row.orderId,
    sellerId: row.sellerId,
    lineTotal: decimalToMoney(row.lineTotal),
    deliveredAt: row.updatedAt.toISOString(),
  }));
}
