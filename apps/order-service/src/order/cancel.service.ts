import type { Prisma } from '@youmart/db';
import type { Money } from '@youmart/shared-types';
import { AppError } from '@youmart/errors';
import { enqueueNotification } from '@youmart/notifications-client';
import type { RefundResult } from '@youmart/service-client';
import { prisma } from '../db';
import { inventoryClient, paymentClient } from '../serviceClients';
import { getOrder, type OrderItemStatusValue, type OrderView } from './order.service';
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
    return { outcome: 'CANCELLED', order: await getOrder(userId, orderId), cancelRequest: null };
  }

  if (order.items.some((item) => PAST_DISPATCH.includes(item.sellerStatus))) {
    throw new AppError(
      'CONFLICT',
      409,
      'This order has already shipped and can no longer be cancelled - please request a return instead',
    );
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
  items: CancelRequestView[];
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
  });
  const hasMore = rows.length > query.limit;
  const page = hasMore ? rows.slice(0, query.limit) : rows;
  return {
    items: page.map(toView),
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
  refund: RefundResult;
}

/**
 * Admin approval of a paid order's cancel request - same ordering as returns-service's
 * processRefund: the refund (the IRREVERSIBLE external step) runs FIRST, then the retryable
 * internal steps. Each item is restocked and marked CANCELLED one at a time, so a retry after a
 * partial failure skips items already handled (never double-restocks), and payment-service's
 * createRefund returns the existing refund on a repeat call (never double-refunds).
 * Invoices are not reversed here - a credit note is a separate, not-yet-built capability.
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
  const refund = await paymentClient.createRefund(
    order.id,
    amount,
    `Order cancelled on customer request (${request.id})`,
  );

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
        note: 'Cancelled on customer request - refund issued',
      },
    });
    return tx.orderCancelRequest.update({
      where: { id: request.id },
      data: { status: 'APPROVED', resolutionNote: note ?? null, resolvedAt: new Date() },
    });
  });

  // Best-effort, never blocks the cancellation; only when money actually moved.
  if (!refund.blocked && order.shipPhone) {
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
  });
  return toView(updated);
}
