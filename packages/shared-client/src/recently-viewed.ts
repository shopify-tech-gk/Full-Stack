// View tracking, client side - the rules both apps share. Signed in, history lives in
// catalog-service (`/api/catalog/recently-viewed`: capped, de-duped, newest first). Signed out,
// the SAME rules apply to a list kept only in the shopper's own browser, which is merged into the
// account on login (`POST /api/catalog/recently-viewed/merge`), like the W4 guest cart/wishlist.
import type { RecentlyViewedMergeItem } from './types';

/** Per-shopper cap - mirrors catalog-service's RECENTLY_VIEWED_MAX. */
export const RECENTLY_VIEWED_MAX = 50;

export interface GuestView {
  productId: string;
  /** ISO time of the latest view. */
  viewedAt: string;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Puts a view on top: a re-view moves the product up (no duplicate), newest first, capped. */
export function addGuestView(
  views: readonly GuestView[],
  productId: string,
  viewedAt: string = new Date().toISOString(),
): GuestView[] {
  return [{ productId, viewedAt }, ...views.filter((v) => v.productId !== productId)].slice(
    0,
    RECENTLY_VIEWED_MAX,
  );
}

/** A stored guest list (user-editable): only well-formed views, de-duped, newest first, capped. */
export function parseGuestViews(value: unknown): GuestView[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  return value
    .filter(
      (v): v is GuestView =>
        typeof v === 'object' &&
        v !== null &&
        typeof (v as GuestView).productId === 'string' &&
        UUID.test((v as GuestView).productId) &&
        typeof (v as GuestView).viewedAt === 'string' &&
        !Number.isNaN(Date.parse((v as GuestView).viewedAt)),
    )
    .map(({ productId, viewedAt }) => ({ productId, viewedAt }))
    .sort((a, b) => Date.parse(b.viewedAt) - Date.parse(a.viewedAt))
    .filter((v) => !seen.has(v.productId) && seen.add(v.productId))
    .slice(0, RECENTLY_VIEWED_MAX);
}

/** The login merge payload: each product with its own view time, so the order survives. */
export function guestMergeItems(views: readonly GuestView[]): RecentlyViewedMergeItem[] {
  return views
    .slice(0, RECENTLY_VIEWED_MAX)
    .map(({ productId, viewedAt }) => ({ productId, viewedAt }));
}
