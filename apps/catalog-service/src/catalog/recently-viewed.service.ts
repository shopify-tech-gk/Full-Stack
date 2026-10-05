import { v7 as uuidv7 } from 'uuid';
import { z } from 'zod';
import { prisma } from '../db';
import type { ListingItem } from './browse.service';
import { listingItemsByIds } from './catalog.service';

// View tracking: each customer's recently viewed products (catalog.recently_viewed, catalog_svc).
// Per-user behaviour data, so it is CAPPED: one row per (user, product) - a re-view moves it to
// the top - and only the newest RECENTLY_VIEWED_MAX rows per user are kept; older rows are
// hard-deleted on every write, never retained. Only the owner (customer token) reads or writes.

/** Per-user history cap (the guest list in shared-client mirrors it). */
export const RECENTLY_VIEWED_MAX = 50;

export const RecordViewBody = z.object({ productId: z.string().uuid() });

/** Guest history merged on login: up to the cap, each with when it was viewed. */
export const MergeViewsBody = z.object({
  items: z
    .array(z.object({ productId: z.string().uuid(), viewedAt: z.iso.datetime() }))
    .max(RECENTLY_VIEWED_MAX),
});
export type MergeViewsBody = z.infer<typeof MergeViewsBody>;

export const RecentlyViewedQuery = z.object({
  limit: z.coerce.number().int().min(1).max(RECENTLY_VIEWED_MAX).default(RECENTLY_VIEWED_MAX),
});

/** `?ids=<uuid>,<uuid>` - a guest's locally kept history, resolved to fresh cards. */
export const ProductCardsQuery = z.object({
  ids: z
    .string()
    .transform((value) => [...new Set(value.split(',').filter(Boolean))])
    .pipe(z.array(z.string().uuid()).min(1).max(RECENTLY_VIEWED_MAX)),
});

export interface RecentlyViewedItem extends ListingItem {
  viewedAt: string;
}

interface View {
  productId: string;
  viewedAt: Date;
}

/**
 * Upserts each (user, product) to its latest view time - against the partial unique index, so a
 * re-view never duplicates - then trims the user to the newest RECENTLY_VIEWED_MAX, in one
 * transaction. Ids that aren't live products are ignored.
 */
async function saveViews(userId: string, views: readonly View[]): Promise<void> {
  // One row per product (ON CONFLICT can't touch a row twice in one statement); latest view wins.
  const latest = new Map<string, Date>();
  for (const { productId, viewedAt } of views) {
    const seen = latest.get(productId);
    if (!seen || viewedAt > seen) latest.set(productId, viewedAt);
  }
  if (latest.size === 0) return;

  const productIds = [...latest.keys()];
  const ids = productIds.map(() => uuidv7());
  // Columns are UTC `timestamp(3)` (Prisma's convention); ISO strings cast without a zone shift.
  const viewedAts = productIds.map((id) => latest.get(id)!.toISOString());
  const now = new Date().toISOString();

  await prisma.$transaction([
    prisma.$executeRaw`
      INSERT INTO "catalog"."recently_viewed"
        ("id", "user_id", "product_id", "viewed_at", "created_at", "updated_at")
      SELECT v.id, ${userId}, v.product_id, v.viewed_at, ${now}::timestamp(3), ${now}::timestamp(3)
      FROM unnest(${ids}::text[], ${productIds}::text[], ${viewedAts}::timestamp(3)[])
        AS v(id, product_id, viewed_at)
      JOIN "catalog"."product" p
        ON p."id" = v.product_id AND p."status" = 'ACTIVE' AND p."deleted_at" IS NULL
      ON CONFLICT ("user_id", "product_id") WHERE "deleted_at" IS NULL
      DO UPDATE SET
        "viewed_at" = GREATEST("recently_viewed"."viewed_at", EXCLUDED."viewed_at"),
        "updated_at" = EXCLUDED."updated_at"`,
    prisma.$executeRaw`
      DELETE FROM "catalog"."recently_viewed"
      WHERE "id" IN (
        SELECT "id" FROM "catalog"."recently_viewed"
        WHERE "user_id" = ${userId} AND "deleted_at" IS NULL
        ORDER BY "viewed_at" DESC, "id" DESC
        OFFSET ${RECENTLY_VIEWED_MAX}
      )`,
  ]);
}

/** POST /catalog/recently-viewed - one product page view, now. */
export function recordView(userId: string, productId: string): Promise<void> {
  return saveViews(userId, [{ productId, viewedAt: new Date() }]);
}

/** GET /catalog/recently-viewed - the caller's history as listing cards, newest first. */
export async function listRecentlyViewed(
  userId: string,
  limit: number,
): Promise<RecentlyViewedItem[]> {
  const rows = await prisma.recentlyViewed.findMany({
    where: { userId, deletedAt: null },
    orderBy: [{ viewedAt: 'desc' }, { id: 'desc' }],
    take: limit,
    select: { productId: true, viewedAt: true },
  });
  const cards = await listingItemsByIds(rows.map((row) => row.productId));
  // A product archived since it was viewed simply drops out of the list.
  return rows.flatMap((row) => {
    const card = cards.get(row.productId);
    return card ? [{ ...card, viewedAt: row.viewedAt.toISOString() }] : [];
  });
}

/**
 * POST /catalog/recently-viewed/merge - a guest's local history folded in on login (keeping each
 * product's latest view time, future times clamped to now); returns the merged list.
 */
export async function mergeRecentlyViewed(
  userId: string,
  body: MergeViewsBody,
): Promise<RecentlyViewedItem[]> {
  const now = Date.now();
  await saveViews(
    userId,
    body.items.map((item) => ({
      productId: item.productId,
      viewedAt: new Date(Math.min(Date.parse(item.viewedAt), now)),
    })),
  );
  return listRecentlyViewed(userId, RECENTLY_VIEWED_MAX);
}

/** DELETE /catalog/recently-viewed - the customer clears their history (rows are deleted). */
export async function clearRecentlyViewed(userId: string): Promise<void> {
  await prisma.recentlyViewed.deleteMany({ where: { userId } });
}

/** GET /catalog/product-cards - live products as listing cards, in the order asked for. */
export async function productCards(ids: readonly string[]): Promise<ListingItem[]> {
  const cards = await listingItemsByIds(ids);
  return ids.flatMap((id) => cards.get(id) ?? []);
}
