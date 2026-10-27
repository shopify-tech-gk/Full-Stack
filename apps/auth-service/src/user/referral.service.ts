import { randomInt } from 'node:crypto';
import { z } from 'zod';
import { AppError } from '@youmart/errors';
import { prisma } from '../db';

// v1.17 Refer & Earn. Every customer has a code to share (created the first time they open Refer &
// Earn). A new customer can enter a friend's code once, within APPLY_WINDOW_DAYS of joining; from
// then on, each of their orders of Rs 500+ earns the friend 2.5% of what they paid for each item
// once it's delivered (order-service decides and pays that into the friend's YouMart Wallet).

/** How long after creating an account a customer can still enter a friend's code. */
const APPLY_WINDOW_DAYS = 7;
/** Letters / digits that can't be confused when read aloud or typed (no 0/O, 1/I/L). */
const CODE_CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

export const ApplyReferralBody = z.object({
  code: z
    .string()
    .trim()
    .min(4)
    .max(20)
    .transform((c) => c.toUpperCase().replace(/\s+/g, '')),
});

export interface MyReferralView {
  code: string;
  /** People who joined with this customer's code. */
  friendsJoined: number;
  /** Who referred this customer (null = nobody). */
  referredBy: { name: string | null } | null;
  /** Whether they can still enter a friend's code (new account, none entered yet). */
  canApplyCode: boolean;
  applyWindowDays: number;
}

function newCode(): string {
  let code = 'YM';
  for (let i = 0; i < 6; i++) code += CODE_CHARS[randomInt(CODE_CHARS.length)];
  return code;
}

/** This customer's code, creating it on first use (retries on the rare clash). */
async function ensureCode(userId: string): Promise<string> {
  const user = await prisma.user.findFirst({
    where: { id: userId, deletedAt: null },
    select: { referralCode: true },
  });
  if (!user) throw new AppError('NOT_FOUND', 404, 'Account not found');
  if (user.referralCode) return user.referralCode;
  for (let attempt = 0; attempt < 6; attempt++) {
    const code = newCode();
    try {
      await prisma.user.update({ where: { id: userId }, data: { referralCode: code } });
      return code;
    } catch (err) {
      if ((err as { code?: string }).code !== 'P2002') throw err; // unique clash -> try another
    }
  }
  throw new AppError('INTERNAL_ERROR', 500, 'Could not create a referral code');
}

function withinWindow(createdAt: Date): boolean {
  return Date.now() - createdAt.getTime() < APPLY_WINDOW_DAYS * 24 * 60 * 60 * 1000;
}

export async function getMyReferral(userId: string): Promise<MyReferralView> {
  const code = await ensureCode(userId);
  const [me, friendsJoined] = await Promise.all([
    prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { referredById: true, createdAt: true },
    }),
    prisma.user.count({ where: { referredById: userId, deletedAt: null } }),
  ]);
  const referrer = me.referredById
    ? await prisma.user.findFirst({ where: { id: me.referredById }, select: { name: true } })
    : null;
  return {
    code,
    friendsJoined,
    referredBy: me.referredById ? { name: referrer?.name ?? null } : null,
    canApplyCode: !me.referredById && withinWindow(me.createdAt),
    applyWindowDays: APPLY_WINDOW_DAYS,
  };
}

/** A new customer enters a friend's code (once, within the window, never their own). */
export async function applyReferralCode(
  userId: string,
  rawCode: string,
): Promise<{ referredBy: { name: string | null } }> {
  const { code } = ApplyReferralBody.parse({ code: rawCode });
  const me = await prisma.user.findFirst({
    where: { id: userId, deletedAt: null },
    select: { referredById: true, createdAt: true, referralCode: true },
  });
  if (!me) throw new AppError('NOT_FOUND', 404, 'Account not found');
  if (me.referredById) {
    throw new AppError('CONFLICT', 409, "You've already added a friend's referral code.");
  }
  if (!withinWindow(me.createdAt)) {
    throw new AppError(
      'CONFLICT',
      409,
      `Referral codes can only be added within ${APPLY_WINDOW_DAYS} days of creating your account.`,
    );
  }
  if (me.referralCode && me.referralCode === code) {
    throw new AppError('VALIDATION_ERROR', 400, "That's your own code - share it with friends!");
  }
  const referrer = await prisma.user.findFirst({
    where: { referralCode: code, deletedAt: null, status: 'ACTIVE' },
    select: { id: true, name: true },
  });
  if (!referrer) throw new AppError('NOT_FOUND', 404, "We couldn't find that referral code.");
  if (referrer.id === userId) {
    throw new AppError('VALIDATION_ERROR', 400, "That's your own code - share it with friends!");
  }
  // Only set when still empty (two quick taps can't both win).
  const set = await prisma.user.updateMany({
    where: { id: userId, referredById: null },
    data: { referredById: referrer.id, referredAt: new Date() },
  });
  if (set.count === 0) {
    throw new AppError('CONFLICT', 409, "You've already added a friend's referral code.");
  }
  return { referredBy: { name: referrer.name } };
}

/** SERVICE-ONLY: who referred this customer (order-service pays them the reward). */
export async function getReferrer(userId: string): Promise<{ referrerId: string | null }> {
  const user = await prisma.user.findFirst({
    where: { id: userId },
    select: { referredById: true },
  });
  if (!user?.referredById) return { referrerId: null };
  const referrer = await prisma.user.findFirst({
    where: { id: user.referredById, deletedAt: null, status: 'ACTIVE' },
    select: { id: true },
  });
  return { referrerId: referrer?.id ?? null };
}
