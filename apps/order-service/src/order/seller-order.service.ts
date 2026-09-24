import type { Prisma } from '@youmart/db';
import type { Money } from '@youmart/shared-types';
import { AppError } from '@youmart/errors';
import { prisma } from '../db';

function decimalToMoney(value: Prisma.Decimal): Money {
  return value.toFixed(2) as Money;
}

export type OrderItemStatusValue =
  'PENDING' | 'CONFIRMED' | 'PACKED' | 'SHIPPED' | 'DELIVERED' | 'CANCELLED' | 'RETURNED';

export interface SellerOrderItemView {
  orderItemId: string;
  orderId: string;
  orderNumber: string;
  skuId: string;
  productId: string;
  title: string;
  quantity: number;
  unitPrice: Money;
  lineTotal: Money;
  sellerStatus: OrderItemStatusValue;
  createdAt: string;
}

export interface ListSellerItemsQuery {
  cursor?: string;
  limit: number;
  sellerStatus?: OrderItemStatusValue;
}

export interface PaginatedSellerItems {
  items: SellerOrderItemView[];
  nextCursor: string | null;
}

const SELLER_ITEM_INCLUDE = { order: true } satisfies Prisma.OrderItemInclude;
type OrderItemWithOrder = Prisma.OrderItemGetPayload<{ include: typeof SELLER_ITEM_INCLUDE }>;

function toSellerItemView(item: OrderItemWithOrder): SellerOrderItemView {
  return {
    orderItemId: item.id,
    orderId: item.orderId,
    orderNumber: item.order.orderNumber,
    skuId: item.skuId,
    productId: item.productId,
    title: item.titleSnapshot,
    quantity: item.quantity,
    unitPrice: decimalToMoney(item.unitPrice),
    lineTotal: decimalToMoney(item.lineTotal),
    sellerStatus: item.sellerStatus,
    createdAt: item.createdAt.toISOString(),
  };
}

/**
 * SELLER-SCOPED order-item list (Ch5.2) - `order_item.seller_status` per
 * line is what lets each seller fulfill their part of a shared,
 * multi-seller order independently of the other lines/sellers on it. Only
 * ever the caller's own `sellerId` (never another seller's, and never a
 * path param the caller could tamper with).
 */
export async function listSellerItems(
  sellerId: string,
  query: ListSellerItemsQuery,
): Promise<PaginatedSellerItems> {
  const { cursor, limit, sellerStatus } = query;

  const where: Prisma.OrderItemWhereInput = {
    sellerId,
    deletedAt: null,
    ...(sellerStatus ? { sellerStatus } : {}),
  };

  const rows = await prisma.orderItem.findMany({
    where,
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    take: limit + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    include: SELLER_ITEM_INCLUDE,
  });

  const hasMore = rows.length > limit;
  const pageRows = hasMore ? rows.slice(0, limit) : rows;
  const nextCursor = hasMore ? (pageRows[pageRows.length - 1]?.id ?? null) : null;

  return { items: pageRows.map(toSellerItemView), nextCursor };
}

/**
 * SELLER-CONTROLLED transitions (locked, documented): a seller may only
 * move CONFIRMED -> PACKED here (accepting + packing their line). Every
 * other transition is out of the seller's hands:
 *  - PENDING -> CONFIRMED happens automatically at payment capture
 *    (order-service's own confirmOrder, Ch4.6) - never seller-initiated.
 *  - PACKED -> SHIPPED / SHIPPED -> DELIVERED come from the logistics
 *    integration (Ch5.4) - a seller cannot mark their own item shipped or
 *    delivered here.
 *  - -> RETURNED comes from the returns flow (Ch5.5).
 *  - -> CANCELLED is not seller-settable via this endpoint either (order-
 *    level cancellation is a buyer/payment-failure path, Ch4).
 * Any other requested `status` is a well-formed but DISALLOWED transition
 * -> 409 CONFLICT, not 400 (the shape is valid, it's the transition that
 * isn't).
 */
const SELLER_ALLOWED_TRANSITIONS: Partial<Record<OrderItemStatusValue, OrderItemStatusValue[]>> = {
  CONFIRMED: ['PACKED'],
};

export async function updateSellerItemStatus(
  sellerId: string,
  orderItemId: string,
  nextStatus: OrderItemStatusValue,
): Promise<SellerOrderItemView> {
  const item = await prisma.orderItem.findFirst({
    where: { id: orderItemId, deletedAt: null },
    include: SELLER_ITEM_INCLUDE,
  });

  // OWNERSHIP: 404 (not 403) on a missing item OR one belonging to a
  // different seller - "exists but not yours" must be indistinguishable
  // from "doesn't exist".
  if (!item || item.sellerId !== sellerId) {
    throw new AppError('NOT_FOUND', 404, 'Order item not found');
  }

  const allowed = SELLER_ALLOWED_TRANSITIONS[item.sellerStatus] ?? [];
  if (!allowed.includes(nextStatus)) {
    throw new AppError(
      'CONFLICT',
      409,
      `Cannot transition seller_status from ${item.sellerStatus} to ${nextStatus} - a seller may only move CONFIRMED to PACKED here`,
    );
  }

  const updated = await prisma.orderItem.update({
    where: { id: orderItemId },
    data: { sellerStatus: nextStatus },
    include: SELLER_ITEM_INCLUDE,
  });

  return toSellerItemView(updated);
}

/**
 * ADMIN/PLATFORM counterpart to `updateSellerItemStatus` above - Ch7.1
 * fix for a real gap the full-system integration test surfaced: the
 * DEFAULT seller (the platform's own single-vendor store,
 * `sellers.seller.owner_user_id IS NULL`) has no owning user account, so
 * NO customer token can ever pass `requireActiveSeller` to move ITS OWN
 * items CONFIRMED -> PACKED - every one of its orders was permanently
 * stuck (could never ship/deliver/settle). Same allowed-transition table
 * as the seller-driven path, but skips the ownership check entirely (an
 * admin may pack ANY item, not just the default seller's - useful
 * operationally regardless of whose item it is).
 */
export async function adminUpdateSellerItemStatus(
  orderItemId: string,
  nextStatus: OrderItemStatusValue,
): Promise<SellerOrderItemView> {
  const item = await prisma.orderItem.findFirst({
    where: { id: orderItemId, deletedAt: null },
    include: SELLER_ITEM_INCLUDE,
  });

  if (!item) {
    throw new AppError('NOT_FOUND', 404, 'Order item not found');
  }

  const allowed = SELLER_ALLOWED_TRANSITIONS[item.sellerStatus] ?? [];
  if (!allowed.includes(nextStatus)) {
    throw new AppError(
      'CONFLICT',
      409,
      `Cannot transition seller_status from ${item.sellerStatus} to ${nextStatus} - only CONFIRMED to PACKED is allowed here`,
    );
  }

  const updated = await prisma.orderItem.update({
    where: { id: orderItemId },
    data: { sellerStatus: nextStatus },
    include: SELLER_ITEM_INCLUDE,
  });

  return toSellerItemView(updated);
}
