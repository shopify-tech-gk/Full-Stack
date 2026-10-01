'use client';

// The storefront wishlist, same shape as the cart store (lib/cart.ts):
// - signed out: a guest wishlist in localStorage (`ym_guest_wishlist`);
// - signed in: cart-service's /api/wishlist (every call returns the full WishlistView).
// Signing in merges the guest list into the account (union) - rules in shared-client
// guest-wishlist.ts. Chosen over "login required" so a heart works for everyone, exactly like
// add-to-cart does.
import { useSyncExternalStore } from 'react';
import {
  EMPTY_WISHLIST,
  ROUTES,
  addGuestWishlistItem,
  isMoney,
  mergeGuestWishlist,
  removeWishlistItem,
  wishlistErrorMessage,
  wishlistMergeNotice,
  wishlistView,
  type WishlistItem,
  type WishlistProduct,
  type WishlistView,
} from '@youmart/shared-client';
import { api } from './api';
import { showCartToast } from './cart-toast';
import { getSession, onSessionChange, useSession } from './session';

const GUEST_KEY = 'ym_guest_wishlist';
export const WISHLIST_TOAST_ACTION = { href: ROUTES.wishlist, label: 'View wishlist' };

export type WishlistMode = 'loading' | 'guest' | 'account';

interface WishlistSnapshot {
  mode: WishlistMode;
  /** null while loading (or when the account wishlist failed to load). */
  view: WishlistView | null;
  failed: boolean;
}

const LOADING: WishlistSnapshot = { mode: 'loading', view: null, failed: false };
let snapshot: WishlistSnapshot = LOADING;
const listeners = new Set<() => void>();

function emit(patch: Partial<WishlistSnapshot>): void {
  snapshot = { ...snapshot, ...patch };
  listeners.forEach((listener) => listener());
}

// --- Guest list (localStorage; user-editable, so only well-formed items are kept) ---

function isGuestItem(value: unknown): value is WishlistItem {
  if (typeof value !== 'object' || value === null) return false;
  const item = value as Record<string, unknown>;
  return (
    ['wishlistItemId', 'skuId', 'productId', 'productSlug', 'title', 'addedAt'].every(
      (key) => typeof item[key] === 'string',
    ) &&
    isMoney(item.sellingPrice) &&
    isMoney(item.mrp)
  );
}

function readGuest(): WishlistView {
  try {
    const raw = window.localStorage.getItem(GUEST_KEY);
    if (!raw) return EMPTY_WISHLIST;
    const data = JSON.parse(raw) as { items?: unknown };
    if (!Array.isArray(data.items)) return EMPTY_WISHLIST;
    return wishlistView(
      data.items.filter(isGuestItem).map((item) => ({ ...item, available: true })),
    );
  } catch {
    return EMPTY_WISHLIST;
  }
}

function writeGuest(view: WishlistView): void {
  try {
    if (view.items.length === 0) window.localStorage.removeItem(GUEST_KEY);
    else window.localStorage.setItem(GUEST_KEY, JSON.stringify({ items: view.items }));
  } catch {
    // Storage full or blocked: still works for this page view.
  }
  if (snapshot.mode === 'guest') emit({ view });
}

// --- Account list ---

let accountUserId: string | null = null;
// Bumped on every sign-in/out so a response for the previous user can never land.
let generation = 0;

async function loadAccount(gen: number): Promise<void> {
  const guest = readGuest();
  if (guest.items.length > 0) {
    writeGuest(EMPTY_WISHLIST);
    const result = await mergeGuestWishlist(guest.items, (skuId) => api.wishlist.add(skuId));
    if (result.remaining.length > 0) writeGuest(wishlistView(result.remaining));
    const notice = wishlistMergeNotice(result);
    if (notice && gen === generation) showCartToast({ ...notice, action: WISHLIST_TOAST_ACTION });
  }
  try {
    const view = await api.wishlist.get();
    if (gen === generation) emit({ view, failed: false });
  } catch {
    if (gen === generation) emit({ view: null, failed: true });
  }
}

function syncWithSession(): void {
  const session = getSession();
  if (session.status === 'loading') return;
  if (session.status === 'anonymous') {
    if (snapshot.mode === 'guest') return;
    accountUserId = null;
    generation += 1;
    emit({ mode: 'guest', view: readGuest(), failed: false });
    return;
  }
  if (accountUserId === session.user.id) return;
  accountUserId = session.user.id;
  generation += 1;
  emit({ mode: 'account', view: null, failed: false });
  void loadAccount(generation);
}

let started = false;

function start(): void {
  if (started) return;
  started = true;
  onSessionChange(syncWithSession);
  window.addEventListener('storage', (event) => {
    if (event.key === GUEST_KEY && snapshot.mode === 'guest') emit({ view: readGuest() });
  });
  syncWithSession();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  start();
  return () => listeners.delete(listener);
}

// --- Actions ---

async function accountCall(call: () => Promise<WishlistView>): Promise<boolean> {
  const gen = generation;
  try {
    const view = await call();
    if (gen === generation) emit({ view, failed: false });
    return true;
  } catch (error) {
    showCartToast({ tone: 'error', message: wishlistErrorMessage(error) });
    return false;
  }
}

async function add(product: WishlistProduct): Promise<boolean> {
  if (snapshot.mode === 'loading') return false;
  if (snapshot.mode === 'guest') {
    writeGuest(addGuestWishlistItem(readGuest(), product));
    return true;
  }
  return accountCall(() => api.wishlist.add(product.skuId));
}

async function remove(wishlistItemId: string): Promise<boolean> {
  if (snapshot.mode === 'guest') {
    writeGuest(removeWishlistItem(readGuest(), wishlistItemId));
    return true;
  }
  if (snapshot.mode !== 'account' || !snapshot.view) return false;
  emit({ view: removeWishlistItem(snapshot.view, wishlistItemId) });
  const ok = await accountCall(() => api.wishlist.remove(wishlistItemId));
  if (!ok) void reload();
  return ok;
}

async function reload(): Promise<void> {
  if (snapshot.mode === 'account') {
    await accountCall(() => api.wishlist.get());
  }
}

export interface WishlistStore extends WishlistSnapshot {
  add: (product: WishlistProduct) => Promise<boolean>;
  remove: (wishlistItemId: string) => Promise<boolean>;
  reload: () => Promise<void>;
}

const ACTIONS = { add, remove, reload };

export function useWishlist(): WishlistStore {
  useSession();
  const current = useSyncExternalStore(
    subscribe,
    () => snapshot,
    () => LOADING,
  );
  return { ...current, ...ACTIONS };
}

/** The saved item for this SKU (or null), for heart toggles. */
export function useWishlistItem(skuId: string | null | undefined): WishlistItem | null {
  useSession();
  return useSyncExternalStore(
    subscribe,
    () => (skuId && snapshot.view?.items.find((item) => item.skuId === skuId)) || null,
    () => null,
  );
}

export function useWishlistCount(): number {
  useSession();
  return useSyncExternalStore(
    subscribe,
    () => snapshot.view?.itemCount ?? 0,
    () => 0,
  );
}
