import { z } from 'zod';
import { Prisma } from '@youmart/db';
import { AppError } from '@youmart/errors';
import type { Money } from '@youmart/shared-types';
import { promotionsDb } from '../db';

// v1.13 coupons. A coupon takes money off the ORDER (YouMart-funded - seller payouts stay on the
// full line prices). Rules: % off (optionally capped) or flat ₹ off; optional minimum order, start
// / end, total usage limit and per-customer limit (default once). Placing an order RESERVES a use
// (counted against the limits at once, under a row lock, so two customers can't both take the last
// one); it becomes USED when the order is confirmed, and is RELEASED (back to the pool) if the
// order is cancelled or expires. The coupon rows live in the promotions schema (promotions_svc).

type CouponRow = Prisma.CouponGetPayload<object>;

const toPaise = (v: Prisma.Decimal | string | number) => Math.round(Number(v) * 100);
const fromPaise = (p: number) => (p / 100).toFixed(2) as Money;
const rupees = (v: Prisma.Decimal | string | number) =>
  `₹${Number(v).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;

export const CouponCode = z
  .string()
  .trim()
  .min(3)
  .max(32)
  .regex(/^[A-Za-z0-9_-]+$/, 'Coupon codes use letters and numbers only')
  .transform((v) => v.toUpperCase());

export interface CouponView {
  code: string;
  title: string;
  description: string | null;
  discountType: 'PERCENT' | 'FLAT';
  discountValue: Money;
  maxDiscount: Money | null;
  minOrderValue: Money | null;
  endsAt: string | null;
}

/** A short headline when the admin didn't write one: "10% off up to ₹500" / "₹200 off". */
function headline(c: CouponRow): string {
  if (c.title) return c.title;
  if (c.discountType === 'PERCENT') {
    const pct = `${Number(c.discountValue)}% off`;
    return c.maxDiscount ? `${pct} up to ${rupees(c.maxDiscount)}` : pct;
  }
  return `${rupees(c.discountValue)} off`;
}

export function toCouponView(c: CouponRow): CouponView {
  return {
    code: c.code,
    title: headline(c),
    description:
      c.description ?? (c.minOrderValue ? `On orders of ${rupees(c.minOrderValue)} or more` : null),
    discountType: c.discountType,
    discountValue: Number(c.discountValue).toFixed(2) as Money,
    maxDiscount: c.maxDiscount ? (Number(c.maxDiscount).toFixed(2) as Money) : null,
    minOrderValue: c.minOrderValue ? (Number(c.minOrderValue).toFixed(2) as Money) : null,
    endsAt: c.endsAt ? c.endsAt.toISOString() : null,
  };
}

/** The discount a coupon gives on a subtotal, in paise (never more than the subtotal). */
export function discountPaise(c: CouponRow, subtotalPaise: number): number {
  const raw =
    c.discountType === 'PERCENT'
      ? Math.floor((subtotalPaise * Number(c.discountValue)) / 100)
      : toPaise(c.discountValue);
  const capped = c.maxDiscount ? Math.min(raw, toPaise(c.maxDiscount)) : raw;
  return Math.max(0, Math.min(capped, subtotalPaise));
}

async function findLive(code: string): Promise<CouponRow | null> {
  return promotionsDb.coupon.findFirst({ where: { code, deletedAt: null } });
}

/** Why `c` can't be used now for this subtotal (null = it can). Friendly, shopper-facing text. */
function blocker(c: CouponRow, subtotalPaise: number, now = new Date()): string | null {
  if (!c.isActive) return 'This coupon is no longer active';
  if (c.startsAt && c.startsAt > now) return 'This coupon is not active yet';
  if (c.endsAt && c.endsAt <= now) return 'This coupon has expired';
  if (c.usageLimit !== null && c.usedCount >= c.usageLimit) {
    return 'This coupon has been fully redeemed';
  }
  if (c.minOrderValue && subtotalPaise < toPaise(c.minOrderValue)) {
    const short = toPaise(c.minOrderValue) - subtotalPaise;
    return `Add ${rupees(fromPaise(short))} more to use this coupon (minimum order ${rupees(c.minOrderValue)})`;
  }
  return null;
}

async function usesBy(couponId: string, userId: string, client = promotionsDb): Promise<number> {
  return client.couponRedemption.count({
    where: { couponId, userId, status: { not: 'RELEASED' } },
  });
}

export interface CouponQuote {
  coupon: CouponView;
  discount: Money;
  /** The order total after the discount (shipping is free today). */
  total: Money;
}

/** Validates `code` for this customer and subtotal; throws a 400/409 with a shopper-facing reason. */
export async function quoteCoupon(
  userId: string,
  rawCode: string,
  subtotal: Money,
): Promise<CouponQuote> {
  const parsed = CouponCode.safeParse(rawCode);
  const c = parsed.success ? await findLive(parsed.data) : null;
  if (!c) throw new AppError('VALIDATION_ERROR', 400, "This coupon code isn't valid");
  const subtotalPaise = toPaise(subtotal);
  const reason = blocker(c, subtotalPaise);
  if (reason) throw new AppError('VALIDATION_ERROR', 400, reason);
  if (c.perUserLimit !== null && (await usesBy(c.id, userId)) >= c.perUserLimit) {
    throw new AppError('CONFLICT', 409, "You've already used this coupon");
  }
  const off = discountPaise(c, subtotalPaise);
  return {
    coupon: toCouponView(c),
    discount: fromPaise(off),
    total: fromPaise(subtotalPaise - off),
  };
}

export interface AvailableCoupon extends CouponView {
  /** Usable on this subtotal right now. */
  applicable: boolean;
  /** Why not (when not applicable), e.g. "Add ₹300 more...". */
  reason: string | null;
  /** The discount it would give on this subtotal (0.00 when not applicable). */
  discount: Money;
}

/** Public coupons currently running, best first, with whether each fits this cart. */
export async function listAvailableCoupons(
  userId: string | null,
  subtotal: Money | null,
): Promise<AvailableCoupon[]> {
  const now = new Date();
  const rows = await promotionsDb.coupon.findMany({
    where: {
      deletedAt: null,
      isActive: true,
      isPublic: true,
      OR: [{ startsAt: null }, { startsAt: { lte: now } }],
      AND: [{ OR: [{ endsAt: null }, { endsAt: { gt: now } }] }],
    },
    orderBy: { createdAt: 'desc' },
    take: 50,
  });
  const used = userId
    ? await promotionsDb.couponRedemption.groupBy({
        by: ['couponId'],
        where: { userId, status: { not: 'RELEASED' }, couponId: { in: rows.map((r) => r.id) } },
        _count: { _all: true },
      })
    : [];
  const usedBy = new Map(used.map((u) => [u.couponId, u._count._all]));
  const subtotalPaise = subtotal ? toPaise(subtotal) : null;

  return rows
    .filter((c) => c.usageLimit === null || c.usedCount < c.usageLimit)
    .filter((c) => c.perUserLimit === null || (usedBy.get(c.id) ?? 0) < c.perUserLimit)
    .map((c) => {
      const reason = subtotalPaise === null ? null : blocker(c, subtotalPaise, now);
      const off = subtotalPaise !== null && !reason ? discountPaise(c, subtotalPaise) : 0;
      return {
        ...toCouponView(c),
        applicable: subtotalPaise !== null && !reason,
        reason,
        discount: fromPaise(off),
      };
    })
    .sort(
      (a, b) =>
        Number(b.applicable) - Number(a.applicable) || Number(b.discount) - Number(a.discount),
    );
}

export interface CouponReservation {
  redemptionId: string;
  code: string;
  discount: Money;
}

/**
 * Checkout: re-validates and RESERVES one use, atomically - the coupon row is locked, the limits
 * re-checked against live counts, used_count incremented and a RESERVED redemption written in one
 * transaction. The caller links the order afterwards (attachOrder) or gives the use back (release).
 */
export async function reserveCoupon(
  userId: string,
  rawCode: string,
  subtotal: Money,
): Promise<CouponReservation> {
  const parsed = CouponCode.safeParse(rawCode);
  if (!parsed.success) throw new AppError('VALIDATION_ERROR', 400, "This coupon code isn't valid");
  const code = parsed.data;
  return promotionsDb.$transaction(async (tx) => {
    const locked = await tx.$queryRaw<{ id: string }[]>`
      SELECT id FROM "promotions"."coupon" WHERE code = ${code} AND deleted_at IS NULL FOR UPDATE`;
    const id = locked[0]?.id;
    const c = id ? await tx.coupon.findUnique({ where: { id } }) : null;
    if (!c) throw new AppError('VALIDATION_ERROR', 400, "This coupon code isn't valid");
    const subtotalPaise = toPaise(subtotal);
    const reason = blocker(c, subtotalPaise);
    if (reason) throw new AppError('VALIDATION_ERROR', 400, reason);
    if (c.perUserLimit !== null && (await usesBy(c.id, userId, tx as never)) >= c.perUserLimit) {
      throw new AppError('CONFLICT', 409, "You've already used this coupon");
    }
    const off = discountPaise(c, subtotalPaise);
    await tx.coupon.update({ where: { id: c.id }, data: { usedCount: { increment: 1 } } });
    const redemption = await tx.couponRedemption.create({
      data: { couponId: c.id, userId, discount: fromPaise(off), status: 'RESERVED' },
    });
    return { redemptionId: redemption.id, code: c.code, discount: fromPaise(off) };
  });
}

export async function attachOrder(redemptionId: string, orderId: string): Promise<void> {
  await promotionsDb.couponRedemption.update({ where: { id: redemptionId }, data: { orderId } });
}

/** The order was confirmed (paid / Cash on Delivery): the reserved use is now spent. */
export async function markCouponUsed(orderId: string): Promise<void> {
  await promotionsDb.couponRedemption.updateMany({
    where: { orderId, status: 'RESERVED' },
    data: { status: 'USED' },
  });
}

/**
 * Gives a use back (order cancelled / expired / failed to place). Idempotent: only a redemption
 * that is still RESERVED/USED is released, and the coupon's used_count drops by exactly that many.
 */
export async function releaseRedemption(
  where: { id: string } | { orderId: string },
): Promise<void> {
  await promotionsDb.$transaction(async (tx) => {
    const live = await tx.couponRedemption.findMany({
      where: { ...where, status: { not: 'RELEASED' } },
    });
    for (const r of live) {
      const flipped = await tx.couponRedemption.updateMany({
        where: { id: r.id, status: { not: 'RELEASED' } },
        data: { status: 'RELEASED' },
      });
      if (flipped.count === 1) {
        await tx.coupon.updateMany({
          where: { id: r.couponId, usedCount: { gt: 0 } },
          data: { usedCount: { decrement: 1 } },
        });
      }
    }
  });
}

/** Best-effort wrapper for order flows: a coupon problem never blocks a cancellation. */
export async function releaseCouponForOrder(orderId: string): Promise<void> {
  try {
    await releaseRedemption({ orderId });
  } catch (err: unknown) {
    // eslint-disable-next-line no-console
    console.error('failed to release coupon for order', orderId, err);
  }
}

/**
 * Spreads an order discount over its lines in proportion to their totals (paise, the rounding
 * remainder on the largest line), so every line knows what was actually paid for it - invoices tax
 * the paid amount and a returned line refunds its paid share.
 */
export function allocateDiscount(lineTotals: Money[], discount: Money): Money[] {
  const lines = lineTotals.map(toPaise);
  const total = lines.reduce((a, b) => a + b, 0);
  const off = Math.min(toPaise(discount), total);
  if (off === 0 || total === 0) return lines.map(() => '0.00' as Money);
  const shares = lines.map((p) => Math.floor((p * off) / total));
  let rest = off - shares.reduce((a, b) => a + b, 0);
  const order = lines.map((p, i) => [p, i] as const).sort((a, b) => b[0] - a[0]);
  for (const [, i] of order) {
    if (rest === 0) break;
    const room = lines[i]! - shares[i]!;
    const add = Math.min(room, rest);
    shares[i]! += add;
    rest -= add;
  }
  return shares.map(fromPaise);
}

// --- Admin (promotions.manage) ---

export const CouponInput = z
  .object({
    code: CouponCode,
    discountType: z.enum(['PERCENT', 'FLAT']),
    discountValue: z.coerce.number().positive(),
    maxDiscount: z.coerce.number().positive().nullable().optional(),
    minOrderValue: z.coerce.number().positive().nullable().optional(),
    usageLimit: z.coerce.number().int().positive().nullable().optional(),
    perUserLimit: z.coerce.number().int().positive().nullable().optional(),
    startsAt: z.coerce.date().nullable().optional(),
    endsAt: z.coerce.date().nullable().optional(),
    isActive: z.boolean().optional(),
    isPublic: z.boolean().optional(),
    title: z.string().trim().max(80).nullable().optional(),
    description: z.string().trim().max(300).nullable().optional(),
  })
  .refine((c) => c.discountType !== 'PERCENT' || c.discountValue <= 100, {
    message: 'A percentage discount can be at most 100',
    path: ['discountValue'],
  })
  .refine((c) => !c.startsAt || !c.endsAt || c.startsAt < c.endsAt, {
    message: 'The end date must be after the start date',
    path: ['endsAt'],
  });
export const CouponPatch = z.object({
  isActive: z.boolean().optional(),
  isPublic: z.boolean().optional(),
  endsAt: z.coerce.date().nullable().optional(),
  usageLimit: z.coerce.number().int().positive().nullable().optional(),
  title: z.string().trim().max(80).nullable().optional(),
  description: z.string().trim().max(300).nullable().optional(),
});

export interface AdminCouponView extends CouponView {
  id: string;
  isActive: boolean;
  isPublic: boolean;
  usageLimit: number | null;
  usedCount: number;
  perUserLimit: number | null;
  startsAt: string | null;
  createdAt: string;
}

function toAdminView(c: CouponRow): AdminCouponView {
  return {
    ...toCouponView(c),
    id: c.id,
    isActive: c.isActive,
    isPublic: c.isPublic,
    usageLimit: c.usageLimit,
    usedCount: c.usedCount,
    perUserLimit: c.perUserLimit,
    startsAt: c.startsAt ? c.startsAt.toISOString() : null,
    createdAt: c.createdAt.toISOString(),
  };
}

export async function adminCreateCoupon(
  input: z.infer<typeof CouponInput>,
): Promise<AdminCouponView> {
  if (await findLive(input.code)) {
    throw new AppError('CONFLICT', 409, `A coupon with code ${input.code} already exists`);
  }
  const row = await promotionsDb.coupon.create({
    data: {
      code: input.code,
      discountType: input.discountType,
      discountValue: input.discountValue.toFixed(2),
      maxDiscount: input.maxDiscount != null ? input.maxDiscount.toFixed(2) : null,
      minOrderValue: input.minOrderValue != null ? input.minOrderValue.toFixed(2) : null,
      usageLimit: input.usageLimit ?? null,
      perUserLimit: input.perUserLimit === undefined ? 1 : input.perUserLimit,
      startsAt: input.startsAt ?? null,
      endsAt: input.endsAt ?? null,
      isActive: input.isActive ?? true,
      isPublic: input.isPublic ?? true,
      title: input.title ?? null,
      description: input.description ?? null,
    },
  });
  return toAdminView(row);
}

export async function adminUpdateCoupon(
  code: string,
  patch: z.infer<typeof CouponPatch>,
): Promise<AdminCouponView> {
  const c = await findLive(CouponCode.parse(code));
  if (!c) throw new AppError('NOT_FOUND', 404, 'Coupon not found');
  if (patch.usageLimit != null && patch.usageLimit < c.usedCount) {
    throw new AppError(
      'VALIDATION_ERROR',
      400,
      `The usage limit can't be below the ${c.usedCount} uses already made`,
    );
  }
  const row = await promotionsDb.coupon.update({
    where: { id: c.id },
    data: {
      ...(patch.isActive !== undefined ? { isActive: patch.isActive } : {}),
      ...(patch.isPublic !== undefined ? { isPublic: patch.isPublic } : {}),
      ...(patch.endsAt !== undefined ? { endsAt: patch.endsAt } : {}),
      ...(patch.usageLimit !== undefined ? { usageLimit: patch.usageLimit } : {}),
      ...(patch.title !== undefined ? { title: patch.title } : {}),
      ...(patch.description !== undefined ? { description: patch.description } : {}),
    },
  });
  return toAdminView(row);
}

export async function adminListCoupons(): Promise<{ items: AdminCouponView[] }> {
  const rows = await promotionsDb.coupon.findMany({
    where: { deletedAt: null },
    orderBy: { createdAt: 'desc' },
    take: 200,
  });
  return { items: rows.map(toAdminView) };
}
