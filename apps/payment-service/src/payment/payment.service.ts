import { createHmac, timingSafeEqual } from 'node:crypto';
import type { Prisma } from '@youmart/db';
import type { Money } from '@youmart/shared-types';
import { AppError } from '@youmart/errors';
import { prisma } from '../db';
import { config } from '../config';
import { orderClient } from '../serviceClients';
import { razorpay } from '../razorpayClient';
import { moneyToPaise } from './money-paise';
import { RazorpayWebhookPayload } from './payment.schema';

function decimalToMoney(value: Prisma.Decimal): Money {
  return value.toFixed(2) as Money;
}

function toJsonInput(value: unknown): Prisma.InputJsonValue {
  return value as Prisma.InputJsonValue;
}

export interface RazorpayOrderResult {
  razorpayOrderId: string;
  razorpayKeyId: string;
  amount: number;
  currency: string;
  orderId: string;
}

/**
 * Ephemeral, process-local cache of the end-user's bearer token, keyed by
 * OUR OWN `orderId` (known as soon as the order/ownership checks pass,
 * regardless of whether the Razorpay API call itself succeeds), populated
 * when the Razorpay order is created and consulted later when the webhook
 * (which has NO user/auth context at all - Razorpay calls it, not a
 * logged-in user) needs to call `orderClient.confirmOrder`/`cancelOrder`.
 *
 * This is a deliberate, documented stop-gap: there is no service-to-service
 * auth token system yet (flagged repeatedly across Ch4.4-4.5), and the
 * webhook path has no token to forward at all. Known limitations: (1) lost
 * on process restart; (2) if the access token has expired by the time the
 * webhook arrives (access tokens live 900s), the confirm/cancel call will
 * 401 and the order is left un-confirmed pending manual reconciliation. A
 * real service-to-service credential (e.g. a client-credentials token for
 * inter-service calls) should replace this in a later chapter.
 */
const pendingAuthTokens = new Map<string, { authToken: string; userId: string }>();

/**
 * Creates (or reuses) a Razorpay order for a PENDING_PAYMENT order.
 * Reusing an existing CREATED payment avoids creating a duplicate Razorpay
 * order on retries/page-refreshes (idempotent-ish, not a full idempotency
 * key system - documented, matches the checkout double-click guard's
 * pragmatism in Ch4.5b).
 */
export async function createRazorpayOrder(
  userId: string,
  orderId: string,
  authToken: string,
): Promise<RazorpayOrderResult> {
  const order = await orderClient.getInternalOrder(orderId, authToken);

  if (order.userId !== userId) {
    // Never reveal that the order exists but belongs to someone else.
    throw new AppError('NOT_FOUND', 404, 'Order not found');
  }
  if (order.status !== 'PENDING_PAYMENT') {
    throw new AppError('CONFLICT', 409, `Cannot pay for an order in status ${order.status}`);
  }

  // Cached as soon as we know the order/ownership checks passed - not
  // gated on Razorpay itself succeeding, so a retried create-order call or
  // a transient Razorpay outage doesn't strand the webhook without a token.
  pendingAuthTokens.set(orderId, { authToken, userId });

  const amountPaise = moneyToPaise(order.grandTotal);

  const existing = await prisma.payment.findFirst({
    where: { orderId, status: 'CREATED', deletedAt: null },
  });

  if (existing?.razorpayOrderId) {
    return {
      razorpayOrderId: existing.razorpayOrderId,
      razorpayKeyId: config.razorpayKeyId,
      amount: amountPaise,
      currency: existing.currency,
      orderId,
    };
  }

  const razorpayOrder = await razorpay.orders.create({
    amount: amountPaise,
    currency: 'INR',
    receipt: orderId,
  });

  await prisma.payment.create({
    data: {
      orderId,
      amount: order.grandTotal,
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
 * Processes a (already route-level-fetched) webhook request. Order:
 * 1. Verify signature - invalid => 400, NOTHING mutated (throws before any
 *    DB read/write).
 * 2. Parse payload shape - malformed => 400.
 * 3. Idempotency: an event_id already marked `processedAt` => no-op success
 *    (Razorpay retries must never double-confirm/double-commit).
 * 4. Amount validation: the captured amount must match the payment's own
 *    expected amount (guards against a mismatched/tampered amount).
 * 5. Apply the event (payment.captured -> CAPTURED + confirm order;
 *    payment.failed -> FAILED + cancel order) - both the payment update and
 *    the order confirm/cancel calls are themselves idempotent, so a retry
 *    that re-enters this branch (e.g. a crash before `processedAt` was set)
 *    is still safe.
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

  const paymentEntity = payload.payload.payment.entity;
  const payment = await prisma.payment.findFirst({
    where: { razorpayOrderId: paymentEntity.order_id, deletedAt: null },
  });

  if (!payment) {
    // Unknown order (not one we created) - mark processed so Razorpay's
    // retries don't loop forever, but there's nothing to update.
    await prisma.paymentWebhookEvent.update({
      where: { id: eventRow.id },
      data: { processedAt: new Date() },
    });
    return;
  }

  const expectedPaise = moneyToPaise(decimalToMoney(payment.amount));
  if (paymentEntity.amount !== expectedPaise) {
    await prisma.paymentWebhookEvent.update({
      where: { id: eventRow.id },
      data: { processedAt: new Date() },
    });
    throw new AppError(
      'VALIDATION_ERROR',
      400,
      'Webhook amount does not match expected payment amount',
    );
  }

  const cached = pendingAuthTokens.get(payment.orderId);

  if (payload.event === 'payment.captured') {
    await prisma.payment.update({
      where: { id: payment.id },
      data: { status: 'CAPTURED', razorpayPaymentId: paymentEntity.id },
    });
    if (cached) {
      await orderClient.confirmOrder(payment.orderId, cached.authToken);
    } else {
      // eslint-disable-next-line no-console
      console.error(
        `no cached auth token for order ${payment.orderId} - could not confirm order, needs manual reconciliation`,
      );
    }
  } else if (payload.event === 'payment.failed') {
    await prisma.payment.update({ where: { id: payment.id }, data: { status: 'FAILED' } });
    if (cached) {
      await orderClient.cancelOrder(payment.orderId, cached.authToken);
    } else {
      // eslint-disable-next-line no-console
      console.error(
        `no cached auth token for order ${payment.orderId} - could not cancel order, needs manual reconciliation`,
      );
    }
  }

  await prisma.paymentWebhookEvent.update({
    where: { id: eventRow.id },
    data: { processedAt: new Date() },
  });
}
