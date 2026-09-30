// Checkout + payment logic shared by web and mobile. Network calls are injected; nothing here
// touches the DOM or the Razorpay SDK itself.
//
// THE MONEY PATH
// 1. POST /api/orders/checkout { addressId } - the server reads the cart, re-prices every line from
//    the catalog, reserves stock and returns a PENDING_PAYMENT order. The client never sends items
//    or prices, so the amount can't be tampered with.
// 2. POST /api/payments/razorpay-order { orderId } - the server creates (or reuses) the Razorpay
//    order for the order's grand total and returns the PUBLIC key id + Razorpay order id.
// 3. Razorpay Checkout opens with only those two ids (`razorpayCheckoutOptions`); the amount shown
//    and charged is the Razorpay order's, set by the server.
// 4. The Razorpay success callback proves nothing: the signed `payment.captured` webhook confirms
//    the order server-side. The client only polls GET /api/orders/:id (`pollOrderStatus`) until
//    it is CONFIRMED.
import { ApiError } from './api-client';
import type { OrderView, RazorpayOrder } from './types';

/** Razorpay's hosted Checkout script (web). */
export const RAZORPAY_CHECKOUT_SCRIPT = 'https://checkout.razorpay.com/v1/checkout.js';

/** Polling after the Razorpay callback: every 2s, giving the webhook up to 90s to land. */
export const PAYMENT_POLL = { intervalMs: 2000, timeoutMs: 90_000 } as const;

export interface RazorpayPrefill {
  name?: string;
  email?: string;
  contact?: string;
}

/** Razorpay Checkout options: server ids only - no client amount (Razorpay uses the order's). */
export function razorpayCheckoutOptions(
  payment: RazorpayOrder,
  order: Pick<OrderView, 'orderNumber'>,
  prefill: RazorpayPrefill,
  brandColor: string,
) {
  return {
    key: payment.razorpayKeyId,
    order_id: payment.razorpayOrderId,
    currency: payment.currency,
    name: 'YouMart',
    description: `Order ${order.orderNumber}`,
    prefill,
    notes: { orderNumber: order.orderNumber },
    theme: { color: brandColor },
  };
}

export type PollOutcome =
  | { kind: 'confirmed'; order: OrderView }
  | { kind: 'cancelled'; order: OrderView }
  | { kind: 'timeout' }
  | { kind: 'aborted' };

/**
 * Polls the order until the webhook has settled it. Transient errors (network, 5xx) are retried
 * until the timeout; `signal` stops it (component unmounted / user left).
 */
export async function pollOrderStatus(
  getOrder: () => Promise<OrderView>,
  options: { intervalMs: number; timeoutMs: number; signal?: AbortSignal },
): Promise<PollOutcome> {
  const deadline = Date.now() + options.timeoutMs;
  while (!options.signal?.aborted) {
    try {
      const order = await getOrder();
      if (order.status === 'CONFIRMED') return { kind: 'confirmed', order };
      if (order.status === 'CANCELLED') return { kind: 'cancelled', order };
    } catch (error) {
      if (error instanceof ApiError && error.status === 404) throw error;
    }
    if (Date.now() + options.intervalMs > deadline) return { kind: 'timeout' };
    await new Promise((resolve) => setTimeout(resolve, options.intervalMs));
  }
  return { kind: 'aborted' };
}

/** Customer-facing text for a failed "Place order" (POST /api/orders/checkout). */
export function placeOrderErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.status === 409) return `${error.message}. Please update your cart and try again.`;
    if (error.status === 404) return 'That delivery address is no longer available.';
    if (error.status === 429) return 'Too many attempts. Please wait a few minutes and try again.';
    if (error.status === 400 && /cart is empty/i.test(error.message)) return 'Your cart is empty.';
    if (error.status === 400) return error.message;
  }
  return 'We could not place your order. Please check your connection and try again.';
}

/** Customer-facing text when the payment could not be started or finished. */
export function paymentErrorMessage(error: unknown): string {
  if (error instanceof ApiError && error.status === 409) {
    return 'This order can no longer be paid for. Please check your orders.';
  }
  return 'We could not start the payment. Please try again in a moment.';
}
