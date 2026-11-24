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

/** What Razorpay hands the success handler - sent to /payments/verify to confirm at once. */
export interface RazorpayProof {
  razorpayOrderId: string;
  razorpayPaymentId: string;
  razorpaySignature: string;
}

interface RazorpaySuccessResponse {
  razorpay_order_id?: string;
  razorpay_payment_id?: string;
  razorpay_signature?: string;
}

type RazorpayConstructor = new (
  options: ReturnType<typeof razorpayCheckoutOptions> & {
    handler: (response: RazorpaySuccessResponse) => void;
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

export type CheckoutResult =
  | { kind: 'paid'; proof: RazorpayProof | null }
  | { kind: 'dismissed'; lastError: string | null };

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
      handler: (response) =>
        resolve({
          kind: 'paid',
          proof:
            response?.razorpay_order_id && response.razorpay_payment_id && response.razorpay_signature
              ? {
                  razorpayOrderId: response.razorpay_order_id,
                  razorpayPaymentId: response.razorpay_payment_id,
                  razorpaySignature: response.razorpay_signature,
                }
              : null,
        }),
      modal: { ondismiss: () => resolve({ kind: 'dismissed', lastError }), confirm_close: true },
    });
    checkout.on('payment.failed', (response) => {
      lastError = response.error?.description ?? 'The payment was declined.';
    });
    checkout.open();
  });
}
