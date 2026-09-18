import { randomBytes } from 'node:crypto';
import type { Prisma } from '@youmart/db';
import type { Money } from '@youmart/shared-types';
import { add, multiplyByQuantity, sum } from '@youmart/shared-utils';
import { AppError } from '@youmart/errors';
import { prisma } from '../db';
import { cartClient, catalogClient } from '../serviceClients';

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

    // TODO(4.5b): reserve stock for each line via inventoryClient.reserve
    // (under inventory-service's Redis lock) BEFORE/at order creation, and
    // mark the source cart CONVERTED once every line's reservation
    // succeeds. Deliberately NOT done here - 4.5a only proves order
    // building + authoritative repricing + per-seller line split; the
    // cart is left ACTIVE and untouched.

    return order.id;
  });

  return loadOrderView(orderId, userId);
}

export async function getOrder(userId: string, orderId: string): Promise<OrderView> {
  return loadOrderView(orderId, userId);
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
