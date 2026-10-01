'use client';

// The storefront cart. One hook, two backings that follow the session:
// - signed out: a guest cart in localStorage (`ym_guest_cart`), totals re-derived in paise;
// - signed in: cart-service through the api-client (every call returns the full CartView, and a
//   401 refreshes the session once and retries).
// Signing in merges the guest cart into the account cart - rules in shared-client guest-cart.ts.
import { useSyncExternalStore } from 'react';
import {
  EMPTY_CART,
  GUEST_CART_ID,
  addGuestItem,
  cartErrorMessage,
  isMoney,
  mergeGuestCart,
  mergeNotice,
  recalcCart,
  removeLine,
  setLineQuantity,
  type CartLine,
  type CartProduct,
  type CartView,
} from '@youmart/shared-client';
import { api } from './api';
import { showCartToast } from './cart-toast';
import { rememberProductImage } from './product-images';
import { getSession, onSessionChange, useSession } from './session';

const GUEST_KEY = 'ym_guest_cart';
/** The pre-W4 demo cart; removed from browsers that still have it. */
const LEGACY_DEMO_KEY = 'ym_demo_cart';

export interface CartNotice {
  tone: 'success' | 'info' | 'error';
  message: string;
  details?: string[];
}

export type CartMode = 'loading' | 'guest' | 'account';

interface CartSnapshot {
  mode: CartMode;
  /** null while the session or the account cart is still loading (or failed to load). */
  cart: CartView | null;
  notice: CartNotice | null;
}

const LOADING: CartSnapshot = { mode: 'loading', cart: null, notice: null };
let snapshot: CartSnapshot = LOADING;
const listeners = new Set<() => void>();

function emit(patch: Partial<CartSnapshot>): void {
  snapshot = { ...snapshot, ...patch };
  listeners.forEach((listener) => listener());
}

// --- Guest cart (localStorage) ---

function isCartLine(value: unknown): value is CartLine {
  if (typeof value !== 'object' || value === null) return false;
  const line = value as Record<string, unknown>;
  return (
    ['cartItemId', 'skuId', 'productId', 'productSlug', 'title'].every(
      (key) => typeof line[key] === 'string',
    ) &&
    Number.isInteger(line.quantity) &&
    (line.quantity as number) >= 1 &&
    isMoney(line.priceSnapshot)
  );
}

// localStorage is user-editable: keep only well-formed lines and re-derive every total. Prices
// here are only a preview - the account cart re-prices every line when it is merged.
function readGuest(): CartView {
  try {
    const raw = window.localStorage.getItem(GUEST_KEY);
    if (!raw) return EMPTY_CART;
    const data = JSON.parse(raw) as { items?: unknown };
    if (!Array.isArray(data.items)) return EMPTY_CART;
    return recalcCart(GUEST_CART_ID, data.items.filter(isCartLine));
  } catch {
    return EMPTY_CART;
  }
}

function writeGuest(cart: CartView): void {
  try {
    if (cart.items.length === 0) window.localStorage.removeItem(GUEST_KEY);
    else window.localStorage.setItem(GUEST_KEY, JSON.stringify({ items: cart.items }));
  } catch {
    // Storage full or blocked: the cart still works for this page view.
  }
  if (snapshot.mode === 'guest') emit({ cart });
}

// --- Account cart (cart-service) ---

let accountUserId: string | null = null;
// Bumped on every sign-in/out so a response for the previous user can never land.
let generation = 0;
let queue: Promise<unknown> = Promise.resolve();
let inFlight = 0;

/**
 * Runs account-cart calls one at a time. Only the response to the LAST queued call is shown, so
 * quick stepper clicks don't flicker back through intermediate quantities.
 */
function enqueue(call: () => Promise<CartView>): Promise<void> {
  const gen = generation;
  inFlight += 1;
  const run = queue.then(async () => {
    try {
      const cart = await call();
      if (gen === generation && inFlight === 1) emit({ cart });
    } finally {
      inFlight -= 1;
    }
  });
  queue = run.catch(() => undefined);
  return run;
}

async function resync(gen: number): Promise<void> {
  try {
    const cart = await api.cart.get();
    if (gen === generation) emit({ cart });
  } catch {
    // Keep the optimistic view; the next successful call replaces it.
  }
}

/** Account cart failed a change: show why and reload the true state. */
function fail(error: unknown, added?: number): void {
  emit({ notice: { tone: 'error', message: cartErrorMessage(error, added) } });
  void resync(generation);
}

async function loadAccountCart(gen: number): Promise<void> {
  // Take the guest cart out first so a second tab signing in can't merge it again.
  const guest = readGuest();
  if (guest.items.length > 0) {
    writeGuest(EMPTY_CART);
    const result = await mergeGuestCart(guest.items, (skuId, quantity) =>
      api.cart.addItem(skuId, quantity),
    );
    if (result.remaining.length > 0) {
      const kept = result.remaining.reduce(
        (cart, line) => addGuestItem(cart, { ...line, price: line.priceSnapshot }, line.quantity),
        readGuest(),
      );
      writeGuest(kept);
    }
    // Site-wide: the sign-in may have happened on /checkout or /account.
    const notice = mergeNotice(result);
    if (notice && gen === generation) showCartToast(notice);
  }
  try {
    const cart = await api.cart.get();
    if (gen === generation) emit({ cart });
  } catch {
    if (gen === generation) {
      emit({
        cart: null,
        notice: { tone: 'error', message: 'We could not load your cart. Please try again.' },
      });
    }
  }
}

// --- Following the session ---

function syncWithSession(): void {
  const session = getSession();
  if (session.status === 'loading') return;
  if (session.status === 'anonymous') {
    if (snapshot.mode === 'guest') return;
    accountUserId = null;
    generation += 1;
    emit({ mode: 'guest', cart: readGuest(), notice: null });
    return;
  }
  if (accountUserId === session.user.id) return;
  accountUserId = session.user.id;
  generation += 1;
  emit({ mode: 'account', cart: null, notice: null });
  void loadAccountCart(generation);
}

let started = false;

function start(): void {
  if (started) return;
  started = true;
  try {
    window.localStorage.removeItem(LEGACY_DEMO_KEY);
  } catch {
    // ignore
  }
  onSessionChange(syncWithSession);
  // Another tab changed the guest cart.
  window.addEventListener('storage', (event) => {
    if (event.key === GUEST_KEY && snapshot.mode === 'guest') emit({ cart: readGuest() });
  });
  syncWithSession();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  start();
  return () => listeners.delete(listener);
}

/** Resolves once the cart knows whether it is the guest or the account cart. */
function whenReady(): Promise<void> {
  if (snapshot.mode !== 'loading') return Promise.resolve();
  return new Promise((resolve) => {
    const check = () => {
      if (snapshot.mode !== 'loading') {
        listeners.delete(check);
        resolve();
      }
    };
    listeners.add(check);
    start();
  });
}

// --- Actions ---

export type AddResult = { ok: true } | { ok: false; message: string };

async function add(product: CartProduct, quantity: number): Promise<AddResult> {
  if (product.image) rememberProductImage(product.productSlug, product.image);
  await whenReady();
  if (snapshot.mode === 'guest') {
    writeGuest(addGuestItem(readGuest(), product, quantity));
    return { ok: true };
  }
  try {
    await enqueue(() => api.cart.addItem(product.skuId, quantity));
    return { ok: true };
  } catch (error) {
    return { ok: false, message: cartErrorMessage(error, quantity) };
  }
}

function setQuantity(cartItemId: string, quantity: number): void {
  if (snapshot.mode === 'guest') {
    writeGuest(setLineQuantity(readGuest(), cartItemId, quantity));
    return;
  }
  if (!snapshot.cart) return;
  emit({ cart: setLineQuantity(snapshot.cart, cartItemId, quantity), notice: null });
  enqueue(() => api.cart.updateItem(cartItemId, quantity)).catch((error) => fail(error));
}

function remove(cartItemId: string): void {
  if (snapshot.mode === 'guest') {
    writeGuest(removeLine(readGuest(), cartItemId));
    return;
  }
  if (!snapshot.cart) return;
  emit({ cart: removeLine(snapshot.cart, cartItemId), notice: null });
  enqueue(() => api.cart.removeItem(cartItemId)).catch((error) => fail(error));
}

/** Undo a removal. The account cart re-adds the SKU (priced now, placed last by the server). */
function restore(line: CartLine, index: number): void {
  if (snapshot.mode === 'guest') {
    const current = readGuest();
    if (current.items.some((item) => item.skuId === line.skuId)) return;
    const items = [...current.items];
    items.splice(Math.min(index, items.length), 0, line);
    writeGuest(recalcCart(GUEST_CART_ID, items));
    return;
  }
  enqueue(() => api.cart.addItem(line.skuId, line.quantity)).catch((error) =>
    fail(error, line.quantity),
  );
}

function clear(): void {
  if (snapshot.mode === 'guest') {
    writeGuest(EMPTY_CART);
    return;
  }
  emit({ cart: EMPTY_CART });
  enqueue(() => api.cart.clear()).catch((error) => fail(error));
}

function dismissNotice(): void {
  emit({ notice: null });
}

function reload(): void {
  emit({ notice: null });
  void resync(generation);
}

export interface CartStore extends CartSnapshot {
  add: (product: CartProduct, quantity: number) => Promise<AddResult>;
  setQuantity: (cartItemId: string, quantity: number) => void;
  remove: (cartItemId: string) => void;
  restore: (line: CartLine, index: number) => void;
  clear: () => void;
  dismissNotice: () => void;
  reload: () => void;
}

const ACTIONS = { add, setQuantity, remove, restore, clear, dismissNotice, reload };

export function useCart(): CartStore {
  // Mounting the session hook starts the session bootstrap the cart follows.
  useSession();
  const current = useSyncExternalStore(
    subscribe,
    () => snapshot,
    () => LOADING,
  );
  return { ...current, ...ACTIONS };
}

/** Units in the cart, for the header/bottom-nav badge (0 while loading). */
export function useCartCount(): number {
  useSession();
  return useSyncExternalStore(
    subscribe,
    () => snapshot.cart?.itemCount ?? 0,
    () => 0,
  );
}

/** Adds to the cart (guest or account) and confirms it; resolves true when the add went in. */
export function useAddToCart(): (product: CartProduct, quantity: number) => Promise<boolean> {
  useSession();
  return async (product, quantity) => {
    const result = await add(product, quantity);
    showCartToast(
      result.ok
        ? {
            tone: 'success',
            message:
              quantity > 1
                ? `${quantity} \u00d7 \u201c${product.title}\u201d have been added to your cart.`
                : `\u201c${product.title}\u201d has been added to your cart.`,
          }
        : { tone: 'error', message: result.message },
    );
    return result.ok;
  };
}
