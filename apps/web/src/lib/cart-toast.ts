'use client';

// One site-wide cart notice (floating, WooCommerce notice styling): add-to-cart confirmations and
// errors from every page, and the merge summary after signing in - which can happen on /checkout
// or /account, where no cart page is on screen to show it.
import { useSyncExternalStore } from 'react';

export interface CartToast {
  id: number;
  tone: 'success' | 'info' | 'error';
  message: string;
  details?: string[];
  /** The follow-up link; defaults to "View cart". */
  action?: { href: string; label: string };
}

let toast: CartToast | null = null;
let nextId = 1;
let timer: ReturnType<typeof setTimeout> | undefined;
const listeners = new Set<() => void>();

export function showCartToast(next: Omit<CartToast, 'id'>): void {
  toast = { ...next, id: nextId++ };
  listeners.forEach((listener) => listener());
  clearTimeout(timer);
  // Errors and multi-line merge summaries stay longer than a plain confirmation.
  const long = next.tone !== 'success' || (next.details?.length ?? 0) > 0;
  timer = setTimeout(dismissCartToast, long ? 10000 : 5000);
}

export function dismissCartToast(): void {
  clearTimeout(timer);
  toast = null;
  listeners.forEach((listener) => listener());
}

export function useCartToast(): CartToast | null {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => toast,
    () => null,
  );
}
