# Payment API Contract

**FROZEN as of `chapter-6-complete` (2026-09-24), originally frozen at
`chapter-4-complete`.** This is the stable
surface other services and the frontend build against. Changes after this
freeze must be additive where possible (new optional fields, new endpoints)
or require a version bump communicated to all consumers - do not silently
change a shape or status code of an endpoint listed here.

## Base URL

Payment service (`@youmart/payment-service`), port **4006** in dev
(`http://localhost:4006`). No path prefix beyond what's listed below.
Integrates with Razorpay (SDK `2.9.8`, pinned exact - no official/`@types`
typings exist, a custom ambient `razorpay.d.ts` is hand-written).

## Common envelope

Same `ApiError` shape as [auth-api.md](./auth-api.md): `{ "error": { "code",
"message", "details"? } }`, same `ApiErrorCode` set, same 404/400/500
defaults for unmatched routes / validation failures / internal errors.

## Money <-> paise conversion

Razorpay's API operates in the smallest currency unit (paise for INR).
Conversion is always **exact integer string-splitting**
(`moneyToPaise`/`paiseToMoney` in `money-paise.ts`), **never**
`parseFloat(value) * 100` - a `Money` string is always
`"<digits>.<exactly 2 digits>"`, so splitting on `.` and combining as
integers avoids any IEEE-754 float drift.

## Endpoints

### `GET /health` / `GET /ready`

Same shape as [auth-api.md](./auth-api.md) (`service: "payment"`; `/ready`
checks Postgres as the `payments_svc` role).

### `POST /razorpay-order`

Creates (or reuses) a Razorpay order for a `PENDING_PAYMENT` order owned by
the caller. Requires `requireAuth`.

Request body: `{ orderId: string (uuid) }`

- **201**:
  ```json
  {
    "razorpayOrderId": "order_...",
    "razorpayKeyId": "rzp_...",
    "amount": 259800,
    "currency": "INR",
    "orderId": "<uuid>"
  }
  ```
  `razorpayKeyId` is the **public** key id (safe to hand to a client SDK -
  never the key secret). `amount` is in paise.
- **404** `NOT_FOUND`: no such order, or it belongs to a different user (never distinguished)
- **409** `CONFLICT`: `Cannot pay for an order in status <status>` - the order isn't `PENDING_PAYMENT`
- **500** `INTERNAL_ERROR`: Razorpay's own API call failed (e.g. invalid/placeholder credentials produce a genuine `401` from Razorpay, which is not an `AppError` and is converted to a generic 500 by the central error handler - this is intentional: internals of a third-party failure are never leaked as a specific status)

Reuses an existing `CREATED` payment's Razorpay order rather than creating a
duplicate on retries/page-refreshes (idempotent-ish, not a full idempotency
key system - same pragmatism as checkout's duplicate-click guard).

As soon as the order/ownership checks pass (**not** gated on the Razorpay
call itself succeeding), the caller's bearer token is cached in-memory,
keyed by `orderId` (`pendingAuthTokens`), so a later webhook call (which has
no user/auth context - Razorpay calls it, not a logged-in user) can still
call back into order-service to confirm/cancel. **Documented limitations:**
lost on process restart; if the access token has expired by the time the
webhook arrives (access tokens live 900s), the confirm/cancel call 401s and
the order needs manual reconciliation. A real service-to-service credential
should replace this in a later chapter.

### `POST /webhook`

Razorpay calls this directly - **no `requireAuth`**. The
`X-Razorpay-Signature` header, HMAC-SHA256 verified over the **raw request
body bytes** against `RAZORPAY_WEBHOOK_SECRET` (constant-time compare via
`timingSafeEqual`), is the entire security boundary here, not a bearer
token.

Headers consulted: `X-Razorpay-Signature` (required), `X-Razorpay-Event-Id`
(optional - falls back to a deterministic `event:paymentId` composite key
when absent, since Razorpay doesn't guarantee this header on every account
tier).

Request body (only fields this service reads; Razorpay's real payload has
many more, all ignored):

```
{
  event: string,               // e.g. "payment.captured" | "payment.failed"
  payload: { payment: { entity: { id: string, order_id: string, amount: number, status: string } } }
}
```

Processing order:

1. **Verify signature** - invalid/missing → `400 VALIDATION_ERROR`,
   nothing mutated (thrown before any DB read/write).
2. **Parse payload shape** - malformed → `400 VALIDATION_ERROR`.
3. **Idempotency**: an event id already marked processed → silent no-op
   success (Razorpay's retries must never double-confirm/double-commit).
4. **Amount validation**: the captured amount (paise) must match the
   payment row's own expected amount, else `400 VALIDATION_ERROR` (guards
   against a mismatched/tampered amount) - the event is still marked
   processed so retries don't loop.
5. **Apply the event**:
   - `payment.captured` → payment row set `CAPTURED` (+ `razorpayPaymentId`
     recorded) → `orderClient.confirmOrder` (commits stock, confirms order)
   - `payment.failed` → recorded only (W5): the order stays `PENDING_PAYMENT`
     with its stock held and the payment row stays `CREATED`, because Razorpay
     Checkout lets the customer retry the same Razorpay order. (Before W5 this
     cancelled the order, so "declined, then paid" ended as a refunded capture.)
   - An unrecognized `razorpay_order_id` (not one this service created) is
     marked processed with no further action.
   - The confirm call authenticates with a self-minted service token (Ch6.5;
     the old cached-user-token stop-gap is gone).

Both the payment-row update and the order confirm call are
themselves idempotent, so a retry that re-enters this handler (e.g. a crash
before the event was marked processed) is safe.

- **200**: `{ "received": true }` (always, once signature verification passes and the payload parses)
- **400** `VALIDATION_ERROR`: invalid/missing signature, malformed payload, or amount mismatch

## Local webhooks (W5)

Razorpay can't reach `localhost`, so a local stack gets the webhook in one of two ways:

1. **Tunnel (real delivery)**. Expose the gateway, e.g. `cloudflared tunnel --url http://localhost:4000`
   (or `ngrok http 4000`). In the Razorpay dashboard (Test mode → Settings → Webhooks) add
   `https://<tunnel-host>/api/payments/webhook` with the **same secret** as `RAZORPAY_WEBHOOK_SECRET`
   and the events `payment.captured` and `payment.failed`. Razorpay then signs and delivers every
   test payment's events itself. The tunnel URL changes on every restart unless it's a named tunnel.
2. **Local relay (no tunnel)**. After paying with a test card, run
   `pnpm dev:razorpay-webhook <razorpay_order_id>`. It fetches the REAL payment from the Razorpay
   TEST API and posts the matching `payment.captured` / `payment.failed` event to the local webhook,
   signed with `RAZORPAY_WEBHOOK_SECRET` exactly as Razorpay signs it (same handler, same checks).
   Test keys only; it refuses `NODE_ENV=production`, and never prints a secret.

Either way the storefront is unchanged: it polls `GET /api/orders/:id` until the order is
`CONFIRMED` and never treats Razorpay's browser callback as proof of payment.
