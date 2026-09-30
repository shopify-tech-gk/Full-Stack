// Guest cart (signed out) + merge-on-login, shared by web and mobile. Pure logic: storage and the
// network call are injected, so each app keeps its own persistence (localStorage / AsyncStorage).
//
// MERGE ON LOGIN - the rules
// 1. The guest cart is taken out of storage BEFORE merging, so a second tab signing in at the same
//    moment cannot add the same lines twice.
// 2. Each guest line is sent as POST /api/cart/items { skuId, quantity }. cart-service adds it to
//    any existing line for that SKU, so quantities are SUMMED: the guest cart and the account cart
//    are separate intents (logging out never copies the account cart into the guest cart), so
//    adding them up loses nothing the customer chose.
// 3. The sum is capped by stock: on 409 "Insufficient stock" the server reports `requested` (the
//    summed total) and `available`. Room left = available - (requested - guest quantity). If there
//    is room, that many are added instead ("reduced"); otherwise the line is dropped
//    ("out_of_stock").
// 4. A line whose product is no longer sold (409 "not currently available", 404/400) is dropped
//    ("unavailable").
// 5. A transient failure (network, 5xx, 401) stops the merge: the untouched lines are returned as
//    `remaining` and go back into the guest cart, so the next sign-in retries them.
// 6. Every guest line that was merged or dropped is gone for good: the guest cart ends up empty.
//    The caller shows `mergeNotice(result)` so nothing changes silently.
import { ApiError } from './api-client';
import { recalcCart } from './cart';
import type { CartLine, CartView, Money } from './types';

export const GUEST_CART_ID = 'guest';

/** What an "Add to cart" button knows about the product it adds. */
export interface CartProduct {
  skuId: string;
  productId: string;
  productSlug: string;
  title: string;
  price: Money;
  image?: string;
}

export function guestLineId(skuId: string): string {
  return `guest-${skuId}`;
}

/** Same semantics as POST /api/cart/items: adds to an existing line and refreshes its price. */
export function addGuestItem(cart: CartView, product: CartProduct, quantity: number): CartView {
  const existing = cart.items.some((line) => line.skuId === product.skuId);
  const items: CartLine[] = existing
    ? cart.items.map((line) =>
        line.skuId === product.skuId
          ? { ...line, quantity: line.quantity + quantity, priceSnapshot: product.price }
          : line,
      )
    : [
        ...cart.items,
        {
          cartItemId: guestLineId(product.skuId),
          skuId: product.skuId,
          productId: product.productId,
          productSlug: product.productSlug,
          title: product.title,
          quantity,
          priceSnapshot: product.price,
          lineTotal: product.price,
        },
      ];
  return recalcCart(GUEST_CART_ID, items);
}

export interface StockConflict {
  /** Total the line would have had (existing + requested). */
  requested: number;
  available: number;
}

/** The soft stock check's 409 (`details { skuId, requested, available }`), if that's the error. */
export function stockConflict(error: unknown): StockConflict | null {
  if (!(error instanceof ApiError) || error.status !== 409) return null;
  const details = error.details as { requested?: unknown; available?: unknown } | undefined;
  if (typeof details?.requested !== 'number' || typeof details.available !== 'number') return null;
  return { requested: details.requested, available: details.available };
}

/**
 * Customer-facing text for a failed cart call. `added` is the quantity an add tried to put in the
 * cart (omit for a quantity change). Wording follows WooCommerce's stock notices, as live shows.
 */
export function cartErrorMessage(error: unknown, added?: number): string {
  const conflict = stockConflict(error);
  if (conflict) {
    if (conflict.available <= 0) return 'Sorry, this product is out of stock.';
    if (added === undefined) {
      return `Sorry, we have only ${conflict.available} of this product in stock.`;
    }
    const inCart = conflict.requested - added;
    return inCart > 0
      ? `You cannot add that amount to the cart - we have ${conflict.available} in stock and you already have ${inCart} in your cart.`
      : `You cannot add that amount to the cart - we have only ${conflict.available} in stock.`;
  }
  if (error instanceof ApiError) {
    if (error.status === 409) return 'Sorry, this product is not currently available.';
    if (error.status === 404) return 'That item is no longer in your cart.';
  }
  return 'We could not update your cart. Please check your connection and try again.';
}

/** Errors that will fail the same way on retry: the line is dropped rather than kept. */
function isPermanent(error: unknown): boolean {
  return error instanceof ApiError && [400, 404, 409, 422].includes(error.status);
}

export type MergeOutcome =
  | { kind: 'merged'; line: CartLine }
  | { kind: 'reduced'; line: CartLine; added: number }
  | { kind: 'dropped'; line: CartLine; reason: 'out_of_stock' | 'unavailable' };

export interface MergeResult {
  outcomes: MergeOutcome[];
  /** Lines not attempted because of a transient failure - put them back in the guest cart. */
  remaining: CartLine[];
}

/** Runs the merge described at the top of this file, one line at a time. */
export async function mergeGuestCart(
  lines: readonly CartLine[],
  addItem: (skuId: string, quantity: number) => Promise<unknown>,
): Promise<MergeResult> {
  const outcomes: MergeOutcome[] = [];
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index]!;
    try {
      await addItem(line.skuId, line.quantity);
      outcomes.push({ kind: 'merged', line });
      continue;
    } catch (error) {
      const conflict = stockConflict(error);
      if (conflict) {
        const room = conflict.available - (conflict.requested - line.quantity);
        if (room > 0) {
          try {
            await addItem(line.skuId, room);
            outcomes.push({ kind: 'reduced', line, added: room });
            continue;
          } catch (retryError) {
            if (!isPermanent(retryError)) return { outcomes, remaining: lines.slice(index) };
          }
        }
        outcomes.push({ kind: 'dropped', line, reason: 'out_of_stock' });
        continue;
      }
      if (isPermanent(error)) {
        outcomes.push({ kind: 'dropped', line, reason: 'unavailable' });
        continue;
      }
      return { outcomes, remaining: lines.slice(index) };
    }
  }
  return { outcomes, remaining: [] };
}

export interface MergeNotice {
  tone: 'success' | 'info';
  message: string;
  /** One line per product whose quantity changed or that could not be added. */
  details: string[];
}

/** What to tell the customer after a merge; null when there was nothing to merge. */
export function mergeNotice(result: MergeResult): MergeNotice | null {
  const kept = result.outcomes.filter((o) => o.kind !== 'dropped');
  const details = result.outcomes.flatMap((outcome) => {
    if (outcome.kind === 'reduced') {
      return [
        `Only ${outcome.added} of "${outcome.line.title}" could be added - that is all we have in stock.`,
      ];
    }
    if (outcome.kind === 'dropped') {
      return [
        outcome.reason === 'out_of_stock'
          ? `"${outcome.line.title}" could not be added - it is out of stock.`
          : `"${outcome.line.title}" could not be added - it is no longer available.`,
      ];
    }
    return [];
  });
  if (result.remaining.length > 0) {
    details.push('Some items could not be moved yet - they will be added next time you log in.');
  }
  if (kept.length === 0 && details.length === 0) return null;
  const count = kept.length;
  return {
    tone: details.length > 0 ? 'info' : 'success',
    message:
      count > 0
        ? `${count === 1 ? 'The product' : `The ${count} products`} you added before logging in ${count === 1 ? 'is' : 'are'} now in your cart.`
        : 'We could not add the products from before you logged in.',
    details,
  };
}
