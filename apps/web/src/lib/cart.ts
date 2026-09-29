'use client';

// Cart data seam. DEMO: the cart lives in localStorage so /cart and /checkout share it.
// Wiring later: keep the hook's shape and back it with api.cart.get/updateItem/removeItem/
// clear (every call returns the full CartView), plus api.cart.addItem from product pages.
import { useSyncExternalStore } from 'react';
import {
  DEMO_CART,
  EMPTY_CART,
  isMoney,
  recalcCart,
  removeLine,
  setLineQuantity,
  type CartLine,
  type CartView,
} from '@youmart/shared-client';

const STORAGE_KEY = 'ym_demo_cart';
const listeners = new Set<() => void>();
let memory: CartView = DEMO_CART;
let cachedRaw: string | null | undefined;

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

// localStorage is user-editable: accept only well-formed lines and re-derive every total.
function parse(raw: string): CartView | null {
  try {
    const data = JSON.parse(raw) as { cartId?: unknown; items?: unknown };
    if (!Array.isArray(data.items) || !data.items.every(isCartLine)) return null;
    return recalcCart(typeof data.cartId === 'string' ? data.cartId : null, data.items);
  } catch {
    return null;
  }
}

function read(): CartView {
  let raw: string | null;
  try {
    raw = window.localStorage.getItem(STORAGE_KEY);
  } catch {
    return memory;
  }
  if (raw !== cachedRaw) {
    cachedRaw = raw;
    memory = raw === null ? DEMO_CART : (parse(raw) ?? DEMO_CART);
  }
  return memory;
}

function write(cart: CartView) {
  memory = cart;
  try {
    const raw = JSON.stringify(cart);
    window.localStorage.setItem(STORAGE_KEY, raw);
    cachedRaw = raw;
  } catch {
    cachedRaw = undefined;
  }
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  const onStorage = (event: StorageEvent) => {
    if (event.key === STORAGE_KEY) listener();
  };
  window.addEventListener('storage', onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener('storage', onStorage);
  };
}

export interface CartStore {
  /** null during SSR/hydration - the cart is client state until the cart API is wired. */
  cart: CartView | null;
  setQuantity: (cartItemId: string, quantity: number) => void;
  remove: (cartItemId: string) => void;
  restore: (line: CartLine, index: number) => void;
  clear: () => void;
  /** DEMO: refill the sample cart. */
  reset: () => void;
}

export function useCart(): CartStore {
  const cart = useSyncExternalStore(subscribe, read, () => null);
  return {
    cart,
    setQuantity: (id, quantity) => write(setLineQuantity(read(), id, quantity)),
    remove: (id) => write(removeLine(read(), id)),
    restore: (line, index) => {
      const current = read();
      if (current.items.some((item) => item.cartItemId === line.cartItemId)) return;
      const items = [...current.items];
      items.splice(Math.min(index, items.length), 0, line);
      write(recalcCart(current.cartId ?? DEMO_CART.cartId, items));
    },
    clear: () => write(EMPTY_CART),
    reset: () => write(DEMO_CART),
  };
}
