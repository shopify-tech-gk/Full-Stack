// Guest wishlist (signed out) + merge-on-login, shared by web and mobile - the same pattern as the
// guest cart (guest-cart.ts): pure logic, storage and the network call injected.
//
// MERGE ON LOGIN - the rules
// 1. The guest list is taken out of storage BEFORE merging (a second tab can't merge it twice).
// 2. Each guest item is sent as POST /api/wishlist/items { skuId }, oldest first so the newest ends
//    up on top (the server lists newest first). The server is idempotent, so the result is the
//    UNION of the guest and account wishlists - nothing is lost or duplicated.
// 3. A product that is no longer sold (404/400) is dropped.
// 4. A full account wishlist (409, 200 items) or a transient failure stops the merge: the untried
//    items go back into the guest list so nothing is lost silently.
import { ApiError } from './api-client';
import type { Money, WishlistItem, WishlistView } from './types';

/** Same cap as cart-service's WISHLIST_MAX_ITEMS. */
export const WISHLIST_MAX_ITEMS = 200;

export const EMPTY_WISHLIST: WishlistView = { items: [], itemCount: 0 };

/** What a "wishlist" heart knows about the product it saves. */
export interface WishlistProduct {
  skuId: string;
  productId: string;
  productSlug: string;
  title: string;
  price: Money;
  mrp: Money;
}

export function wishlistView(items: readonly WishlistItem[]): WishlistView {
  return { items: [...items], itemCount: items.length };
}

export function guestWishlistItemId(skuId: string): string {
  return `guest-${skuId}`;
}

/** Idempotent like POST /api/wishlist/items; newest first; capped like the server. */
export function addGuestWishlistItem(
  view: WishlistView,
  product: WishlistProduct,
  now: Date = new Date(),
): WishlistView {
  if (view.items.some((item) => item.skuId === product.skuId)) return view;
  const item: WishlistItem = {
    wishlistItemId: guestWishlistItemId(product.skuId),
    skuId: product.skuId,
    productId: product.productId,
    productSlug: product.productSlug,
    title: product.title,
    sellingPrice: product.price,
    mrp: product.mrp,
    available: true,
    addedAt: now.toISOString(),
  };
  return wishlistView([item, ...view.items].slice(0, WISHLIST_MAX_ITEMS));
}

export function removeWishlistItem(view: WishlistView, wishlistItemId: string): WishlistView {
  return wishlistView(view.items.filter((item) => item.wishlistItemId !== wishlistItemId));
}

export function wishlistErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.status === 409) return error.message;
    if (error.status === 404) return 'Sorry, this product is no longer available.';
  }
  return 'We could not update your wishlist. Please check your connection and try again.';
}

export interface WishlistMergeResult {
  merged: number;
  dropped: WishlistItem[];
  /** Not attempted (full wishlist or a transient failure) - put back in the guest list. */
  remaining: WishlistItem[];
}

/** Runs the merge described at the top of this file. `items` is newest first, as stored. */
export async function mergeGuestWishlist(
  items: readonly WishlistItem[],
  addItem: (skuId: string) => Promise<unknown>,
): Promise<WishlistMergeResult> {
  const oldestFirst = [...items].reverse();
  const result: WishlistMergeResult = { merged: 0, dropped: [], remaining: [] };
  for (let index = 0; index < oldestFirst.length; index += 1) {
    const item = oldestFirst[index]!;
    try {
      await addItem(item.skuId);
      result.merged += 1;
    } catch (error) {
      if (error instanceof ApiError && (error.status === 404 || error.status === 400)) {
        result.dropped.push(item);
        continue;
      }
      result.remaining = oldestFirst.slice(index).reverse();
      return result;
    }
  }
  return result;
}

/** What to tell the customer after a merge; null when there was nothing to merge. */
export function wishlistMergeNotice(
  result: WishlistMergeResult,
): { tone: 'success' | 'info'; message: string; details: string[] } | null {
  const details = result.dropped.map(
    (item) => `"${item.title ?? 'A product'}" is no longer available and was not saved.`,
  );
  if (result.remaining.length > 0) {
    details.push(
      'Some saved products could not be moved to your account yet - we will try again next time you log in.',
    );
  }
  if (result.merged === 0 && details.length === 0) return null;
  return {
    tone: details.length > 0 ? 'info' : 'success',
    message:
      result.merged > 0
        ? `${result.merged === 1 ? 'The product' : `The ${result.merged} products`} you saved before logging in ${result.merged === 1 ? 'is' : 'are'} now in your wishlist.`
        : 'We could not move the products you saved before logging in.',
    details,
  };
}
