import type { Prisma } from '@youmart/db';
import type { Money } from '@youmart/shared-types';
import { AppError } from '@youmart/errors';
import { enqueueNotification, notifyInbox } from '@youmart/notifications-client';
import type { RefundResult } from '@youmart/service-client';
import { prisma } from '../db';
import { inventoryClient, paymentClient } from '../serviceClients';
import { releaseCouponForOrder } from '../coupon/coupon.service';
import {
  getOrder,
  releaseWalletHold,
  type OrderItemStatusValue,
  type OrderView,
} from './order.service';
import type { CancelOrderBody, ListCancelRequestsQuery } from './cancel.schema';

export type CancelRequestStatusValue = 'REQUESTED' | 'APPROVED' | 'REJECTED';

export interface CancelRequestView {
  cancelRequestId: string;
  orderId: string;
  status: CancelRequestStatusValue;
  reason: string;
  comment: string | null;
  resolutionNote: string | null;
  createdAt: string;
  resolvedAt: string | null;
}

export interface CancelOrderResult {
  /** CANCELLED = done immediately (unpaid order); CANCEL_REQUESTED = paid order, awaits an admin. */
  outcome: 'CANCELLED' | 'CANCEL_REQUESTED';
  order: OrderView;
  cancelRequest: CancelRequestView | null;
}

/** Items in these states have left (or come back to) the warehouse - cancelling is no longer
 * possible; the customer uses the returns flow instead. */
const PAST_DISPATCH: OrderItemStatusValue[] = ['SHIPPED', 'DELIVERED', 'RETURNED'];
/** Items an approved cancellation stops (and restocks). */
const CANCELLABLE_ITEM: OrderItemStatusValue[] = ['PENDING', 'CONFIRMED', 'PACKED'];

type CancelRequestRow = Prisma.OrderCancelRequestGetPayload<object>;

function toView(row: CancelRequestRow): CancelRequestView {
  return {
    cancelRequestId: row.id,
    orderId: row.orderId,
    status: row.status,
    reason: row.reason,
    comment: row.comment,
    resolutionNote: row.resolutionNote,
    createdAt: row.createdAt.toISOString(),
    resolvedAt: row.resolvedAt ? row.resolvedAt.toISOString() : null,
  };
}

function decimalToMoney(value: Prisma.Decimal): Money {
  return value.toFixed(2) as Money;
}

/**
 * Customer-initiated cancel (W1, launch policy):
 * - PENDING_PAYMENT (nothing paid): cancelled IMMEDIATELY - the order row is claimed with a
 *   conditional update first (so a racing payment capture can't also confirm it; see
 *   confirmOrder), then the held stock is released. A capture that still arrives later is
 *   refunded automatically by payment-service's webhook.
 * - CONFIRMED (paid): creates a cancel REQUEST for an admin to approve/reject - money only moves
 *   after a human decision, and never once an item has shipped (409 -> use returns). Asking
 *   again while a request is open returns that same request.
 * - CANCELLED: idempotent - re-runs the (idempotent) stock release and returns the order, so a
 *   release that failed after the status flip is completed by simply asking again.
 */
export async function cancelOrderAsCustomer(
  userId: string,
  orderId: string,
  input: CancelOrderBody,
): Promise<CancelOrderResult> {
  const order = await prisma.order.findFirst({
    where: { id: orderId, userId, deletedAt: null },
    include: { items: { where: { deletedAt: null } } },
  });
  if (!order) {
    throw new AppError('NOT_FOUND', 404, 'Order not found');
  }

  if (order.status === 'CANCELLED') {
    await inventoryClient.releaseByOrder(orderId);
    await releaseWalletHold(orderId);
    await releaseCouponForOrder(orderId);
    return { outcome: 'CANCELLED', order: await getOrder(userId, orderId), cancelRequest: null };
  }

  if (order.status === 'PENDING_PAYMENT') {
    const note = `Cancelled by customer: ${input.reason}`;
    await prisma.$transaction(async (tx) => {
      const claimed = await tx.order.updateMany({
        where: { id: orderId, status: 'PENDING_PAYMENT', deletedAt: null },
        data: { status: 'CANCELLED' },
      });
      if (claimed.count === 0) {
        throw new AppError('CONFLICT', 409, 'This order can no longer be cancelled directly');
      }
      await tx.orderItem.updateMany({
        where: { orderId, deletedAt: null },
        data: { sellerStatus: 'CANCELLED' },
      });
      await tx.orderStatusHistory.create({
        data: { orderId, fromStatus: 'PENDING_PAYMENT', toStatus: 'CANCELLED', note },
      });
    });
    await inventoryClient.releaseByOrder(orderId);
    await releaseWalletHold(orderId);
    await releaseCouponForOrder(orderId);
    return { outcome: 'CANCELLED', order: await getOrder(userId, orderId), cancelRequest: null };
  }

  if (order.items.some((item) => PAST_DISPATCH.includes(item.sellerStatus))) {
    throw new AppError(
      'CONFLICT',
      409,
      'This order has already shipped and can no longer be cancelled - please request a return instead',
    );
  }

  // Cash on Delivery, not shipped yet: no money has moved, so it is cancelled right away (no
  // admin approval, no refund) - stock goes back and the cash-to-collect is voided.
  if (order.paymentMethod === 'COD') {
    const note = `Cancelled by customer (Cash on Delivery): ${input.reason}`;
    await prisma.$transaction(async (tx) => {
      const claimed = await tx.order.updateMany({
        where: { id: orderId, status: 'CONFIRMED', deletedAt: null },
        data: { status: 'CANCELLED' },
      });
      if (claimed.count === 0) {
        throw new AppError('CONFLICT', 409, 'This order can no longer be cancelled');
      }
      await tx.orderStatusHistory.create({
        data: { orderId, fromStatus: 'CONFIRMED', toStatus: 'CANCELLED', note },
      });
    });
    for (const item of order.items) {
      if (!CANCELLABLE_ITEM.includes(item.sellerStatus)) continue;
      await inventoryClient.restock(item.skuId, item.quantity, `cod cancel ${orderId}`);
      await prisma.orderItem.update({
        where: { id: item.id },
        data: { sellerStatus: 'CANCELLED' },
      });
    }
    await releaseCouponForOrder(orderId);
    await paymentClient.voidCod(orderId).catch((err: unknown) => {
      // eslint-disable-next-line no-console
      console.error('failed to void COD payment', err);
    });
    await notifyInbox(userId, 'ORDER_CANCELLED', {
      orderId,
      orderNumber: order.orderNumber,
      note: 'Nothing to pay - it was Cash on Delivery.',
    });
    return { outcome: 'CANCELLED', order: await getOrder(userId, orderId), cancelRequest: null };
  }

  const open = await prisma.orderCancelRequest.findFirst({
    where: { orderId, status: 'REQUESTED', deletedAt: null },
  });
  const request =
    open ??
    (await prisma.orderCancelRequest.create({
      data: { orderId, userId, reason: input.reason, comment: input.comment ?? null },
    }));

  return {
    outcome: 'CANCEL_REQUESTED',
    order: await getOrder(userId, orderId),
    cancelRequest: toView(request),
  };
}

export interface PaginatedCancelRequests {
  /** v1.14: with the order's number / total / payment method for the admin dashboard. */
  items: Array<
    CancelRequestView & {
      orderNumber: string;
      grandTotal: Money;
      paymentMethod: 'ONLINE' | 'COD';
      customerName: string | null;
    }
  >;
  nextCursor: string | null;
}

export async function listCancelRequests(
  query: ListCancelRequestsQuery,
): Promise<PaginatedCancelRequests> {
  const rows = await prisma.orderCancelRequest.findMany({
    where: { deletedAt: null, ...(query.status ? { status: query.status } : {}) },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    take: query.limit + 1,
    ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
    include: {
      order: {
        select: { orderNumber: true, grandTotal: true, paymentMethod: true, shipFullName: true },
      },
    },
  });
  const hasMore = rows.length > query.limit;
  const page = hasMore ? rows.slice(0, query.limit) : rows;
  return {
    items: page.map((row) => ({
      ...toView(row),
      orderNumber: row.order.orderNumber,
      grandTotal: decimalToMoney(row.order.grandTotal),
      paymentMethod: row.order.paymentMethod,
      customerName: row.order.shipFullName,
    })),
    nextCursor: hasMore ? (page[page.length - 1]?.id ?? null) : null,
  };
}

async function findOpenRequest(id: string): Promise<CancelRequestRow> {
  const row = await prisma.orderCancelRequest.findFirst({ where: { id, deletedAt: null } });
  if (!row) {
    throw new AppError('NOT_FOUND', 404, 'Cancel request not found');
  }
  if (row.status !== 'REQUESTED') {
    throw new AppError('CONFLICT', 409, `This cancel request is already ${row.status}`);
  }
  return row;
}

export interface ApproveCancelResult {
  cancelRequest: CancelRequestView;
  /** null for a Cash on Delivery order: nothing was paid, so nothing is refunded. */
  refund: RefundResult | null;
}

/**
 * Admin approval of a paid order's cancel request - same ordering as returns-service's
 * processRefund: the refund runs FIRST (W9: credited to the customer's YouMart Wallet), then the
 * retryable internal steps. Each item is restocked and marked CANCELLED one at a time, so a retry
 * after a partial failure skips items already handled (never double-restocks), and the refund's
 * idempotency key (this request's id) makes a repeat call return the first refund (never pays
 * twice). Invoices are not reversed here - a credit note is a separate, not-yet-built capability.
 */
export async function approveCancelRequest(
  id: string,
  note: string | undefined,
): Promise<ApproveCancelResult> {
  const request = await findOpenRequest(id);
  const order = await prisma.order.findFirst({
    where: { id: request.orderId, deletedAt: null },
    include: { items: { where: { deletedAt: null } } },
  });
  if (!order) {
    throw new AppError('NOT_FOUND', 404, 'Order not found');
  }
  if (order.status !== 'CONFIRMED') {
    throw new AppError('CONFLICT', 409, `Cannot cancel an order in status ${order.status}`);
  }
  if (order.items.some((item) => PAST_DISPATCH.includes(item.sellerStatus))) {
    throw new AppError(
      'CONFLICT',
      409,
      'An item has already shipped - reject this request and use the returns flow',
    );
  }

  const amount = decimalToMoney(order.grandTotal);
  const cod = order.paymentMethod === 'COD';
  const refund = cod
    ? null
    : await paymentClient.createRefund(
        order.id,
        amount,
        `Order cancelled on customer request (${request.id})`,
        `cancel:${request.id}`,
      );
  if (cod) await paymentClient.voidCod(order.id);

  for (const item of order.items) {
    if (!CANCELLABLE_ITEM.includes(item.sellerStatus)) continue;
    await inventoryClient.restock(item.skuId, item.quantity, `cancel ${request.id}`);
    await prisma.orderItem.update({ where: { id: item.id }, data: { sellerStatus: 'CANCELLED' } });
  }

  const resolved = await prisma.$transaction(async (tx) => {
    await tx.order.update({ where: { id: order.id }, data: { status: 'CANCELLED' } });
    await tx.orderStatusHistory.create({
      data: {
        orderId: order.id,
        fromStatus: 'CONFIRMED',
        toStatus: 'CANCELLED',
        note: cod
          ? 'Cancelled on customer request (Cash on Delivery - nothing to refund)'
          : 'Cancelled on customer request - refunded to YouMart Wallet',
      },
    });
    return tx.orderCancelRequest.update({
      where: { id: request.id },
      data: { status: 'APPROVED', resolutionNote: note ?? null, resolvedAt: new Date() },
    });
  });

  await releaseCouponForOrder(order.id);

  // v1.15: inbox - the cancellation, and (paid orders) the wallet refund.
  await notifyInbox(order.userId, 'ORDER_CANCELLED', {
    orderId: order.id,
    orderNumber: order.orderNumber,
    refundAmount: cod ? null : amount,
    note: note ?? null,
  });
  if (!cod) {
    await notifyInbox(order.userId, 'REFUND_PROCESSED', {
      orderId: order.id,
      orderNumber: order.orderNumber,
      amount,
    });
  }

  // Best-effort, never blocks the cancellation.
  if (order.shipPhone && !cod) {
    await enqueueNotification({
      channel: 'WHATSAPP',
      to: order.shipPhone,
      templateKey: 'REFUND_PROCESSED',
      data: {
        customerName: order.shipFullName ?? 'there',
        amount,
        orderNumber: order.orderNumber,
      },
      userId: order.userId,
    });
  }

  return { cancelRequest: toView(resolved), refund };
}

export async function rejectCancelRequest(
  id: string,
  note: string | undefined,
): Promise<CancelRequestView> {
  const request = await findOpenRequest(id);
  const updated = await prisma.orderCancelRequest.update({
    where: { id: request.id },
    data: { status: 'REJECTED', resolutionNote: note ?? null, resolvedAt: new Date() },
    include: { order: { select: { userId: true, orderNumber: true } } },
  });
  await notifyInbox(updated.order.userId, 'CANCEL_REQUEST_DECLINED', {
    orderId: updated.orderId,
    orderNumber: updated.order.orderNumber,
    note: note ?? null,
  });
  return toView(updated);
}
