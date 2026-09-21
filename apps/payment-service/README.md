# @youmart/payment-service

Razorpay order creation + HMAC-verified, idempotent webhook handling.
Closes the checkout loop: on payment success, confirms the order and
commits held stock; on failure, cancels the order and releases stock.

## Raw body for webhook signature verification

Razorpay signs webhooks with `HMAC-SHA256(rawBody, RAZORPAY_WEBHOOK_SECRET)`.
`express.json()` parses the body into a JS object and discards the exact
original bytes, so signature verification needs the RAW bytes captured
separately. This service uses `express.json()`'s `verify` callback
(applied globally in `app.ts`) to stash the raw buffer on `req.rawBody`
before parsing - simpler than mounting a separate raw-body parser scoped to
just the webhook path, since only that one route ever reads it.

## Webhook security + idempotency (`POST /payments/webhook`, no `requireAuth`)

1. **Signature is the security boundary** - `HMAC-SHA256(req.rawBody,
RAZORPAY_WEBHOOK_SECRET)` compared to the `X-Razorpay-Signature` header
   with `crypto.timingSafeEqual` (constant-time). Invalid/missing signature
   -> `400`, and NOTHING is read/written beforehand.
2. **Idempotency** - `payment_webhook_event.event_id` (Razorpay's event id
   header if present, else a deterministic `event:paymentId` composite) is
   the dedupe key. An event already marked `processedAt` is a no-op `200`.
3. **Amount validation** - the captured amount (paise) must match the
   payment's own expected amount; a mismatch is rejected.
4. **Event handling** - `payment.captured` -> payment `CAPTURED` + `orderClient.confirmOrder`
   (which commits stock); `payment.failed` -> payment `FAILED` + `orderClient.cancelOrder`
   (which releases stock).

Kept synchronous and lean per Razorpay's expectation of a fast `200`; a job
queue for the confirm/commit fan-out would be a reasonable future upgrade
if this work ever became heavier.

## Money -> paise

Money ("1299.00") is split on the decimal point and combined as integers
(`rupees*100 + paise`) - never a floating-point `* 100`, which can drift
for some decimal values.

## Who owns confirm->commit-stock / cancel->release-stock

**order-service** does (`confirmOrder`/`cancelOrderForPaymentFailure` in
`order.service.ts`) - "order confirmed" and "stock committed" happen
together as one operation owned by the order domain. payment-service never
talks to inventory-service directly; it only calls order-service.

## Known gap: no service-to-service auth token

The webhook has no user/auth context at all (Razorpay calls it, not a
logged-in user), yet confirming/cancelling the order requires a bearer
token (the same `requireAuth` pattern every other internal endpoint in this
repo uses). This service caches the end-user's own token in-memory, keyed
by `razorpay_order_id`, from the `POST /payments/razorpay-order` call, and
reuses it when the webhook arrives. This is a documented stop-gap: it's
lost on process restart, and if the access token expires before the
webhook arrives, the confirm/cancel call 401s and the order needs manual
reconciliation. A real service-to-service credential should replace this.

## Database connection

Connects as the least-privilege `payments_svc` Postgres role - only the
`payments` schema.
