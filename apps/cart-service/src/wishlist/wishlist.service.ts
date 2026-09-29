import type { Money } from '@youmart/shared-types';
import { AppError } from '@youmart/errors';
import { prisma } from '../db';
import { catalogClient } from '../serviceClients';

/** Keeps a single user's wishlist (and the per-read catalog fan-out below) bounded. */
export const WISHLIST_MAX_ITEMS = 200;

export interface WishlistItemView {
  wishlistItemId: string;
  skuId: string;
  productId: string;
  /** Live catalog data - null when the SKU can no longer be read from catalog. */
  productSlug: string | null;
  title: string | null;
  sellingPrice: Money | null;
  mrp: Money | null;
  /** false when the SKU is inactive or gone from catalog. */
  available: boolean;
  addedAt: string;
}

export interface WishlistView {
  items: WishlistItemView[];
  itemCount: number;
}

/**
 * Same N+1 catalog enrichment as the cart view (cart.service.ts buildCartView) - prices are
 * always live, never a stored snapshot. A SKU that catalog can no longer return is still listed
 * (so the customer can remove it) with `available: false` instead of failing the whole read.
 */
export async function getWishlist(userId: string): Promise<WishlistView> {
  const rows = await prisma.wishlistItem.findMany({
    where: { userId, deletedAt: null },
    orderBy: { createdAt: 'desc' },
  });

  const items = await Promise.all(
    rows.map(async (row): Promise<WishlistItemView> => {
      const base = {
        wishlistItemId: row.id,
        skuId: row.skuId,
        productId: row.productId,
        addedAt: row.createdAt.toISOString(),
      };
      try {
        const sku = await catalogClient.getSku(row.skuId);
        return {
          ...base,
          productSlug: sku.productSlug,
          title: sku.title,
          sellingPrice: sku.sellingPrice,
          mrp: sku.mrp,
          available: sku.active,
        };
      } catch {
        return {
          ...base,
          productSlug: null,
          title: null,
          sellingPrice: null,
          mrp: null,
          available: false,
        };
      }
    }),
  );

  return { items, itemCount: items.length };
}

/** Idempotent: adding a SKU that is already on the wishlist returns the wishlist unchanged. */
export async function addWishlistItem(userId: string, skuId: string): Promise<WishlistView> {
  const existing = await prisma.wishlistItem.findFirst({
    where: { userId, skuId, deletedAt: null },
  });
  if (existing) {
    return getWishlist(userId);
  }

  const count = await prisma.wishlistItem.count({ where: { userId, deletedAt: null } });
  if (count >= WISHLIST_MAX_ITEMS) {
    throw new AppError(
      'CONFLICT',
      409,
      `Your wishlist is full (maximum ${WISHLIST_MAX_ITEMS} items)`,
    );
  }

  // Validates the SKU exists (catalog 404 propagates as NOT_FOUND) and resolves its productId.
  const sku = await catalogClient.getSku(skuId);

  try {
    await prisma.wishlistItem.create({ data: { userId, skuId, productId: sku.productId } });
  } catch (err: unknown) {
    // Partial unique index (user_id, sku_id) WHERE deleted_at IS NULL - a concurrent add of the
    // same SKU lost the race; the row exists either way.
    if (!(err instanceof Error && 'code' in err && err.code === 'P2002')) {
      throw err;
    }
  }

  return getWishlist(userId);
}

/** 404 (never 403) when the row is not the caller's own - same discipline as cart lines. */
export async function removeWishlistItem(
  userId: string,
  wishlistItemId: string,
): Promise<WishlistView> {
  const row = await prisma.wishlistItem.findFirst({
    where: { id: wishlistItemId, userId, deletedAt: null },
  });
  if (!row) {
    throw new AppError('NOT_FOUND', 404, 'Wishlist item not found');
  }
  await prisma.wishlistItem.update({
    where: { id: row.id },
    data: { deletedAt: new Date() },
  });
  return getWishlist(userId);
}
