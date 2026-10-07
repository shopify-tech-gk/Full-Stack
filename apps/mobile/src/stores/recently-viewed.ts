// View tracking, RN — mirrors apps/web/src/lib/recently-viewed.ts:
//  - guest: product ids + times in AsyncStorage (ym_guest_recently_viewed), shared-client rules;
//  - signed in: catalog-service /api/catalog/recently-viewed (capped, de-duped, newest first).
// Recording is fire-and-forget (never blocks the product page). On login the guest list is merged
// into the account (POST /recently-viewed/merge) and cleared, like the guest cart/wishlist.
import {
  addGuestView,
  guestMergeItems,
  parseGuestViews,
  type GuestView,
} from '@youmart/shared-client';
import { api } from '@/lib/api';
import { getJSON, setJSON, removeKey } from '@/lib/storage';
import { getSession } from './session';

const KEY = 'ym_guest_recently_viewed';

export async function loadGuestViews(): Promise<GuestView[]> {
  return parseGuestViews(await getJSON<unknown>(KEY));
}

async function writeGuestViews(views: readonly GuestView[]): Promise<void> {
  if (views.length === 0) await removeKey(KEY);
  else await setJSON(KEY, views);
}

let merging: Promise<void> | null = null;

/** Folds a pending guest list into the account once (on login / first authed record). */
export function mergeGuestViews(): Promise<void> {
  merging ??= (async () => {
    const guest = await loadGuestViews();
    if (guest.length === 0) return;
    await writeGuestViews([]);
    try {
      await api.catalog.mergeRecentlyViewed(guestMergeItems(guest));
    } catch {
      await writeGuestViews(guest); // not lost: retry next time
    }
  })().finally(() => {
    merging = null;
  });
  return merging;
}

/** Records a product view. Never awaited by the screen; any failure is swallowed. */
export function recordView(productId: string): void {
  void (async () => {
    try {
      if (getSession().status === 'authenticated') {
        await mergeGuestViews();
        await api.catalog.recordView(productId);
      } else {
        await writeGuestViews(addGuestView(await loadGuestViews(), productId));
      }
    } catch {
      /* best-effort, never affects the product page */
    }
  })();
}
