import { randomInt } from 'node:crypto';
import { z } from 'zod';
import type { Prisma } from '@youmart/db';
import { AppError } from '@youmart/errors';
import { prisma } from '../db';
import { config } from '../config';
import { logger } from '../logger';
import { paymentClient } from '../serviceClients';

// v1.19 Advertising. Anyone signed in books an ad: an IMAGE ad (1-5 photos, shown as a carousel
// in Home's "Sponsored" slot) or a VIDEO ad (one video, played in Home's floating video window).
//   submit (PENDING_REVIEW, free) -> admin APPROVED or REJECTED -> advertiser pays from the YouMart
//   Wallet (PAID) -> shown from startsAt to endsAt, in whole 24-hour days at AD_PRICE_PER_DAY.
// One ad per kind at a time: APPROVED (not yet expired) and PAID ads of the same kind never
// overlap - checked when submitting, approving and paying, under a per-kind advisory lock.
// An APPROVED ad not paid by its start time EXPIRES (frees its slot); nothing is charged.

export const AD_KINDS = ['IMAGE', 'VIDEO'] as const;
export type AdKind = (typeof AD_KINDS)[number];
export const MAX_DAYS = 30;
export const MAX_IMAGES = 5;
const HOUR = 3_600_000;
const DAY = 24 * HOUR;

/** What the advertiser / admin sees, derived from the stored status and the clock. */
export type AdState =
  | 'IN_REVIEW'
  | 'AWAITING_PAYMENT'
  | 'EXPIRED'
  | 'SCHEDULED'
  | 'LIVE'
  | 'ENDED'
  | 'REJECTED'
  | 'CANCELLED'
  | 'REMOVED';

const text = (max: number) => z.string().trim().min(1).max(max);

export const CreateAdBody = z.object({
  kind: z.enum(AD_KINDS),
  advertiserName: text(60),
  headline: text(80),
  caption: z.string().trim().max(200).optional(),
  linkUrl: z
    .string()
    .trim()
    .max(300)
    .optional()
    .transform((v) => (v ? v : undefined))
    .pipe(z.string().url().startsWith('https://', 'Links must start with https://').optional()),
  media: z
    .array(z.string().regex(/^[a-f0-9]{32}\.(jpg|png|webp|mp4|mov)$/))
    .min(1)
    .max(MAX_IMAGES),
  startsAt: z.coerce.date(),
  days: z.coerce.number().int().min(1).max(MAX_DAYS),
});
export type CreateAdBody = z.infer<typeof CreateAdBody>;

export const AvailabilityQuery = z.object({ kind: z.enum(AD_KINDS) });

export const AdminListAdsQuery = z.object({
  state: z
    .enum([
      'IN_REVIEW',
      'AWAITING_PAYMENT',
      'SCHEDULED',
      'LIVE',
      'ENDED',
      'REJECTED',
      'CLOSED',
      'ALL',
    ])
    .default('IN_REVIEW'),
});

export const ReasonBody = z.object({ reason: z.string().trim().min(1).max(500) });

type Row = Awaited<ReturnType<typeof prisma.adCampaign.findFirstOrThrow>>;

export function mediaPath(fileName: string): string {
  return `/sellers/ads/media/${fileName}`;
}

export function adState(r: Pick<Row, 'status' | 'startsAt' | 'endsAt'>, now = Date.now()): AdState {
  switch (r.status) {
    case 'PENDING_REVIEW':
      return 'IN_REVIEW';
    case 'APPROVED':
      return r.startsAt.getTime() > now ? 'AWAITING_PAYMENT' : 'EXPIRED';
    case 'PAID':
      if (r.startsAt.getTime() > now) return 'SCHEDULED';
      return r.endsAt.getTime() > now ? 'LIVE' : 'ENDED';
    default:
      return r.status;
  }
}

const mediaOf = (r: Row): string[] => (Array.isArray(r.media) ? (r.media as string[]) : []);

function toView(r: Row) {
  return {
    adId: r.id,
    referenceCode: r.referenceCode,
    kind: r.kind,
    advertiserName: r.advertiserName,
    headline: r.headline,
    caption: r.caption,
    linkUrl: r.linkUrl,
    media: mediaOf(r).map(mediaPath),
    startsAt: r.startsAt.toISOString(),
    endsAt: r.endsAt.toISOString(),
    days: r.days,
    pricePerDay: r.pricePerDay.toFixed(2),
    amount: r.amount.toFixed(2),
    state: adState(r),
    rejectReason: r.rejectReason,
    reviewedAt: r.reviewedAt?.toISOString() ?? null,
    paidAt: r.paidAt?.toISOString() ?? null,
    createdAt: r.createdAt.toISOString(),
  };
}

/** What every shopper gets for a live ad (no money / review details). */
function toPublic(r: Row) {
  return {
    adId: r.id,
    kind: r.kind,
    advertiserName: r.advertiserName,
    headline: r.headline,
    caption: r.caption,
    linkUrl: r.linkUrl,
    media: mediaOf(r).map(mediaPath),
    endsAt: r.endsAt.toISOString(),
  };
}

/** Ads of `kind` holding a slot right now: APPROVED (not expired) or PAID and not over. */
function blockingWhere(kind: AdKind, now: Date): Prisma.AdCampaignWhereInput {
  return {
    kind,
    endsAt: { gt: now },
    OR: [{ status: 'PAID' }, { status: 'APPROVED', startsAt: { gt: now } }],
  };
}

type Tx = Prisma.TransactionClient;

async function lockKind(tx: Tx, kind: AdKind): Promise<void> {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`ads:${kind}`}))`;
}

async function assertSlotFree(
  tx: Tx,
  kind: AdKind,
  startsAt: Date,
  endsAt: Date,
  exceptId?: string,
): Promise<void> {
  const clash = await tx.adCampaign.findFirst({
    where: {
      ...blockingWhere(kind, new Date()),
      ...(exceptId ? { id: { not: exceptId } } : {}),
      startsAt: { lt: endsAt },
      endsAt: { gt: startsAt },
    },
    orderBy: { startsAt: 'asc' },
  });
  if (clash) {
    throw new AppError(
      'CONFLICT',
      409,
      'That time is already booked by another ad. Please pick another day or time.',
      {
        reason: 'SLOT_TAKEN',
        bookedFrom: clash.startsAt.toISOString(),
        bookedUntil: clash.endsAt.toISOString(),
      },
    );
  }
}

async function newReferenceCode(): Promise<string> {
  for (let i = 0; i < 8; i++) {
    const code = `YMA-${randomInt(100000, 1000000)}`;
    if (!(await prisma.adCampaign.findUnique({ where: { referenceCode: code } }))) return code;
  }
  throw new AppError('INTERNAL_ERROR', 500, 'Could not create a reference code');
}

async function findOwn(userId: string, adId: string): Promise<Row> {
  const row = await prisma.adCampaign.findFirst({ where: { id: adId, userId } });
  if (!row) throw new AppError('NOT_FOUND', 404, 'Ad not found');
  return row;
}

// --- Advertiser -------------------------------------------------------------------------------

export async function availability(kind: AdKind) {
  const now = new Date();
  const rows = await prisma.adCampaign.findMany({
    where: blockingWhere(kind, now),
    orderBy: { startsAt: 'asc' },
    select: { startsAt: true, endsAt: true },
  });
  return {
    kind,
    pricePerDay: config.adPricePerDay,
    maxDays: MAX_DAYS,
    booked: rows.map((r) => ({
      startsAt: r.startsAt.toISOString(),
      endsAt: r.endsAt.toISOString(),
    })),
  };
}

export async function createAd(userId: string, body: CreateAdBody) {
  // Media: the advertiser's own uploads, and the right kind and count.
  const files = await prisma.adMedia.findMany({
    where: { userId, fileName: { in: body.media } },
  });
  if (files.length !== new Set(body.media).size || files.length !== body.media.length) {
    throw new AppError(
      'VALIDATION_ERROR',
      400,
      'Some of the files were not found. Please upload them again.',
    );
  }
  const videos = files.filter((f) => f.mimeType.startsWith('video/'));
  if (body.kind === 'VIDEO' && (body.media.length !== 1 || videos.length !== 1)) {
    throw new AppError('VALIDATION_ERROR', 400, 'A video ad needs exactly one video.');
  }
  if (body.kind === 'IMAGE' && videos.length > 0) {
    throw new AppError('VALIDATION_ERROR', 400, 'An image ad can only have photos (up to 5).');
  }

  // Time: starts on the hour, at least an hour from now (time for review), whole days.
  const startsAt = new Date(Math.ceil(body.startsAt.getTime() / HOUR) * HOUR);
  if (startsAt.getTime() < Date.now() + HOUR) {
    throw new AppError('VALIDATION_ERROR', 400, 'Pick a start time at least an hour from now.');
  }
  const endsAt = new Date(startsAt.getTime() + body.days * DAY);
  const amount = (Number(config.adPricePerDay) * body.days).toFixed(2);
  const referenceCode = await newReferenceCode();

  const row = await prisma.$transaction(async (tx) => {
    await lockKind(tx, body.kind);
    await assertSlotFree(tx, body.kind, startsAt, endsAt);
    return tx.adCampaign.create({
      data: {
        referenceCode,
        userId,
        kind: body.kind,
        advertiserName: body.advertiserName,
        headline: body.headline,
        caption: body.caption ? body.caption : null,
        linkUrl: body.linkUrl ?? null,
        media: body.media,
        startsAt,
        endsAt,
        days: body.days,
        pricePerDay: config.adPricePerDay,
        amount,
      },
    });
  });
  return { ad: toView(row) };
}

export async function listMyAds(userId: string) {
  const rows = await prisma.adCampaign.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    take: 50,
  });
  return { items: rows.map(toView) };
}

export async function cancelAd(userId: string, adId: string) {
  const row = await findOwn(userId, adId);
  const state = adState(row);
  if (state !== 'IN_REVIEW' && state !== 'AWAITING_PAYMENT') {
    throw new AppError('CONFLICT', 409, 'This ad can no longer be cancelled.');
  }
  const updated = await prisma.adCampaign.update({
    where: { id: row.id },
    data: { status: 'CANCELLED', cancelledAt: new Date() },
  });
  return { ad: toView(updated) };
}

export async function payForAd(userId: string, adId: string) {
  const row = await findOwn(userId, adId);
  const state = adState(row);
  if (state === 'SCHEDULED' || state === 'LIVE') return { ad: toView(row) };
  if (state === 'EXPIRED') {
    throw new AppError('CONFLICT', 409, 'The start time has passed. Please book the ad again.');
  }
  if (state !== 'AWAITING_PAYMENT') {
    throw new AppError('CONFLICT', 409, 'This ad is not waiting for payment.');
  }
  // Its own approval already holds the slot; re-checked in case of drift.
  await prisma.$transaction(async (tx) => {
    await lockKind(tx, row.kind);
    await assertSlotFree(tx, row.kind, row.startsAt, row.endsAt, row.id);
  });
  // Idempotent per ad: a retry after a network blip never charges twice.
  await paymentClient.adPayment(userId, {
    amount: row.amount.toFixed(2),
    idempotencyKey: `ad:${row.id}`,
    description: `Advertisement ${row.referenceCode} - ${row.days} ${row.days === 1 ? 'day' : 'days'}`,
  });
  const updated = await prisma.adCampaign.update({
    where: { id: row.id },
    data: { status: 'PAID', paidAt: new Date() },
  });
  logger.info({ adId: row.id, amount: row.amount.toFixed(2) }, 'ad paid');
  return { ad: toView(updated) };
}

// --- Shoppers -----------------------------------------------------------------------------------

/** The ads showing right now: at most one of each kind (slots never overlap). */
export async function liveAds() {
  const now = new Date();
  const rows = await prisma.adCampaign.findMany({
    where: { status: 'PAID', startsAt: { lte: now }, endsAt: { gt: now } },
    orderBy: { startsAt: 'asc' },
  });
  const pick = (kind: AdKind) => {
    const r = rows.find((x) => x.kind === kind);
    return r ? toPublic(r) : null;
  };
  return { image: pick('IMAGE'), video: pick('VIDEO') };
}

// --- Admin ----------------------------------------------------------------------------------------

export async function adminListAds(query: z.infer<typeof AdminListAdsQuery>) {
  const rows = await prisma.adCampaign.findMany({
    orderBy: { createdAt: 'desc' },
    take: 300,
  });
  const views = rows.map((r) => ({ ...toView(r), userId: r.userId }));
  const counts: Record<string, number> = {};
  for (const v of views) counts[v.state] = (counts[v.state] ?? 0) + 1;
  const closed = new Set<AdState>(['EXPIRED', 'CANCELLED', 'REMOVED']);
  const items =
    query.state === 'ALL'
      ? views
      : query.state === 'CLOSED'
        ? views.filter((v) => closed.has(v.state))
        : views.filter((v) => v.state === query.state);
  // In review: the soonest start first (most urgent).
  if (query.state === 'IN_REVIEW' || query.state === 'SCHEDULED') {
    items.sort((a, b) => a.startsAt.localeCompare(b.startsAt));
  }
  return {
    items,
    counts: {
      IN_REVIEW: counts.IN_REVIEW ?? 0,
      AWAITING_PAYMENT: counts.AWAITING_PAYMENT ?? 0,
      SCHEDULED: counts.SCHEDULED ?? 0,
      LIVE: counts.LIVE ?? 0,
      ENDED: counts.ENDED ?? 0,
      REJECTED: counts.REJECTED ?? 0,
      CLOSED: (counts.EXPIRED ?? 0) + (counts.CANCELLED ?? 0) + (counts.REMOVED ?? 0),
    },
  };
}

async function findAny(adId: string): Promise<Row> {
  const row = await prisma.adCampaign.findUnique({ where: { id: adId } });
  if (!row) throw new AppError('NOT_FOUND', 404, 'Ad not found');
  return row;
}

export async function approveAd(adId: string) {
  const row = await findAny(adId);
  if (row.status !== 'PENDING_REVIEW') {
    throw new AppError('CONFLICT', 409, 'Only ads in review can be approved.');
  }
  if (row.startsAt.getTime() <= Date.now()) {
    throw new AppError(
      'CONFLICT',
      409,
      'Its start time has already passed - reject it so the advertiser can book again.',
    );
  }
  const updated = await prisma.$transaction(async (tx) => {
    await lockKind(tx, row.kind);
    await assertSlotFree(tx, row.kind, row.startsAt, row.endsAt, row.id);
    return tx.adCampaign.update({
      where: { id: row.id },
      data: { status: 'APPROVED', reviewedAt: new Date(), rejectReason: null },
    });
  });
  return { ad: toView(updated) };
}

export async function rejectAd(adId: string, reason: string) {
  const row = await findAny(adId);
  if (row.status !== 'PENDING_REVIEW' && row.status !== 'APPROVED') {
    throw new AppError('CONFLICT', 409, 'Only ads in review or awaiting payment can be rejected.');
  }
  const updated = await prisma.adCampaign.update({
    where: { id: row.id },
    data: { status: 'REJECTED', rejectReason: reason, reviewedAt: new Date() },
  });
  return { ad: toView(updated) };
}

/** Take a paid ad down (no automatic refund - handled by the team if needed). */
export async function removeAd(adId: string, reason: string) {
  const row = await findAny(adId);
  if (row.status !== 'PAID')
    throw new AppError('CONFLICT', 409, 'Only paid ads can be taken down.');
  const updated = await prisma.adCampaign.update({
    where: { id: row.id },
    data: { status: 'REMOVED', rejectReason: reason },
  });
  return { ad: toView(updated) };
}
