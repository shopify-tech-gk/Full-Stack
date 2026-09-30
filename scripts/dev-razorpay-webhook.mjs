// DEV ONLY - delivers a Razorpay webhook to the LOCAL stack when Razorpay can't reach it (no tunnel).
// It reads the REAL payment for a Razorpay order from the Razorpay TEST API, then POSTs the same
// event Razorpay would send (payment.captured / payment.failed, the real payment entity) to the
// local gateway, signed with RAZORPAY_WEBHOOK_SECRET exactly like Razorpay signs it.
// Usage: pnpm dev:razorpay-webhook <razorpay_order_id>
// With a tunnel (docs/contracts/payment-api.md, "Local webhooks") Razorpay delivers the webhook
// itself and this isn't needed. Secrets are read from .env and never printed.
import { createHmac } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
process.loadEnvFile(path.join(root, '.env'));
const env = process.env;

if (env.NODE_ENV === 'production' || !env.RAZORPAY_KEY_ID?.startsWith('rzp_test_')) {
  console.error('dev-razorpay-webhook runs only locally with Razorpay TEST keys.');
  process.exit(1);
}
const razorpayOrderId = (process.argv[2] ?? '').trim();
if (!/^order_[A-Za-z0-9]+$/.test(razorpayOrderId)) {
  console.error('Usage: pnpm dev:razorpay-webhook <razorpay_order_id>  (e.g. order_Pq1...)');
  process.exit(1);
}

const auth = Buffer.from(`${env.RAZORPAY_KEY_ID}:${env.RAZORPAY_KEY_SECRET}`).toString('base64');
const res = await fetch(`https://api.razorpay.com/v1/orders/${razorpayOrderId}/payments`, {
  headers: { authorization: `Basic ${auth}` },
});
if (!res.ok) {
  console.error(`Razorpay API: HTTP ${res.status}`);
  process.exit(1);
}
const { items = [] } = await res.json();
// The captured payment settles the order; otherwise relay the latest failed attempt.
const payment =
  items.find((p) => p.status === 'captured') ?? items.find((p) => p.status === 'failed');
if (!payment) {
  const seen = items.map((p) => p.status).join(', ') || 'none';
  console.error(`No captured/failed payment on ${razorpayOrderId} yet (payments: ${seen}).`);
  process.exit(1);
}

const event = `payment.${payment.status}`;
const body = JSON.stringify({
  entity: 'event',
  event,
  contains: ['payment'],
  payload: { payment: { entity: payment } },
  created_at: Math.floor(Date.now() / 1000),
});
const signature = createHmac('sha256', env.RAZORPAY_WEBHOOK_SECRET).update(body).digest('hex');
const gateway = env.GATEWAY_URL || 'http://localhost:4000';
const delivered = await fetch(`${gateway}/api/payments/webhook`, {
  method: 'POST',
  headers: { 'content-type': 'application/json', 'x-razorpay-signature': signature },
  body,
});

console.log(
  `Razorpay TEST API: ${payment.id} ${payment.status} ${payment.amount} paise (${payment.method})`,
);
console.log(`${event} -> local webhook: HTTP ${delivered.status} ${await delivered.text()}`);
process.exit(delivered.ok ? 0 : 1);
