// Razorpay Checkout (checkout.js) inside a WebView - Expo-Go compatible. The app never sees the
// secret, only the public key id + a Razorpay order id from the backend. Shared by order payment
// and wallet top-ups (W9). Confirmation is always server-side (webhook) - callers poll for it.

export interface RazorpayCheckoutOptions {
  keyId: string;
  razorpayOrderId: string;
  /** Paise. */
  amount: number;
  currency: string;
  description: string;
  /** The signed-in customer - shown as "Using as" in Checkout. Without it Razorpay falls back to
   * whichever contact it remembered on this device from an earlier payment. */
  prefill?: { name?: string | null; email?: string | null; contact?: string | null };
}

/** The customer's own details for Razorpay Checkout (only the fields we know). */
export function razorpayPrefill(user: {
  name: string | null;
  email: string | null;
  phone: string | null;
}): RazorpayCheckoutOptions['prefill'] {
  return { name: user.name, email: user.email, contact: user.phone };
}

/** Razorpay Checkout's success response - verified server-side (POST /api/payments/verify). */
export interface RazorpaySuccess {
  razorpayOrderId: string;
  razorpayPaymentId: string;
  razorpaySignature: string;
}

/** Messages the page posts back: success (with the response) / failed / dismiss. */
export type RazorpayMessage =
  { type: 'success'; payment: RazorpaySuccess | null } | { type: 'failed' } | { type: 'dismiss' };

export function razorpayCheckoutHtml(opts: RazorpayCheckoutOptions): string {
  const prefill = Object.fromEntries(
    Object.entries(opts.prefill ?? {}).filter(([, v]) => typeof v === 'string' && v.length > 0),
  );
  return `<!doctype html><html><head><meta name="viewport" content="width=device-width, initial-scale=1" />
<script src="https://checkout.razorpay.com/v1/checkout.js"></script></head>
<body style="margin:0;background:#dcf0fa;font-family:sans-serif">
<script>
  function post(m){ window.ReactNativeWebView && window.ReactNativeWebView.postMessage(JSON.stringify(m)); }
  var opened=false;
  function open(){
    if(opened) return; opened=true;
    var rzp = new Razorpay({
      key: ${JSON.stringify(opts.keyId)},
      order_id: ${JSON.stringify(opts.razorpayOrderId)},
      amount: ${opts.amount},
      currency: ${JSON.stringify(opts.currency)},
      name: 'YouMart',
      description: ${JSON.stringify(opts.description)},
      prefill: ${JSON.stringify(prefill)},
      // Never reuse a contact remembered from another account's payment on this device.
      remember_customer: false,
      theme: { color: '#0142aa' },
      handler: function(r){ post({ type: 'success', payment: r }); },
      modal: { ondismiss: function(){ post({ type: 'dismiss' }); }, escape: true }
    });
    rzp.on('payment.failed', function(r){ post({ type: 'failed', error: r.error }); });
    rzp.open();
  }
  if (window.Razorpay) open(); else window.onload = open;
</script></body></html>`;
}

export function parseRazorpayMessage(data: string): RazorpayMessage | null {
  try {
    const msg = JSON.parse(data) as {
      type?: string;
      payment?: {
        razorpay_order_id?: unknown;
        razorpay_payment_id?: unknown;
        razorpay_signature?: unknown;
      };
    };
    if (msg.type === 'success') {
      const p = msg.payment;
      const ok =
        typeof p?.razorpay_order_id === 'string' &&
        typeof p.razorpay_payment_id === 'string' &&
        typeof p.razorpay_signature === 'string';
      return {
        type: 'success',
        payment: ok
          ? {
              razorpayOrderId: p.razorpay_order_id as string,
              razorpayPaymentId: p.razorpay_payment_id as string,
              razorpaySignature: p.razorpay_signature as string,
            }
          : null,
      };
    }
    if (msg.type === 'failed' || msg.type === 'dismiss') {
      return { type: msg.type };
    }
  } catch {
    /* ignore malformed */
  }
  return null;
}
