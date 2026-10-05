'use client';

// View tracking in the browser, same shape as the cart/wishlist stores (lib/cart.ts, lib/wishlist.ts):
// - signed out: product ids + view times in localStorage (`ym_guest_recently_viewed`), capped,
//   de-duped, newest first (shared-client recently-viewed.ts) - never sent anywhere;
// - signed in: catalog-service's /api/catalog/recently-viewed (per user, capped at 50).
// Signing in merges the guest list into the account (latest view time wins) and clears it; a
// failed merge puts it back for the next try (the W4 guest-cart rule).
// Recording is fire-and-forget: nothing awaits it and every failure is swallowed.
import { useEffect, useSyncExternalStore } from 'react';
import {
  PRODUCT_RAIL_DEFINITIONS,
  addGuestView,
  guestMergeItems,
  parseGuestViews,
  personalRailProducts,
  toCardData,
  type GuestView,
  type PersonalRailFeed,
  type PersonalRailKey,
  type ProductCardData,
  type ProductListItem,
} from '@youmart/shared-client';
import { api } from './api';
import { getSession, onSessionChange } from './session';

const GUEST_KEY = 'ym_guest_recently_viewed';

function readGuest(): GuestView[] {
  try {
    const raw = window.localStorage.getItem(GUEST_KEY);
    return raw ? parseGuestViews(JSON.parse(raw)) : [];
  } catch {
    return [];
  }
}

function writeGuest(views: readonly GuestView[]): void {
  try {
    if (views.length === 0) window.localStorage.removeItem(GUEST_KEY);
    else window.localStorage.setItem(GUEST_KEY, JSON.stringify(views));
  } catch {
    // Storage full or blocked: tracking is best-effort.
  }
}

// --- Guest -> account merge (once per sign-in; shared by every caller) ---

let merging: Promise<ProductListItem[] | null> | null = null;

/** Folds a pending guest list into the account; resolves to the merged list, or null if none. */
function mergeGuest(): Promise<ProductListItem[] | null> {
  merging ??= (async () => {
    const guest = readGuest();
    if (guest.length === 0) return null;
    writeGuest([]);
    try {
      return (await api.catalog.mergeRecentlyViewed(guestMergeItems(guest))).items;
    } catch (error) {
      // Not lost: back into the browser (with anything viewed meanwhile) for the next sign-in.
      writeGuest(
        guest.reduceRight((views, v) => addGuestView(views, v.productId, v.viewedAt), readGuest()),
      );
      throw error;
    }
  })().finally(() => {
    merging = null;
  });
  return merging;
}

// --- Recording ---

/** A product page view. Never awaited by the page; any failure is ignored. */
export function recordProductView(productId: string): void {
  stale = true;
  const session = getSession();
  if (session.status === 'authenticated') {
    mergeGuest()
      .catch(() => null)
      .then(() => api.catalog.recordView(productId))
      .catch(() => undefined);
  } else if (session.status === 'anonymous') {
    writeGuest(addGuestView(readGuest(), productId));
  }
}

/**
 * THE redesign-3 SEAM, filled (packages/shared-client/src/product-rails.ts): the signed-in user's
 * server history, or the guest's local one resolved to fresh cards. "Pick up where you left off"
 * is personal; "Recommended for You" stays heading-matched for now (null).
 */
export const recentlyViewedFeed: PersonalRailFeed = async (key) => {
  if (key !== 'left-off') return null;
  const session = getSession();
  let items: ProductListItem[];
  if (session.status === 'authenticated') {
    items = (await mergeGuest()) ?? (await api.catalog.recentlyViewed()).items;
  } else {
    const guest = readGuest();
    items =
      guest.length > 0 ? (await api.catalog.productCards(guest.map((v) => v.productId))).items : [];
  }
  return items.map(toCardData);
};

// --- Personal rails store (desktop sliders + mobile rail cards share one fetch) ---

export type PersonalRails = Partial<Record<PersonalRailKey, ProductCardData[]>>;

/** null until the session is known and the feed has answered (rails show the fallback meanwhile). */
let rails: PersonalRails | null = null;
let resolvedFor: string | null = null;
let stale = true;
let generation = 0;
const listeners = new Set<() => void>();

function emit(next: PersonalRails): void {
  rails = next;
  listeners.forEach((listener) => listener());
}

function sync(): void {
  const session = getSession();
  if (session.status === 'loading' || listeners.size === 0) return;
  const who = session.status === 'authenticated' ? session.user.id : 'guest';
  if (who === resolvedFor && !stale) return;
  resolvedFor = who;
  stale = false;
  const gen = ++generation;
  void Promise.all(
    PRODUCT_RAIL_DEFINITIONS.filter((d) => d.personal).map(async (definition) => {
      const mine = await personalRailProducts(definition, recentlyViewedFeed);
      return [definition.key, mine] as const;
    }),
  ).then((entries) => {
    if (gen !== generation) return;
    const next: PersonalRails = {};
    for (const [key, mine] of entries) if (mine) next[key as PersonalRailKey] = mine;
    emit(next);
  });
}

let started = false;

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  if (!started) {
    started = true;
    onSessionChange(sync);
  }
  sync();
  return () => listeners.delete(listener);
}

/** The shopper's own products per personal rail (absent = use the heading-matched fallback). */
export function usePersonalRails(): PersonalRails | null {
  return useSyncExternalStore(
    subscribe,
    () => rails,
    () => null,
  );
}

/** Product page: records the view once the session is known (after hydration; never blocks). */
export function useRecordProductView(productId: string, sessionStatus: string): void {
  useEffect(() => {
    if (sessionStatus !== 'loading') recordProductView(productId);
  }, [productId, sessionStatus]);
}
