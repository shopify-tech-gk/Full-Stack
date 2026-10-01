import { z } from 'zod';
import { AppError } from '@youmart/errors';
import { enqueueSearchReindex } from '@youmart/search-reindex-client';
import { prisma, reviewsDb } from '../db';
import { orderClient } from '../serviceClients';

// W6: storefront product reviews. Rows live in the `reviews` schema (reviews_svc role); the
// product's denormalised rating/ratingCount (catalog schema) are folded forward incrementally,
// so ratings imported with the catalog are kept rather than recomputed from review rows alone.
// Only customers with a paid order for the product can review it (verified purchase), one live
// review each (a resubmit edits it). Verified reviews publish immediately - admin moderation is
// not built yet (status PENDING/REJECTED stay available for it).

export const ReviewListQuery = z.object({
  page: z.coerce.number().int().min(1).max(500).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(10),
});

export const SubmitReviewBody = z.object({
  rating: z.number().int().min(1, 'Please choose a rating').max(5),
  title: z.string().trim().max(120).optional(),
  body: z
    .string()
    .trim()
    .min(10, 'Please write at least 10 characters')
    .max(2000, 'Reviews can be up to 2000 characters'),
  authorName: z.string().trim().min(1).max(60).optional(),
});
export type SubmitReviewBody = z.infer<typeof SubmitReviewBody>;

export interface ReviewView {
  id: string;
  rating: number;
  title: string | null;
  body: string;
  author: string;
  verifiedPurchase: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ReviewPage {
  items: ReviewView[];
  total: number;
  page: number;
  perPage: number;
  /** Published-review star counts, 1..5 (the product's own rating/ratingCount stay authoritative). */
  breakdown: Record<'1' | '2' | '3' | '4' | '5', number>;
}

const DEFAULT_AUTHOR = 'YouMart customer';

type ReviewRow = Awaited<ReturnType<typeof reviewsDb.review.findFirstOrThrow>>;

function toView(row: ReviewRow): ReviewView {
  return {
    id: row.id,
    rating: row.rating,
    title: row.title,
    body: row.body ?? '',
    author: row.authorName ?? DEFAULT_AUTHOR,
    verifiedPurchase: row.orderItemId !== null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

async function activeProductId(slug: string): Promise<string> {
  const product = await prisma.product.findFirst({
    where: { slug, status: 'ACTIVE', deletedAt: null },
    select: { id: true },
  });
  if (!product) {
    throw new AppError('NOT_FOUND', 404, 'Product not found');
  }
  return product.id;
}

/** GET /catalog/products/:slug/reviews - published reviews, newest first. */
export async function listReviews(slug: string, raw: unknown): Promise<ReviewPage> {
  const query = ReviewListQuery.parse(raw);
  const productId = await activeProductId(slug);
  const where = { productId, status: 'PUBLISHED' as const, deletedAt: null };
  const [rows, total, grouped] = await Promise.all([
    reviewsDb.review.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (query.page - 1) * query.limit,
      take: query.limit,
    }),
    reviewsDb.review.count({ where }),
    reviewsDb.review.groupBy({ by: ['rating'], where, _count: { _all: true } }),
  ]);
  const breakdown = { '1': 0, '2': 0, '3': 0, '4': 0, '5': 0 };
  for (const group of grouped) {
    breakdown[String(group.rating) as keyof typeof breakdown] = group._count._all;
  }
  return { items: rows.map(toView), total, page: query.page, perPage: query.limit, breakdown };
}

export interface MyReviewView {
  /** True when the caller has a paid order containing this product. */
  canReview: boolean;
  review: ReviewView | null;
}

/** GET /catalog/products/:slug/reviews/mine - whether the caller may review, and their review. */
export async function getMyReview(userId: string, slug: string): Promise<MyReviewView> {
  const productId = await activeProductId(slug);
  const [purchase, existing] = await Promise.all([
    orderClient.findPurchase(userId, productId),
    reviewsDb.review.findFirst({ where: { productId, userId, deletedAt: null } }),
  ]);
  return {
    canReview: purchase.orderItemId !== null,
    review: existing ? toView(existing) : null,
  };
}

/** POST /catalog/products/:slug/reviews - create, or edit the caller's existing review. */
export async function submitReview(
  userId: string,
  slug: string,
  input: SubmitReviewBody,
): Promise<{ review: ReviewView; created: boolean }> {
  const productId = await activeProductId(slug);
  const purchase = await orderClient.findPurchase(userId, productId);
  if (!purchase.orderItemId) {
    throw new AppError(
      'FORBIDDEN',
      403,
      'Only customers who have bought this product can review it',
    );
  }

  const data = {
    rating: input.rating,
    title: input.title || null,
    body: input.body,
    authorName: input.authorName ?? null,
    orderItemId: purchase.orderItemId,
    status: 'PUBLISHED' as const,
  };
  const existing = await reviewsDb.review.findFirst({
    where: { productId, userId, deletedAt: null },
  });

  let row: ReviewRow;
  if (existing) {
    row = await reviewsDb.review.update({ where: { id: existing.id }, data });
    if (existing.rating !== input.rating && existing.status === 'PUBLISHED') {
      // Shift the average by the change, spread over the existing count.
      await prisma.$executeRaw`
        UPDATE "catalog"."product"
        SET rating = ROUND(LEAST(5, GREATEST(1,
              COALESCE(rating, ${input.rating}) + (${input.rating - existing.rating})::numeric
                / GREATEST(rating_count, 1))), 1),
            updated_at = now()
        WHERE id = ${productId}`;
    }
  } else {
    try {
      row = await reviewsDb.review.create({ data: { ...data, productId, userId } });
    } catch (error) {
      // Two submits racing past findFirst: the partial unique index lets only one through.
      if ((error as { code?: string }).code === 'P2002') {
        throw new AppError('CONFLICT', 409, 'You have already reviewed this product');
      }
      throw error;
    }
    await prisma.$executeRaw`
      UPDATE "catalog"."product"
      SET rating = ROUND((COALESCE(rating, 0) * rating_count + ${input.rating}) / (rating_count + 1), 1),
          rating_count = rating_count + 1,
          updated_at = now()
      WHERE id = ${productId}`;
  }

  // Listing cards and sort-by-rating read the search index.
  await enqueueSearchReindex(productId);
  return { review: toView(row), created: !existing };
}
