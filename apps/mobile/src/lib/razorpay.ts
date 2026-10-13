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
}

/** Messages the page posts back: success / failed / dismiss. */
export type RazorpayMessage = { type: 'success' } | { type: 'failed' } | { type: 'dismiss' };

export function razorpayCheckoutHtml(opts: RazorpayCheckoutOptions): string {
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
    const msg = JSON.parse(data) as { type?: string };
    if (msg.type === 'success' || msg.type === 'failed' || msg.type === 'dismiss') {
      return { type: msg.type };
    }
  } catch {
    /* ignore malformed */
  }
  return null;
}
