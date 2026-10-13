import { createHmac, timingSafeEqual } from 'node:crypto';
import { Prisma } from '@youmart/db';
import type { Money } from '@youmart/shared-types';
import { AppError } from '@youmart/errors';
import { sum, add, subtract, compare } from '@youmart/shared-utils';
import type { InternalOrderView } from '@youmart/service-client';
import { prisma } from '../db';
import { config } from '../config';
import { orderClient } from '../serviceClients';
import { razorpay } from '../razorpayClient';
import { logger } from '../logger';
import { moneyToPaise } from './money-paise';
import { RazorpayWebhookPayload, CreateRefundBody, type VerifyPaymentBody } from './payment.schema';
import {
  captureHold,
  creditRefundInTx,
  findLiveHold,
  handleTopupCaptured,
  holdForOrder,
  isTopupOrder,
  lockWalletInTx,
  releaseHold,
  runWalletTransaction,
} from '../wallet/wallet.service';

const ZERO = '0.00' as Money;

function decimalToMoney(value: Prisma.Decimal): Money {
  return value.toFixed(2) as Money;
}

function toJsonInput(value: unknown): Prisma.InputJsonValue {
  return value as Prisma.InputJsonValue;
}

async function loadOwnOrder(userId: string, orderId: string): Promise<InternalOrderView> {
  const order = await orderClient.getInternalOrder(orderId);
  if (order.userId !== userId) {
    // Never reveal that the order exists but belongs to someone else.
    throw new AppError('NOT_FOUND', 404, 'Order not found');
  }
  return order;
}

export interface RazorpayOrderResult {
  razorpayOrderId: string;
  razorpayKeyId: string;
  /** Paise - the ONLINE part only when wallet money pays the rest (W9). */
  amount: number;
  currency: string;
  orderId: string;
}

/**
 * The Razorpay order for `amount` (the online part of `orderId`). Reuses the order's CREATED
 * payment when its amount still matches (retries / page refreshes); a CREATED payment for a
 * different amount (the customer switched the wallet on/off) is superseded - marked FAILED - and
 * a fresh Razorpay order created. A capture that still arrives on a superseded order is handled
 * by the webhook (see handleOrderCaptured).
 */
async function ensureRazorpayOrder(orderId: string, amount: Money): Promise<RazorpayOrderResult> {
  const amountPaise = moneyToPaise(amount);
  const existing = await prisma.payment.findFirst({
    where: { orderId, status: 'CREATED', deletedAt: null },
    orderBy: { createdAt: 'desc' },
  });

  if (existing?.razorpayOrderId && compare(decimalToMoney(existing.amount), amount) === 0) {
    return {
      razorpayOrderId: existing.razorpayOrderId,
      razorpayKeyId: config.razorpayKeyId,
      amount: amountPaise,
      currency: existing.currency,
      orderId,
    };
  }
  if (existing) {
    await prisma.payment.update({ where: { id: existing.id }, data: { status: 'FAILED' } });
  }

  const razorpayOrder = await razorpay.orders.create({
    amount: amountPaise,
    currency: 'INR',
    receipt: orderId,
  });

  await prisma.payment.create({
    data: {
      orderId,
      amount,
      currency: 'INR',
      status: 'CREATED',
      razorpayOrderId: razorpayOrder.id,
    },
  });

  return {
    razorpayOrderId: razorpayOrder.id,
    razorpayKeyId: config.razorpayKeyId, // public key id - safe to hand to the client
    amount: amountPaise,
    currency: 'INR',
    orderId,
  };
}

/**
 * Creates (or reuses) a Razorpay order for a PENDING_PAYMENT order (the pre-W9 endpoint, kept
 * for existing clients). W9: when wallet money is held for the order, Razorpay is only asked for
 * the rest.
 */
export async function createRazorpayOrder(
  userId: string,
  orderId: string,
): Promise<RazorpayOrderResult> {
  const order = await loadOwnOrder(userId, orderId);
  if (order.status !== 'PENDING_PAYMENT') {
    throw new AppError('CONFLICT', 409, `Cannot pay for an order in status ${order.status}`);
  }
  const hold = await findLiveHold(orderId);
  const held = hold?.status === 'HELD' ? hold.amount : ZERO;
  return ensureRazorpayOrder(orderId, subtract(order.grandTotal, held));
}

export interface PayOrderResult {
  /** PAID = done (the wallet covered everything); PAYMENT_REQUIRED = open Razorpay for the rest. */
  status: 'PAID' | 'PAYMENT_REQUIRED';
  orderId: string;
  walletAmount: Money;
  onlineAmount: Money;
  razorpay: RazorpayOrderResult | null;
}

/**
 * W9: pays a PENDING_PAYMENT order, optionally with YouMart Wallet money first.
 * - useWallet: as much of the total as is spendable is held for the order. If that covers the
 *   whole order it is captured at once and the order confirmed - no Razorpay step. Otherwise a
 *   Razorpay order is created for the rest (the hold is captured when Razorpay confirms).
 * - !useWallet: any hold is released and Razorpay is asked for the full total.
 * Safe to call again (same order): holds and Razorpay orders are reused; a confirmed order
 * answers PAID.
 */
export async function payOrder(
  userId: string,
  orderId: string,
  useWallet: boolean,
): Promise<PayOrderResult> {
  const order = await loadOwnOrder(userId, orderId);

  if (order.status === 'CONFIRMED') {
    const hold = await findLiveHold(orderId);
    const walletAmount = hold?.status === 'CAPTURED' ? hold.amount : ZERO;
    return {
      status: 'PAID',
      orderId,
      walletAmount,
      onlineAmount: subtract(order.grandTotal, walletAmount),
      razorpay: null,
    };
  }
  if (order.status !== 'PENDING_PAYMENT') {
    throw new AppError('CONFLICT', 409, `Cannot pay for an order in status ${order.status}`);
  }

  let hold = await findLiveHold(orderId);
  if (useWallet && !hold) {
    hold = await holdForOrder(userId, orderId, order.grandTotal);
  } else if (!useWallet && hold?.status === 'HELD') {
    await releaseHold(orderId);
    hold = null;
  }

  const walletAmount = hold?.amount ?? ZERO;
  const onlineAmount = subtract(order.grandTotal, walletAmount);

  if (compare(onlineAmount, ZERO) <= 0) {
    await captureHold(orderId, order.orderNumber);
    try {
      await orderClient.confirmOrder(orderId);
    } catch (err: unknown) {
      if (err instanceof AppError && err.httpStatus === 409) {
        // The order was cancelled/expired in the meantime - the wallet money goes straight back.
        await createRefund({
          orderId,
          amount: walletAmount,
          reason: 'Order was no longer awaiting payment',
          idempotencyKey: `wallet-pay-unconfirmed:${orderId}`,
        });
      }
      throw err;
    }
    // Any Razorpay order made earlier for this order is no longer needed.
    await prisma.payment.updateMany({
      where: { orderId, status: 'CREATED', deletedAt: null },
      data: { status: 'FAILED' },
    });
    return { status: 'PAID', orderId, walletAmount, onlineAmount: ZERO, razorpay: null };
  }

  return {
    status: 'PAYMENT_REQUIRED',
    orderId,
    walletAmount,
    onlineAmount,
    razorpay: await ensureRazorpayOrder(orderId, onlineAmount),
  };
}

export type RefundStatusValue = 'PENDING' | 'PROCESSED' | 'FAILED';

export interface RefundResult {
  refundId: string;
  /** The Razorpay payment refunded (pre-W9 refunds); null for wallet refunds. */
  paymentId: string | null;
  amount: Money;
  status: RefundStatusValue;
  razorpayRefundId: string | null;
  /** W9: WALLET = credited to the customer's YouMart Wallet (every new refund). */
  method: 'ORIGINAL_PAYMENT' | 'WALLET';
  /** Kept for callers written before W9: a wallet credit can't be blocked, so always false. */
  blocked: boolean;
}

type RefundRow = Prisma.RefundGetPayload<object>;

function toRefundResult(row: RefundRow): RefundResult {
  return {
    refundId: row.id,
    paymentId: row.paymentId,
    amount: decimalToMoney(row.amount),
    status: row.status,
    razorpayRefundId: row.razorpayRefundId,
    method: row.method,
    blocked: false,
  };
}

/** What was actually paid for an order: captured Razorpay payments + spent wallet holds. */
async function paidAndRefunded(
  tx: Prisma.TransactionClient,
  orderId: string,
): Promise<{ paid: Money; refunded: Money }> {
  const [payments, holds, refunds] = await Promise.all([
    tx.payment.findMany({
      where: { orderId, status: { in: ['CAPTURED', 'REFUNDED'] }, deletedAt: null },
    }),
    tx.walletHold.findMany({ where: { orderId, status: 'CAPTURED', deletedAt: null } }),
    tx.refund.findMany({ where: { orderId, status: 'PROCESSED', deletedAt: null } }),
  ]);
  return {
    paid: sum([...payments, ...holds].map((row) => decimalToMoney(row.amount))),
    refunded: sum(refunds.map((row) => decimalToMoney(row.amount))),
  };
}

function isUniqueViolation(err: unknown): boolean {
  return err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002';
}

/**
 * W9: every refund is credited to the customer's YouMart Wallet (store credit) - called by
 * returns-service (a refunded return) and order-service (an approved cancellation), and by this
 * service's own webhook (a capture on a cancelled order).
 *
 * NEVER OVER-REFUND: under the customer's wallet lock, the amount must fit in what was actually
 * paid for the order (Razorpay captures + spent wallet money) minus what was already refunded.
 * The refund row and the wallet credit are written in ONE transaction - there is no external call
 * that can fail half way, so a refund can no longer be "blocked" and silently lost.
 *
 * RETRY-SAFE: `idempotencyKey` (the return / cancel-request id) makes a repeated call return the
 * first refund instead of paying again - for partial refunds too (one item of a larger order),
 * which the pre-W9 "payment fully REFUNDED" check didn't cover.
 */
export async function createRefund(input: CreateRefundBody): Promise<RefundResult> {
  const key = input.idempotencyKey ?? null;
  if (key) {
    const existing = await prisma.refund.findFirst({
      where: { idempotencyKey: key, deletedAt: null },
    });
    if (existing) return toRefundResult(existing);
  }

  const order = await orderClient.getInternalOrder(input.orderId);

  try {
    return await runWalletTransaction(async (tx) => {
      await lockWalletInTx(tx, order.userId);
      if (key) {
        const existing = await tx.refund.findFirst({
          where: { idempotencyKey: key, deletedAt: null },
        });
        if (existing) return toRefundResult(existing);
      }

      const { paid, refunded } = await paidAndRefunded(tx, input.orderId);
      if (compare(paid, ZERO) <= 0) {
        throw new AppError('CONFLICT', 409, `Nothing was paid for order ${input.orderId}`);
      }
      const remaining = subtract(paid, refunded);
      if (compare(input.amount, remaining) > 0) {
        throw new AppError(
          'VALIDATION_ERROR',
          400,
          `Refund amount ${input.amount} exceeds the remaining refundable amount ${remaining}`,
          { orderId: input.orderId, paid, alreadyRefunded: refunded, remaining },
        );
      }

      const refund = await tx.refund.create({
        data: {
          orderId: input.orderId,
          paymentId: null,
          method: 'WALLET',
          amount: input.amount,
          reason: input.reason ?? null,
          status: 'PROCESSED',
          idempotencyKey: key,
        },
      });
      await creditRefundInTx(tx, {
        userId: order.userId,
        refundId: refund.id,
        amount: input.amount,
        orderId: input.orderId,
        orderNumber: order.orderNumber,
        reason: input.reason,
      });
      if (compare(add(refunded, input.amount), paid) >= 0) {
        await tx.payment.updateMany({
          where: { orderId: input.orderId, status: 'CAPTURED', deletedAt: null },
          data: { status: 'REFUNDED' },
        });
      }
      return toRefundResult(refund);
    });
  } catch (err: unknown) {
    // A concurrent call with the same key won the race - return its refund.
    if (key && isUniqueViolation(err)) {
      const existing = await prisma.refund.findFirst({
        where: { idempotencyKey: key, deletedAt: null },
      });
      if (existing) return toRefundResult(existing);
    }
    throw err;
  }
}

/** Refunds whatever is still refundable for an order to the wallet (0 = nothing to do). */
async function refundRemainder(orderId: string, reason: string, idempotencyKey: string) {
  const { paid, refunded } = await paidAndRefunded(prisma, orderId);
  const remaining = subtract(paid, refunded);
  if (compare(remaining, ZERO) <= 0) return null;
  return createRefund({ orderId, amount: remaining, reason, idempotencyKey });
}

export interface OrderPaymentSummary {
  orderId: string;
  /** Wallet money spent on (or reserved for) the order. */
  walletAmount: Money;
  /** Paid online through Razorpay. */
  onlineAmount: Money;
  refundedTotal: Money;
  refunds: {
    refundId: string;
    amount: Money;
    method: 'ORIGINAL_PAYMENT' | 'WALLET';
    status: RefundStatusValue;
    reason: string | null;
    createdAt: string;
  }[];
}

/** W9: how the customer's order was paid and what has been refunded (order details page). */
export async function getOrderPaymentSummary(
  userId: string,
  orderId: string,
): Promise<OrderPaymentSummary> {
  await loadOwnOrder(userId, orderId);
  const [payments, hold, refunds] = await Promise.all([
    prisma.payment.findMany({
      where: { orderId, status: { in: ['CAPTURED', 'REFUNDED'] }, deletedAt: null },
    }),
    findLiveHold(orderId),
    prisma.refund.findMany({
      where: { orderId, status: 'PROCESSED', deletedAt: null },
      orderBy: { createdAt: 'asc' },
    }),
  ]);
  return {
    orderId,
    walletAmount: hold?.amount ?? ZERO,
    onlineAmount: sum(payments.map((p) => decimalToMoney(p.amount))),
    refundedTotal: sum(refunds.map((r) => decimalToMoney(r.amount))),
    refunds: refunds.map((r) => ({
      refundId: r.id,
      amount: decimalToMoney(r.amount),
      method: r.method,
      status: r.status,
      reason: r.reason,
      createdAt: r.createdAt.toISOString(),
    })),
  };
}

/**
 * HMAC-SHA256(rawBody, RAZORPAY_WEBHOOK_SECRET) compared to the
 * `X-Razorpay-Signature` header using a constant-time compare
 * (`timingSafeEqual`) - THE security boundary for the webhook. An
 * unverified/invalid signature must never reach any mutation.
 */
export function verifyWebhookSignature(
  rawBody: Buffer,
  signatureHeader: string | undefined,
): boolean {
  if (!signatureHeader) {
    return false;
  }

  const expectedHex = createHmac('sha256', config.razorpayWebhookSecret)
    .update(rawBody)
    .digest('hex');
  const expected = Buffer.from(expectedHex, 'utf8');
  const actual = Buffer.from(signatureHeader, 'utf8');

  // Length check first (not constant-time, but leaks nothing about the
  // secret - only about the attacker's own guess's length) - timingSafeEqual
  // itself throws on mismatched buffer lengths rather than returning false.
  if (expected.length !== actual.length) {
    return false;
  }
  return timingSafeEqual(expected, actual);
}

// Razorpay doesn't guarantee a dedicated event-id header on every account
// tier - prefer it when present, else fall back to a deterministic
// composite key (event type + payment id), sufficient to dedupe retries of
// the SAME event for the SAME payment.
function extractEventId(
  headerEventId: string | undefined,
  payload: RazorpayWebhookPayload,
): string {
  if (headerEventId) {
    return headerEventId;
  }
  return `${payload.event}:${payload.payload.payment.entity.id}`;
}

export interface HandleWebhookInput {
  rawBody: Buffer;
  signature: string | undefined;
  headerEventId: string | undefined;
  body: unknown;
}

/**
 * A captured ORDER payment (W9 split-payment aware). The online part plus the order's wallet hold
 * must make the order total:
 * - online alone covers it (e.g. the customer switched the wallet off and paid a superseded
 *   full-amount Razorpay order): any hold is released, nothing spent from the wallet;
 * - otherwise the HELD hold must be exactly the rest: it is captured (spent);
 * - anything else (the hold was released meanwhile): the order can't be confirmed as paid - the
 *   online money is credited to the wallet instead and the order stays unpaid.
 * Then the order is confirmed; a capture on an order cancelled meanwhile is refunded in full to the
 * wallet (W1 behaviour, now store credit).
 */
async function handleOrderCaptured(
  paymentId: string,
  orderId: string,
  online: Money,
): Promise<void> {
  const order = await orderClient.getInternalOrder(orderId);

  if (order.status === 'PENDING_PAYMENT') {
    const need = subtract(order.grandTotal, online);
    const hold = await findLiveHold(orderId);
    if (compare(need, ZERO) <= 0) {
      if (hold?.status === 'HELD') await releaseHold(orderId);
    } else if (hold && compare(hold.amount, need) === 0) {
      await captureHold(orderId, order.orderNumber);
    } else {
      const refund = await refundRemainder(
        orderId,
        'Online payment did not match the amount due - credited to wallet',
        `underpaid:${paymentId}`,
      );
      logger.error(
        { orderId, paymentId, online, need, hold, refundId: refund?.refundId },
        'captured online amount does not complete the order - credited to wallet, order not confirmed',
      );
      return;
    }
  }

  try {
    await orderClient.confirmOrder(orderId);
  } catch (err: unknown) {
    // W1: the customer cancelled the unpaid order (stock already released) but the capture
    // still arrived - refund it in full (W9: to the wallet) instead of failing every retry.
    const current =
      err instanceof AppError && err.httpStatus === 409
        ? await orderClient.getInternalOrder(orderId)
        : null;
    if (current?.status !== 'CANCELLED') {
      throw err;
    }
    const refund = await refundRemainder(
      orderId,
      'Payment captured after the order was cancelled',
      `captured-after-cancel:${paymentId}`,
    );
    logger.warn(
      { orderId, refundId: refund?.refundId },
      'payment captured for a cancelled order - refunded to wallet',
    );
  }
}

/**
 * Processes a (already route-level-fetched) webhook request. Order:
 * 1. Verify signature - invalid => 400, NOTHING mutated (throws before any
 *    DB read/write).
 * 2. Parse payload shape - malformed => 400.
 * 3. Idempotency: an event_id already marked `processedAt` => no-op success
 *    (Razorpay retries must never double-confirm/double-commit).
 * 4. W9: a wallet top-up's Razorpay order -> credit the wallet (idempotent).
 * 5. Amount validation: the captured amount must match the payment's own
 *    expected amount (guards against a mismatched/tampered amount).
 * 6. Apply the event (payment.captured -> CAPTURED + spend the wallet hold +
 *    confirm order; payment.failed -> recorded only, the order stays payable -
 *    W5) - every step is itself idempotent, so a retry that re-enters this
 *    branch (e.g. a crash before `processedAt` was set) is still safe.
 */
export async function handleWebhook(input: HandleWebhookInput): Promise<void> {
  const { rawBody, signature, headerEventId, body } = input;

  if (!verifyWebhookSignature(rawBody, signature)) {
    throw new AppError('VALIDATION_ERROR', 400, 'Invalid webhook signature');
  }

  const parsed = RazorpayWebhookPayload.safeParse(body);
  if (!parsed.success) {
    throw new AppError('VALIDATION_ERROR', 400, 'Malformed webhook payload');
  }
  const payload = parsed.data;
  const eventId = extractEventId(headerEventId, payload);

  const existingEvent = await prisma.paymentWebhookEvent.findFirst({
    where: { eventId, deletedAt: null },
  });
  if (existingEvent?.processedAt) {
    return;
  }

  const eventRow =
    existingEvent ??
    (await prisma.paymentWebhookEvent.create({ data: { eventId, payload: toJsonInput(body) } }));
  const markProcessed = () =>
    prisma.paymentWebhookEvent.update({
      where: { id: eventRow.id },
      data: { processedAt: new Date() },
    });

  const paymentEntity = payload.payload.payment.entity;

  // W9: "Add money" top-ups use their own Razorpay orders.
  if (await isTopupOrder(paymentEntity.order_id)) {
    if (payload.event === 'payment.captured') {
      await handleTopupCaptured(paymentEntity.order_id, paymentEntity.id, paymentEntity.amount);
    } else {
      logger.info({ razorpayOrderId: paymentEntity.order_id }, 'wallet top-up attempt failed');
    }
    await markProcessed();
    return;
  }

  const payment = await prisma.payment.findFirst({
    where: { razorpayOrderId: paymentEntity.order_id, deletedAt: null },
  });

  if (!payment) {
    // Unknown order (not one we created) - mark processed so Razorpay's
    // retries don't loop forever, but there's nothing to update.
    await markProcessed();
    return;
  }

  const expectedPaise = moneyToPaise(decimalToMoney(payment.amount));
  if (paymentEntity.amount !== expectedPaise) {
    await markProcessed();
    throw new AppError(
      'VALIDATION_ERROR',
      400,
      'Webhook amount does not match expected payment amount',
    );
  }

  if (payload.event === 'payment.captured') {
    await prisma.payment.update({
      where: { id: payment.id },
      data: { status: 'CAPTURED', razorpayPaymentId: paymentEntity.id },
    });
    // Ch6.5: order-service's internal endpoints are SERVICE-ONLY (requireServiceAuth) - the
    // client mints its own short-lived service token per call.
    await handleOrderCaptured(payment.id, payment.orderId, decimalToMoney(payment.amount));
  } else if (payload.event === 'payment.failed') {
    // W5: one failed ATTEMPT is not a failed order - Razorpay Checkout lets the customer retry the
    // same Razorpay order (another card/UPI), so the order stays PENDING_PAYMENT with its stock held
    // (and any wallet hold kept) and the payment row stays CREATED (reused by the next attempt).
    // The event itself is kept in payment_webhook_event for the audit trail.
    logger.info(
      { orderId: payment.orderId, razorpayOrderId: paymentEntity.order_id },
      'payment attempt failed - order stays payable',
    );
  }

  await markProcessed();
}

export interface VerifyPaymentResult {
  kind: 'ORDER' | 'TOPUP';
  /** PAID = applied now (order confirmed / wallet credited); PENDING = Razorpay hasn't captured
   * it yet - the webhook will apply it when it does. */
  status: 'PAID' | 'PENDING';
}

/**
 * W9: client-side confirmation, so the customer doesn't wait on the webhook (and local
 * development works without a tunnel). Razorpay Checkout's success handler returns
 * { razorpay_order_id, razorpay_payment_id, razorpay_signature }; the app sends them here.
 * 1. The signature must be HMAC-SHA256(order_id + "|" + payment_id, key_secret) - Razorpay's
 *    documented check (constant-time compare). Anything else is a 400; nothing changes.
 * 2. The Razorpay order must belong to the caller (their top-up or their order) - else 404.
 * 3. The payment is re-read from Razorpay's API (never trusting the client): it must be for this
 *    Razorpay order; an `authorized` payment is captured; anything not `captured` is PENDING.
 * 4. The capture is applied exactly like the webhook does (same idempotent steps), so whichever of
 *    the two arrives first does the work and the other is a no-op.
 */
export async function verifyClientPayment(
  userId: string,
  input: VerifyPaymentBody,
): Promise<VerifyPaymentResult> {
  const expected = Buffer.from(
    createHmac('sha256', config.razorpayKeySecret)
      .update(`${input.razorpayOrderId}|${input.razorpayPaymentId}`)
      .digest('hex'),
  );
  const actual = Buffer.from(input.razorpaySignature);
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) {
    throw new AppError('VALIDATION_ERROR', 400, 'Invalid payment signature');
  }

  const topup = await prisma.walletTopup.findFirst({
    where: { razorpayOrderId: input.razorpayOrderId, deletedAt: null },
  });
  const payment = topup
    ? null
    : await prisma.payment.findFirst({
        where: { razorpayOrderId: input.razorpayOrderId, deletedAt: null },
      });
  if (topup ? topup.userId !== userId : !payment) {
    throw new AppError('NOT_FOUND', 404, 'Payment not found');
  }
  if (payment) {
    const order = await orderClient.getInternalOrder(payment.orderId);
    if (order.userId !== userId) {
      throw new AppError('NOT_FOUND', 404, 'Payment not found');
    }
  }
  const kind: VerifyPaymentResult['kind'] = topup ? 'TOPUP' : 'ORDER';

  let rp = await razorpay.payments.fetch(input.razorpayPaymentId);
  if (rp.order_id !== input.razorpayOrderId) {
    throw new AppError('VALIDATION_ERROR', 400, 'Payment does not belong to this order');
  }
  if (rp.status === 'authorized') {
    rp = await razorpay.payments.capture(rp.id, rp.amount, rp.currency);
  }
  if (rp.status !== 'captured') {
    return { kind, status: 'PENDING' };
  }

  if (topup) {
    await handleTopupCaptured(input.razorpayOrderId, rp.id, rp.amount);
    return { kind, status: 'PAID' };
  }

  const row = payment!;
  if (rp.amount !== moneyToPaise(decimalToMoney(row.amount))) {
    throw new AppError('VALIDATION_ERROR', 400, 'Payment amount does not match the order');
  }
  await prisma.payment.update({
    where: { id: row.id },
    data: { status: 'CAPTURED', razorpayPaymentId: rp.id },
  });
  await handleOrderCaptured(row.id, row.orderId, decimalToMoney(row.amount));
  return { kind, status: 'PAID' };
}
