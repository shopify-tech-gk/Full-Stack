import { notifyInbox } from '@youmart/notifications-client';
import type { Money } from '@youmart/shared-types';
import { prisma } from '../db';
import { authClient, paymentClient } from '../serviceClients';
import { decimalToMoney } from './order.service';

// v1.17 Refer & Earn. When an item of a referred customer's order is DELIVERED and that order's
// items total after coupons (delivery charge not counted) is at least MIN_ORDER_PAISE, the person
// who referred them earns REWARD_PERCENT of what was paid for that item, straight into their YouMart
// Wallet (+ an Alert). If the item is later RETURNED, that reward is taken back. One reward row
// per order line (unique), and every wallet entry carries an idempotency key - retries never pay
// twice. Everything here is best-effort: a failure never blocks the delivery / return update.

const MIN_ORDER_PAISE = 500_00;
const REWARD_PERCENT = 2.5;

const toPaise = (m: string): number => Math.round(Number(m) * 100);
const fromPaise = (p: number): Money => (p / 100).toFixed(2) as Money;

/** An order line was just delivered: pay the referrer if this order qualifies. */
export async function rewardReferrerForDelivery(orderItemId: string): Promise<void> {
  const item = await prisma.orderItem.findFirst({
    where: { id: orderItemId, deletedAt: null },
    include: { order: { include: { items: { where: { deletedAt: null } } } } },
  });
  if (!item || item.sellerStatus !== 'DELIVERED') return;
  const order = item.order;

  const { referrerId } = await authClient.getReferrer(order.userId);
  if (!referrerId || referrerId === order.userId) return;

  // The order's items total after coupons (cancelled lines don't count; no delivery charge).
  const orderPaise = order.items
    .filter((line) => line.sellerStatus !== 'CANCELLED')
    .reduce(
      (sum, line) =>
        sum + toPaise(decimalToMoney(line.lineTotal)) - toPaise(decimalToMoney(line.discount)),
      0,
    );
  if (orderPaise < MIN_ORDER_PAISE) return;

  const paidPaise =
    toPaise(decimalToMoney(item.lineTotal)) - toPaise(decimalToMoney(item.discount));
  const rewardPaise = Math.round((paidPaise * REWARD_PERCENT) / 100);
  if (rewardPaise <= 0) return;
  const amount = fromPaise(rewardPaise);

  // Claim this line first (unique order_item_id): a retried delivery update stops here.
  const existing = await prisma.referralReward.findUnique({ where: { orderItemId } });
  if (!existing) {
    try {
      await prisma.referralReward.create({
        data: {
          referrerId,
          buyerId: order.userId,
          orderId: order.id,
          orderItemId,
          amount,
        },
      });
    } catch (err) {
      if ((err as { code?: string }).code !== 'P2002') throw err;
    }
  } else if (existing.status !== 'CREDITED') {
    return;
  }

  // Idempotent on the key, so a retry after a failed call pays exactly once.
  await paymentClient.referralEntry(referrerId, {
    direction: 'CREDIT',
    amount,
    idempotencyKey: `referral:${orderItemId}`,
  });
  if (!existing) {
    await notifyInbox(referrerId, 'REFERRAL_REWARD', { amount });
  }
}

/** An order line was returned: take back its referral reward (if one was paid). */
export async function reverseReferralReward(orderItemId: string): Promise<void> {
  const reward = await prisma.referralReward.findUnique({ where: { orderItemId } });
  if (!reward || reward.status !== 'CREDITED') return;
  await paymentClient.referralEntry(reward.referrerId, {
    direction: 'DEBIT',
    amount: decimalToMoney(reward.amount),
    idempotencyKey: `referral-reversal:${orderItemId}`,
  });
  await prisma.referralReward.update({
    where: { id: reward.id },
    data: { status: 'REVERSED' },
  });
}

export interface MyReferralRewards {
  /** Everything earned, minus rewards taken back after returns. */
  totalEarned: Money;
  rewards: Array<{
    rewardId: string;
    amount: Money;
    status: 'CREDITED' | 'REVERSED';
    createdAt: string;
  }>;
}

/** The referrer's own reward history (no details of the friend's order - just amounts). */
export async function listMyReferralRewards(userId: string): Promise<MyReferralRewards> {
  const rows = await prisma.referralReward.findMany({
    where: { referrerId: userId },
    orderBy: { createdAt: 'desc' },
    take: 100,
  });
  const earnedPaise = rows
    .filter((r) => r.status === 'CREDITED')
    .reduce((sum, r) => sum + toPaise(decimalToMoney(r.amount)), 0);
  return {
    totalEarned: fromPaise(earnedPaise),
    rewards: rows.map((r) => ({
      rewardId: r.id,
      amount: decimalToMoney(r.amount),
      status: r.status,
      createdAt: r.createdAt.toISOString(),
    })),
  };
}
