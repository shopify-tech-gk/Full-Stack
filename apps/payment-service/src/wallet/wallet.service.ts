import { v7 as uuidv7 } from 'uuid';
import { Prisma } from '@youmart/db';
import type { Money } from '@youmart/shared-types';
import { AppError } from '@youmart/errors';
import { add, compare, subtract } from '@youmart/shared-utils';
import { prisma } from '../db';
import { config } from '../config';
import { razorpay } from '../razorpayClient';
import { moneyToPaise } from '../payment/money-paise';

// W9: YouMart Wallet - closed-system store credit (payments schema). Refunds are credited here,
// customers can add money (Razorpay top-up), and the balance pays for orders on its own or with
// Razorpay. Never withdrawable as cash.
//
// Every change to a wallet's balance happens inside ONE database transaction that first locks the
// wallet row (SELECT ... FOR UPDATE), so concurrent refunds / top-ups / payments for the same
// customer are serialised, and writes a ledger row (wallet_transaction) carrying an idempotency
// key - a retried credit or debit (same key) is a no-op, never applied twice.

type Tx = Prisma.TransactionClient;

const ZERO = '0.00' as Money;
/** Razorpay's smallest order amount - the online part of a split payment is never below this. */
const MIN_ONLINE = '1.00' as Money;

function toMoney(value: Prisma.Decimal): Money {
  return value.toFixed(2) as Money;
}

function minMoney(a: Money, b: Money): Money {
  return compare(a, b) <= 0 ? a : b;
}

interface LockedWallet {
  id: string;
  balance: Money;
  held: Money;
}

/** Gets (creating on first use) and row-locks the customer's wallet for the current transaction. */
async function lockWallet(tx: Tx, userId: string): Promise<LockedWallet> {
  await tx.$executeRaw`
    INSERT INTO "payments"."wallet" ("id", "user_id", "balance", "held", "created_at", "updated_at")
    VALUES (${uuidv7()}, ${userId}, 0, 0, now(), now())
    ON CONFLICT ("user_id") WHERE "deleted_at" IS NULL DO NOTHING`;
  const rows = await tx.$queryRaw<{ id: string; balance: Prisma.Decimal; held: Prisma.Decimal }[]>`
    SELECT "id", "balance", "held" FROM "payments"."wallet"
    WHERE "user_id" = ${userId} AND "deleted_at" IS NULL
    FOR UPDATE`;
  const row = rows[0];
  if (!row) {
    throw new AppError('INTERNAL_ERROR', 500, 'Wallet could not be opened');
  }
  return { id: row.id, balance: toMoney(row.balance), held: toMoney(row.held) };
}

function runLocked<T>(fn: (tx: Tx) => Promise<T>): Promise<T> {
  return prisma.$transaction(fn, {
    isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted,
  });
}

type TxnType = 'TOPUP' | 'REFUND' | 'ORDER_PAYMENT' | 'FORFEIT' | 'REFERRAL_REWARD';

interface LedgerEntry {
  userId: string;
  type: TxnType;
  direction: 'CREDIT' | 'DEBIT';
  amount: Money;
  description: string;
  idempotencyKey: string;
  orderId?: string | null;
  orderNumber?: string | null;
  /** DEBIT only: the amount also leaves `held` (spending a hold). */
  fromHeld?: boolean;
}

/**
 * Applies one ledger entry to a LOCKED wallet: moves the balance and appends the ledger row.
 * Returns the wallet after the entry. A repeated idempotency key is a no-op.
 */
async function applyEntry(tx: Tx, wallet: LockedWallet, entry: LedgerEntry): Promise<LockedWallet> {
  const seen = await tx.walletTransaction.findFirst({
    where: { idempotencyKey: entry.idempotencyKey, deletedAt: null },
  });
  if (seen) return wallet;

  const credit = entry.direction === 'CREDIT';
  if (!credit && compare(entry.amount, wallet.balance) > 0) {
    throw new AppError('CONFLICT', 409, 'Not enough wallet balance');
  }
  const balance = credit
    ? add(wallet.balance, entry.amount)
    : subtract(wallet.balance, entry.amount);
  const held = !credit && entry.fromHeld ? subtract(wallet.held, entry.amount) : wallet.held;

  await tx.wallet.update({ where: { id: wallet.id }, data: { balance, held } });
  await tx.walletTransaction.create({
    data: {
      walletId: wallet.id,
      userId: entry.userId,
      type: entry.type,
      direction: entry.direction,
      amount: entry.amount,
      balanceAfter: balance,
      orderId: entry.orderId ?? null,
      orderNumber: entry.orderNumber ?? null,
      description: entry.description,
      idempotencyKey: entry.idempotencyKey,
    },
  });
  return { ...wallet, balance, held };
}

// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------

export interface WalletSummary {
  /** Everything in the wallet. */
  balance: Money;
  /** Reserved for orders waiting for the rest of their payment. */
  held: Money;
  /** Spendable now (balance - held). */
  available: Money;
  topupLimits: { min: Money; max: Money; maxBalance: Money };
}

export async function getWalletSummary(userId: string): Promise<WalletSummary> {
  const wallet = await prisma.wallet.findFirst({ where: { userId, deletedAt: null } });
  const balance = wallet ? toMoney(wallet.balance) : ZERO;
  const held = wallet ? toMoney(wallet.held) : ZERO;
  return {
    balance,
    held,
    available: subtract(balance, held),
    topupLimits: {
      min: config.walletTopupMin,
      max: config.walletTopupMax,
      maxBalance: config.walletMaxBalance,
    },
  };
}

export interface WalletTransactionView {
  id: string;
  type: TxnType;
  direction: 'CREDIT' | 'DEBIT';
  amount: Money;
  balanceAfter: Money;
  description: string;
  orderId: string | null;
  orderNumber: string | null;
  createdAt: string;
}

export async function listTransactions(
  userId: string,
  query: { cursor?: string; limit: number },
): Promise<{ items: WalletTransactionView[]; nextCursor: string | null }> {
  const rows = await prisma.walletTransaction.findMany({
    where: { userId, deletedAt: null },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    take: query.limit + 1,
    ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
  });
  const hasMore = rows.length > query.limit;
  const page = hasMore ? rows.slice(0, query.limit) : rows;
  return {
    items: page.map((row) => ({
      id: row.id,
      type: row.type,
      direction: row.direction,
      amount: toMoney(row.amount),
      balanceAfter: toMoney(row.balanceAfter),
      description: row.description,
      orderId: row.orderId,
      orderNumber: row.orderNumber,
      createdAt: row.createdAt.toISOString(),
    })),
    nextCursor: hasMore ? (page[page.length - 1]?.id ?? null) : null,
  };
}

// ---------------------------------------------------------------------------
// Paying for an order: hold -> capture (or release)
// ---------------------------------------------------------------------------

export interface HoldView {
  holdId: string;
  amount: Money;
  status: 'HELD' | 'CAPTURED' | 'RELEASED';
}

/** The order's live (held or spent) wallet hold, if any. */
export async function findLiveHold(orderId: string): Promise<HoldView | null> {
  const hold = await prisma.walletHold.findFirst({
    where: { orderId, deletedAt: null, status: { in: ['HELD', 'CAPTURED'] } },
  });
  return hold ? { holdId: hold.id, amount: toMoney(hold.amount), status: hold.status } : null;
}

/**
 * Reserves wallet money for an order: as much of `total` as is spendable, leaving at least
 * MIN_ONLINE for Razorpay when the wallet can't cover the whole order. Idempotent per order: an
 * existing live hold is returned as is. Null when there is nothing spendable.
 */
export async function holdForOrder(
  userId: string,
  orderId: string,
  total: Money,
): Promise<HoldView | null> {
  return runLocked(async (tx) => {
    const wallet = await lockWallet(tx, userId);
    const live = await tx.walletHold.findFirst({
      where: { orderId, deletedAt: null, status: { in: ['HELD', 'CAPTURED'] } },
    });
    if (live) return { holdId: live.id, amount: toMoney(live.amount), status: live.status };

    const available = subtract(wallet.balance, wallet.held);
    let amount = minMoney(available, total);
    const rest = subtract(total, amount);
    if (compare(rest, ZERO) > 0 && compare(rest, MIN_ONLINE) < 0) {
      amount = subtract(total, MIN_ONLINE);
    }
    if (compare(amount, ZERO) <= 0) return null;

    const hold = await tx.walletHold.create({
      data: { walletId: wallet.id, userId, orderId, amount, status: 'HELD' },
    });
    await tx.wallet.update({ where: { id: wallet.id }, data: { held: add(wallet.held, amount) } });
    return { holdId: hold.id, amount, status: 'HELD' as const };
  });
}

/** Gives a HELD hold back to the spendable balance (order cancelled/expired/paid another way). */
export async function releaseHold(orderId: string): Promise<void> {
  const hold = await prisma.walletHold.findFirst({
    where: { orderId, deletedAt: null, status: 'HELD' },
  });
  if (!hold) return;
  await runLocked(async (tx) => {
    const wallet = await lockWallet(tx, hold.userId);
    const claimed = await tx.walletHold.updateMany({
      where: { id: hold.id, status: 'HELD' },
      data: { status: 'RELEASED' },
    });
    if (claimed.count === 0) return;
    await tx.wallet.update({
      where: { id: wallet.id },
      data: { held: subtract(wallet.held, toMoney(hold.amount)) },
    });
  });
}

/** Spends the order's HELD hold (the order is being paid). Idempotent; null when no hold. */
export async function captureHold(
  orderId: string,
  orderNumber: string | null,
): Promise<HoldView | null> {
  const hold = await prisma.walletHold.findFirst({
    where: { orderId, deletedAt: null, status: { in: ['HELD', 'CAPTURED'] } },
  });
  if (!hold) return null;
  if (hold.status === 'CAPTURED') {
    return { holdId: hold.id, amount: toMoney(hold.amount), status: 'CAPTURED' };
  }
  return runLocked(async (tx) => {
    const wallet = await lockWallet(tx, hold.userId);
    const claimed = await tx.walletHold.updateMany({
      where: { id: hold.id, status: 'HELD' },
      data: { status: 'CAPTURED' },
    });
    const amount = toMoney(hold.amount);
    if (claimed.count > 0) {
      await applyEntry(tx, wallet, {
        userId: hold.userId,
        type: 'ORDER_PAYMENT',
        direction: 'DEBIT',
        amount,
        fromHeld: true,
        orderId,
        orderNumber,
        description: orderNumber ? `Paid for order ${orderNumber}` : 'Paid for an order',
        idempotencyKey: `hold:${hold.id}`,
      });
    }
    return { holdId: hold.id, amount, status: 'CAPTURED' as const };
  });
}

// ---------------------------------------------------------------------------
// Credits: refunds and top-ups
// ---------------------------------------------------------------------------

/**
 * Credits a refund to the customer's wallet inside the caller's locked transaction (see
 * payment.service.ts createRefund, which checks the refundable amount under the same lock).
 */
export async function creditRefundInTx(
  tx: Tx,
  input: {
    userId: string;
    refundId: string;
    amount: Money;
    orderId: string;
    orderNumber: string | null;
    reason?: string;
  },
): Promise<void> {
  const wallet = await lockWallet(tx, input.userId);
  await applyEntry(tx, wallet, {
    userId: input.userId,
    type: 'REFUND',
    direction: 'CREDIT',
    amount: input.amount,
    orderId: input.orderId,
    orderNumber: input.orderNumber,
    description: input.orderNumber ? `Refund for order ${input.orderNumber}` : 'Refund credited',
    idempotencyKey: `refund:${input.refundId}`,
  });
}

export { lockWallet as lockWalletInTx, runLocked as runWalletTransaction };

export interface TopupView {
  topupId: string;
  amount: Money;
  status: 'CREATED' | 'PAID' | 'FAILED';
  createdAt: string;
}

export interface CreateTopupResult extends TopupView {
  razorpayOrderId: string;
  razorpayKeyId: string;
  /** Paise, for Razorpay Checkout. */
  amountPaise: number;
  currency: string;
}

/** "Add money": a Razorpay order for the amount; the payment.captured webhook credits it. */
export async function createTopup(userId: string, amount: Money): Promise<CreateTopupResult> {
  if (compare(amount, config.walletTopupMin) < 0 || compare(amount, config.walletTopupMax) > 0) {
    throw new AppError(
      'VALIDATION_ERROR',
      400,
      `You can add between Rs ${config.walletTopupMin} and Rs ${config.walletTopupMax} at a time`,
    );
  }
  const summary = await getWalletSummary(userId);
  if (compare(add(summary.balance, amount), config.walletMaxBalance) > 0) {
    throw new AppError(
      'VALIDATION_ERROR',
      400,
      `Your wallet can hold up to Rs ${config.walletMaxBalance} (current balance Rs ${summary.balance})`,
    );
  }

  const topup = await prisma.walletTopup.create({ data: { userId, amount, status: 'CREATED' } });
  const razorpayOrder = await razorpay.orders.create({
    amount: moneyToPaise(amount),
    currency: 'INR',
    receipt: `topup_${topup.id}`.slice(0, 40),
    notes: { purpose: 'wallet_topup', topupId: topup.id },
  });
  await prisma.walletTopup.update({
    where: { id: topup.id },
    data: { razorpayOrderId: razorpayOrder.id },
  });

  return {
    topupId: topup.id,
    amount,
    status: 'CREATED',
    createdAt: topup.createdAt.toISOString(),
    razorpayOrderId: razorpayOrder.id,
    razorpayKeyId: config.razorpayKeyId,
    amountPaise: moneyToPaise(amount),
    currency: 'INR',
  };
}

export async function getTopup(userId: string, topupId: string): Promise<TopupView> {
  const topup = await prisma.walletTopup.findFirst({
    where: { id: topupId, userId, deletedAt: null },
  });
  if (!topup) {
    throw new AppError('NOT_FOUND', 404, 'Top-up not found');
  }
  return {
    topupId: topup.id,
    amount: toMoney(topup.amount),
    status: topup.status,
    createdAt: topup.createdAt.toISOString(),
  };
}

/**
 * Webhook side of a top-up (payment.captured for a top-up's Razorpay order). Returns false when
 * the Razorpay order isn't a top-up (the caller then has nothing to do). Idempotent.
 */
export async function handleTopupCaptured(
  razorpayOrderId: string,
  razorpayPaymentId: string,
  amountPaise: number,
): Promise<boolean> {
  const topup = await prisma.walletTopup.findFirst({
    where: { razorpayOrderId, deletedAt: null },
  });
  if (!topup) return false;
  if (moneyToPaise(toMoney(topup.amount)) !== amountPaise) {
    throw new AppError('VALIDATION_ERROR', 400, 'Webhook amount does not match the top-up amount');
  }
  await runLocked(async (tx) => {
    const wallet = await lockWallet(tx, topup.userId);
    await tx.walletTopup.updateMany({
      where: { id: topup.id, status: { not: 'PAID' } },
      data: { status: 'PAID', razorpayPaymentId },
    });
    await applyEntry(tx, wallet, {
      userId: topup.userId,
      type: 'TOPUP',
      direction: 'CREDIT',
      amount: toMoney(topup.amount),
      description: 'Money added to wallet',
      idempotencyKey: `topup:${topup.id}`,
    });
  });
  return true;
}

/** True when the Razorpay order belongs to a wallet top-up (not an order payment). */
export async function isTopupOrder(razorpayOrderId: string): Promise<boolean> {
  const topup = await prisma.walletTopup.findFirst({
    where: { razorpayOrderId, deletedAt: null },
    select: { id: true },
  });
  return topup !== null;
}

// ---------------------------------------------------------------------------
// Account deletion
// ---------------------------------------------------------------------------

/**
 * Account deletion (auth-service, after the customer confirmed giving up the balance): debits the
 * whole spendable balance as FORFEIT. Refuses while money is still held for a pending order.
 */
export async function forfeitWallet(userId: string): Promise<{ forfeited: Money }> {
  return runLocked(async (tx) => {
    const wallet = await lockWallet(tx, userId);
    if (compare(wallet.held, ZERO) > 0) {
      throw new AppError(
        'CONFLICT',
        409,
        'Wallet money is reserved for an order that is still awaiting payment',
      );
    }
    if (compare(wallet.balance, ZERO) <= 0) return { forfeited: ZERO };
    await applyEntry(tx, wallet, {
      userId,
      type: 'FORFEIT',
      direction: 'DEBIT',
      amount: wallet.balance,
      description: 'Balance forfeited on account deletion',
      idempotencyKey: `forfeit:${wallet.id}:${Date.now()}`,
    });
    return { forfeited: wallet.balance };
  });
}

/**
 * v1.17 Refer & Earn (order-service, SERVICE-ONLY): CREDIT pays a referral reward into the
 * referrer's wallet; DEBIT takes it back when the friend returns the item - never more than the
 * wallet's spendable balance, so it can't go negative (the rest is simply written off). Both are
 * idempotent on `idempotencyKey`.
 */
export async function referralEntry(
  userId: string,
  input: {
    direction: 'CREDIT' | 'DEBIT';
    amount: Money;
    idempotencyKey: string;
    orderId?: string | null;
    orderNumber?: string | null;
  },
): Promise<{ applied: Money }> {
  return runLocked(async (tx) => {
    const wallet = await lockWallet(tx, userId);
    let amount = input.amount;
    if (input.direction === 'DEBIT') {
      amount = minMoney(amount, subtract(wallet.balance, wallet.held));
      if (compare(amount, ZERO) <= 0) return { applied: ZERO };
    }
    await applyEntry(tx, wallet, {
      userId,
      type: 'REFERRAL_REWARD',
      direction: input.direction,
      amount,
      orderId: input.orderId ?? null,
      orderNumber: input.orderNumber ?? null,
      description:
        input.direction === 'CREDIT'
          ? 'Refer & Earn reward - a friend you referred got their order'
          : 'Refer & Earn reward reversed - the item was returned',
      idempotencyKey: input.idempotencyKey,
    });
    return { applied: amount };
  });
}
