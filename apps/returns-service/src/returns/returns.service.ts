import type { Prisma } from '@youmart/db';
import type { Money } from '@youmart/shared-types';
import { compare, subtract } from '@youmart/shared-utils';
import { AppError } from '@youmart/errors';
import { enqueueNotification } from '@youmart/notifications-client';
import { prisma } from '../db';
import { config } from '../config';
import { logger } from '../logger';
import { orderClient, paymentClient, inventoryClient, authClient } from '../serviceClients';
import type { RefundResult } from '@youmart/service-client';
import type { RequestReturnBody, ListReturnsQuery } from './returns.schema';

function decimalToMoney(value: Prisma.Decimal): Money {
  return value.toFixed(2) as Money;
}

export type ReturnStatusValue = 'REQUESTED' | 'APPROVED' | 'REJECTED' | 'PICKED_UP' | 'REFUNDED';

export interface ReturnView {
  id: string;
  orderItemId: string;
  userId: string;
  reason: string;
  status: ReturnStatusValue;
  refundAmount: Money | null;
  createdAt: string;
  updatedAt: string;
}

/** W9: a customer's own return, with what it is for (My Returns & Refunds). */
export interface CustomerReturnView extends ReturnView {
  orderId: string | null;
  orderNumber: string | null;
  title: string | null;
  quantity: number | null;
  /** Where the refund goes - always the YouMart Wallet (W9). */
  refundTo: 'WALLET';
}

/** Adds the item title / order number (best-effort: a lookup failure leaves them null). */
async function withItemDetails(rows: ReturnView[]): Promise<CustomerReturnView[]> {
  return Promise.all(
    rows.map(async (row) => {
      try {
        const item = await orderClient.getInternalOrderItem(row.orderItemId);
        return {
          ...row,
          orderId: item.orderId,
          orderNumber: item.orderNumber,
          title: item.title,
          quantity: item.quantity,
          refundTo: 'WALLET' as const,
        };
      } catch {
        return {
          ...row,
          orderId: null,
          orderNumber: null,
          title: null,
          quantity: null,
          refundTo: 'WALLET' as const,
        };
      }
    }),
  );
}

interface ReturnRow {
  id: string;
  orderItemId: string;
  userId: string;
  reason: string;
  status: ReturnStatusValue;
  refundAmount: Prisma.Decimal | null;
  createdAt: Date;
  updatedAt: Date;
}

function toReturnView(row: ReturnRow): ReturnView {
  return {
    id: row.id,
    orderItemId: row.orderItemId,
    userId: row.userId,
    reason: row.reason,
    status: row.status,
    refundAmount: row.refundAmount ? decimalToMoney(row.refundAmount) : null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

async function findActiveReturn(id: string): Promise<ReturnRow> {
  const row = await prisma.returnRequest.findFirst({ where: { id, deletedAt: null } });
  if (!row) {
    throw new AppError('NOT_FOUND', 404, 'Return request not found');
  }
  return row;
}

// A return_request in one of these statuses already exists/existed for
// the order_item and blocks a NEW request - REQUESTED/APPROVED/PICKED_UP
// are clearly still "in flight"; REFUNDED means the item was already
// returned once (can't return the same delivered unit twice). Only
// REJECTED is excluded - a customer may re-submit after a rejection (e.g.
// with more detail), a deliberate, documented choice.
const BLOCKING_RETURN_STATUSES: ReturnStatusValue[] = [
  'REQUESTED',
  'APPROVED',
  'PICKED_UP',
  'REFUNDED',
];

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * Customer requests a return on a DELIVERED item. Guards (in order):
 * ownership (404 if not the caller's own order - never reveals existence
 * otherwise), seller_status === DELIVERED (409 otherwise - only delivered
 * items are returnable), within `RETURN_WINDOW_DAYS` of delivery (409
 * "return window closed" - delivery time approximated by
 * order_item.updatedAt, same proxy used throughout Ch5.3/5.4), and no
 * existing active return for this order_item (409 - see
 * BLOCKING_RETURN_STATUSES).
 */
export async function requestReturn(userId: string, input: RequestReturnBody): Promise<ReturnView> {
  const item = await orderClient.getInternalOrderItem(input.orderItemId);

  if (item.userId !== userId) {
    throw new AppError('NOT_FOUND', 404, 'Order item not found');
  }
  if (item.sellerStatus !== 'DELIVERED') {
    throw new AppError(
      'CONFLICT',
      409,
      `Cannot return an order item in status ${item.sellerStatus} - it must be DELIVERED`,
    );
  }

  const deliveredAt = new Date(item.updatedAt);
  const windowEnd = new Date(deliveredAt.getTime() + config.returnWindowDays * MS_PER_DAY);
  if (new Date() > windowEnd) {
    throw new AppError(
      'CONFLICT',
      409,
      `Return window closed - returns are only allowed within ${config.returnWindowDays} days of delivery`,
    );
  }

  const existingActive = await prisma.returnRequest.findFirst({
    where: {
      orderItemId: input.orderItemId,
      status: { in: BLOCKING_RETURN_STATUSES },
      deletedAt: null,
    },
  });
  if (existingActive) {
    throw new AppError('CONFLICT', 409, 'A return request already exists for this order item');
  }

  const created = await prisma.returnRequest.create({
    data: { orderItemId: input.orderItemId, userId, reason: input.reason, status: 'REQUESTED' },
  });

  return toReturnView(created);
}

export interface PaginatedReturns {
  items: ReturnView[];
  nextCursor: string | null;
}

export interface PaginatedCustomerReturns {
  items: CustomerReturnView[];
  nextCursor: string | null;
}

export async function getMyReturns(
  userId: string,
  query: { cursor?: string; limit: number },
): Promise<PaginatedCustomerReturns> {
  const { cursor, limit } = query;
  const rows = await prisma.returnRequest.findMany({
    where: { userId, deletedAt: null },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    take: limit + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
  });
  const hasMore = rows.length > limit;
  const pageRows = hasMore ? rows.slice(0, limit) : rows;
  const nextCursor = hasMore ? (pageRows[pageRows.length - 1]?.id ?? null) : null;
  return { items: await withItemDetails(pageRows.map(toReturnView)), nextCursor };
}

export async function getReturn(userId: string, id: string): Promise<CustomerReturnView> {
  const row = await prisma.returnRequest.findFirst({ where: { id, userId, deletedAt: null } });
  if (!row) {
    throw new AppError('NOT_FOUND', 404, 'Return request not found');
  }
  const [view] = await withItemDetails([toReturnView(row)]);
  return view!;
}

// ---------------------------------------------------------------------------
// Admin (temporary ADMIN_USER_IDS guard, routes/admin.routes.ts). For
// launch (single-vendor), admin handles the ENTIRE return lifecycle.
//
// SELLER-SIDE FOUNDATION (lean, marked - multivendor, NOT built here): once
// the marketplace opens, a seller could approve/reject/mark-picked-up
// returns for order_items carrying THEIR OWN seller_id (the same ownership
// pattern as catalog/order/settlement/logistics's Ch5.2-5.4 seller-scoped
// endpoints - resolve the caller's active sellerId via seller-client,
// then filter/assert `item.sellerId === callerSellerId` before acting).
// `processRefund`'s Razorpay call would very likely stay an ADMIN/platform
// action even then (real money movement), while approve/reject/pickup
// could reasonably move to the seller. None of that is implemented here -
// single-vendor launch routes everything through admin, and this comment
// is the documented hook for where it would go.
// ---------------------------------------------------------------------------

/**
 * REQUESTED -> APPROVED. `refund_amount` defaults to the order_item's own
 * `line_total` (the full sale value of that line) - an admin may instead
 * specify a partial amount via `ApproveReturnBody.refundAmount`, which
 * must not exceed `line_total` (400 otherwise). This is the ONLY point
 * `refund_amount` is ever set - `processRefund` later uses this exact
 * value, never re-deriving it.
 */
export async function approveReturn(
  id: string,
  refundAmountOverride: Money | undefined,
): Promise<ReturnView> {
  const existing = await findActiveReturn(id);
  if (existing.status !== 'REQUESTED') {
    throw new AppError('CONFLICT', 409, `Cannot approve a return in status ${existing.status}`);
  }

  const item = await orderClient.getInternalOrderItem(existing.orderItemId);
  // v1.13: with a coupon the line was paid lineTotal - discount; never refund more than that.
  const paid = item.discount ? subtract(item.lineTotal, item.discount) : item.lineTotal;
  const refundAmount = refundAmountOverride ?? paid;

  if (compare(refundAmount, paid) > 0) {
    throw new AppError(
      'VALIDATION_ERROR',
      400,
      `refundAmount ${refundAmount} exceeds what was paid for this item (${paid})`,
    );
  }

  const updated = await prisma.returnRequest.update({
    where: { id },
    data: { status: 'APPROVED', refundAmount },
  });
  return toReturnView(updated);
}

// `reason` has nowhere to persist - return_request has no rejection-reason
// column (no schema/migration changes in this prompt) - accepted and
// logged for operator visibility only, same documented caveat as
// seller-service's rejectSeller/rejectKyc (Ch5.1).
export async function rejectReturn(id: string, reason?: string): Promise<ReturnView> {
  const existing = await findActiveReturn(id);
  if (existing.status !== 'REQUESTED') {
    throw new AppError('CONFLICT', 409, `Cannot reject a return in status ${existing.status}`);
  }
  if (reason) {
    logger.info({ returnId: id, reason }, 'return request rejected');
  }
  const updated = await prisma.returnRequest.update({
    where: { id },
    data: { status: 'REJECTED' },
  });
  return toReturnView(updated);
}

/** APPROVED -> PICKED_UP - the physical item collected. Launch is a
 * manual admin action (no logistics-service pickup integration here);
 * documented as the deliberate scope boundary for this prompt. */
export async function markPickedUp(id: string): Promise<ReturnView> {
  const existing = await findActiveReturn(id);
  if (existing.status !== 'APPROVED') {
    throw new AppError(
      'CONFLICT',
      409,
      `Cannot mark picked up a return in status ${existing.status}`,
    );
  }
  const updated = await prisma.returnRequest.update({
    where: { id },
    data: { status: 'PICKED_UP' },
  });
  return toReturnView(updated);
}

export interface ProcessRefundResult {
  return: ReturnView;
  refund: RefundResult;
  restocked: { skuId: string; available: number; reserved: number };
}

/**
 * THE money step. Requires PICKED_UP (not APPROVED) - the physical item
 * must be confirmed collected before money moves; a deliberate, documented
 * choice (an admin could otherwise refund before ever getting the item
 * back). IDEMPOTENCY: an already-REFUNDED return is rejected outright
 * (409) - never re-processed.
 *
 * ORDERING (the money-correctness property, locked): the refund (via
 * payment-service; W9: credited to the customer's YouMart Wallet) is done
 * FIRST. Then the RETRYABLE INTERNAL steps run: restock (inventory-service)
 * then order_item -> RETURNED (order-service), then return_request ->
 * REFUNDED. If either internal step throws, the refund has ALREADY happened
 * and is NEVER reversed - the return stays at PICKED_UP so a retry can
 * re-run just the internal steps. W9: the refund's idempotency key is this
 * return's id, so the retry gets the SAME refund back - never a second one
 * (before W9 a partial refund retried after a failed restock paid twice).
 */
export async function processRefund(id: string): Promise<ProcessRefundResult> {
  const existing = await findActiveReturn(id);

  if (existing.status === 'REFUNDED') {
    throw new AppError('CONFLICT', 409, 'This return has already been refunded');
  }
  if (existing.status !== 'PICKED_UP') {
    throw new AppError(
      'CONFLICT',
      409,
      `Cannot process a refund for a return in status ${existing.status} - it must be PICKED_UP`,
    );
  }
  if (!existing.refundAmount) {
    throw new AppError('CONFLICT', 409, 'This return has no refund amount set');
  }

  const item = await orderClient.getInternalOrderItem(existing.orderItemId);
  const refundAmount = decimalToMoney(existing.refundAmount);

  // STEP 1 - the refund (to the wallet). Never reversed below; a retry returns this same refund.
  const refund = await paymentClient.createRefund(
    item.orderId,
    refundAmount,
    existing.reason,
    `return:${id}`,
  );

  // STEPS 2+3 - RETRYABLE INTERNAL steps. A retry after a failure further down must not restock
  // twice: the item already RETURNED means the restock before it already happened.
  let restocked: ProcessRefundResult['restocked'] = {
    skuId: item.skuId,
    available: 0,
    reserved: 0,
  };
  if (item.sellerStatus !== 'RETURNED') {
    restocked = await inventoryClient.restock(item.skuId, item.quantity, `return ${id}`);
    await orderClient.setSellerItemStatus(existing.orderItemId, 'RETURNED');
  }

  const updated = await prisma.returnRequest.update({
    where: { id },
    data: { status: 'REFUNDED' },
  });

  // Refund-processed notification (Ch6.2c) - BEST-EFFORT, NEVER blocks or
  // fails the refund flow itself (already fully committed above by this
  // point, including when Razorpay itself was BLOCKED-on-creds).
  // `customerName` comes from the order's own snapshotted ship_full_name
  // (Ch6.1); email (buyer's email, resolved via authClient - cross-schema
  // isolation, returns_svc cannot read the auth schema directly).
  try {
    const orderView = await orderClient.getInternalOrder(item.orderId);
    const customerName = orderView.shippingAddress?.fullName ?? 'there';
    const notifyData = {
      customerName,
      amount: refundAmount,
      orderNumber: orderView.orderNumber,
    };

    if (orderView.shippingAddress?.phone) {
      await enqueueNotification({
        channel: 'WHATSAPP',
        to: orderView.shippingAddress.phone,
        templateKey: 'REFUND_PROCESSED',
        data: notifyData,
        userId: orderView.userId,
      });
    }
    const contact = await authClient.getUserContact(orderView.userId);
    if (contact.email) {
      await enqueueNotification({
        channel: 'EMAIL',
        to: contact.email,
        templateKey: 'REFUND_PROCESSED',
        data: notifyData,
        userId: orderView.userId,
      });
    }
  } catch (notifyErr: unknown) {
    // eslint-disable-next-line no-console
    console.error('failed to enqueue refund-processed notification(s)', notifyErr);
  }

  return { return: toReturnView(updated), refund, restocked };
}

export async function listReturnsAdmin(query: ListReturnsQuery): Promise<PaginatedReturns> {
  const { cursor, limit, status } = query;
  const rows = await prisma.returnRequest.findMany({
    where: { deletedAt: null, ...(status ? { status } : {}) },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    take: limit + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
  });
  const hasMore = rows.length > limit;
  const pageRows = hasMore ? rows.slice(0, limit) : rows;
  const nextCursor = hasMore ? (pageRows[pageRows.length - 1]?.id ?? null) : null;
  // v1.14: with the item title / order number, so the admin dashboard can show what it is for.
  return { items: await withItemDetails(pageRows.map(toReturnView)), nextCursor };
}
