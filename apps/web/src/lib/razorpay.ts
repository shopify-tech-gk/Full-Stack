'use client';

// Razorpay Checkout (web): loads Razorpay's hosted checkout.js once and opens it for a server-created
// Razorpay order. Only the public key id and the Razorpay order id ever reach the browser.
import { RAZORPAY_CHECKOUT_SCRIPT, type razorpayCheckoutOptions } from '@youmart/shared-client';

interface RazorpayFailure {
  error?: { description?: string; reason?: string };
}

interface RazorpayInstance {
  open: () => void;
  on: (event: 'payment.failed', handler: (response: RazorpayFailure) => void) => void;
}

type RazorpayConstructor = new (
  options: ReturnType<typeof razorpayCheckoutOptions> & {
    handler: () => void;
    modal: { ondismiss: () => void; confirm_close: boolean };
  },
) => RazorpayInstance;

declare global {
  interface Window {
    Razorpay?: RazorpayConstructor;
  }
}

let loading: Promise<RazorpayConstructor> | null = null;

function loadCheckout(): Promise<RazorpayConstructor> {
  if (window.Razorpay) return Promise.resolve(window.Razorpay);
  loading ??= new Promise<RazorpayConstructor>((resolve, reject) => {
    const script = document.createElement('script');
    script.src = RAZORPAY_CHECKOUT_SCRIPT;
    script.async = true;
    script.onload = () =>
      window.Razorpay ? resolve(window.Razorpay) : reject(new Error('Razorpay unavailable'));
    script.onerror = () => reject(new Error('Razorpay Checkout could not load'));
    document.body.appendChild(script);
  }).catch((error: unknown) => {
    loading = null;
    throw error;
  });
  return loading;
}

export type CheckoutResult = { kind: 'paid' } | { kind: 'dismissed'; lastError: string | null };

/**
 * Opens Razorpay Checkout and resolves when the customer finishes: `paid` means Razorpay reported
 * success to the browser - NOT that the order is paid (the webhook decides; poll the order).
 * Failed attempts keep the modal open for a retry; their last message comes back on dismiss.
 */
export async function openRazorpayCheckout(
  options: ReturnType<typeof razorpayCheckoutOptions>,
): Promise<CheckoutResult> {
  const Razorpay = await loadCheckout();
  return new Promise((resolve) => {
    let lastError: string | null = null;
    const checkout = new Razorpay({
      ...options,
      handler: () => resolve({ kind: 'paid' }),
      modal: { ondismiss: () => resolve({ kind: 'dismissed', lastError }), confirm_close: true },
    });
    checkout.on('payment.failed', (response) => {
      lastError = response.error?.description ?? 'The payment was declined.';
    });
    checkout.open();
  });
}
