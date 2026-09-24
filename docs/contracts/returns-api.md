# Returns API Contract

**FROZEN as of `chapter-6-complete` (2026-09-24), originally frozen at
`chapter-5-complete`.** This is the stable
surface other services and the frontend build against. Changes after this
freeze must be additive where possible (new optional fields, new endpoints)
or require a version bump communicated to all consumers - do not silently
change a shape or status code of an endpoint listed here.

## Base URL

Returns service (`@youmart/returns-service`), port **4010** in dev
(`http://localhost:4010`). Newest of the 10 launch services.

## Common envelope

Same `ApiError` shape as [auth-api.md](./auth-api.md).

## Return lifecycle

```
REQUESTED -> APPROVED -> PICKED_UP -> REFUNDED
      \-> REJECTED (-> may resubmit a new REQUESTED)
```

`BLOCKING_RETURN_STATUSES = ['REQUESTED', 'APPROVED', 'PICKED_UP', 'REFUNDED']`

- a buyer cannot open a second return on the same order_item while one is
  in any of these states; only after a `REJECTED` outcome can they resubmit.

## `requestReturn` guards

- Ownership: the order_item must belong to the caller (via
  `orderClient.getInternalOrderItem`, resolved server-side - never a
  trusted client-supplied user id).
- Status: the order_item's `sellerStatus` must be `DELIVERED`.
- Return window: must be within `RETURN_WINDOW_DAYS` (env, default `7`)
  of the `DELIVERED` transition.
- No duplicate: rejected if a blocking-status return already exists for
  the same order_item (see above).

## `approveReturn` refund amount

Defaults `refundAmount` to the order_item's own `lineTotal`; an admin may
instead specify a partial amount, validated `<= lineTotal`. Verified live:
omitting the field on approve defaulted correctly to the full
`lineTotal` (`999.00`).

## `processRefund`: the money-correctness core

Order of operations (deliberate, documented):

1. **`paymentClient.createRefund` first** - the one genuinely irreversible
   external step. If Razorpay itself is unreachable/blocked (e.g.
   placeholder dev credentials), the refund record is still created with
   `status: 'FAILED'` and `blocked: true` returned - **never faked as a
   success**. Verified live: with the project's real (placeholder)
   Razorpay credentials, the refund correctly came back
   `status: "FAILED", razorpayRefundId: null, blocked: true`.
2. **Then** `inventoryClient.restock` + `orderClient.setSellerItemStatus('RETURNED')`
   - retryable internal steps, applied **regardless** of whether step 1
     actually moved money, so the platform-side state (stock, order status)
     stays consistent even when the payment provider is down.
3. Return status is set to `REFUNDED` last.

Idempotency: rejects (`409 CONFLICT`) if `status` is already `'REFUNDED'` -
a retried `process-refund` call cannot double-restock or double-refund.

## Endpoints

### `GET /health` / `GET /ready`

Same shape as [auth-api.md](./auth-api.md) (`service: "returns"`;
`/ready` checks Postgres as the `returns_svc` role).

### `POST /returns`

Requires `requireAuth`. Body: `{ orderItemId: string (uuid), reason: string }`.

- **201**:
  ```json
  {
    "id": "<uuid>",
    "orderItemId": "<uuid>",
    "userId": "<uuid>",
    "reason": "string",
    "status": "REQUESTED",
    "refundAmount": null,
    "createdAt": "<iso>",
    "updatedAt": "<iso>"
  }
  ```
- **404** `NOT_FOUND`: order_item doesn't exist or isn't the caller's own
- **409** `CONFLICT`: not yet `DELIVERED`, outside the return window, or a blocking return already exists

### `GET /returns` / `GET /returns/:id`

Caller's own returns, paginated / by id.

### `POST /admin/returns/:id/approve`

Requires `requireAdmin('returns.manage')` (Ch6.7a real RBAC - workflow
actions; the separate `process-refund` endpoint below requires
`refunds.manage` instead, so an OPS admin can run the workflow without
being able to trigger money movement). Body: `{ refundAmount?: string }` (an empty JSON object `{}` is a valid body - `refundAmount` is optional and defaults to the line total).

- **200**: return detail, `status: "APPROVED"`, `refundAmount` populated

### `POST /admin/returns/:id/reject`

Body: `{ reason?: string }`. `status -> "REJECTED"`.

### `POST /admin/returns/:id/picked-up`

Body: `{}` (no fields). `status -> "PICKED_UP"`.

### `POST /admin/returns/:id/process-refund`

Body: `{}` (no fields). Executes the `processRefund` sequence above.

- **200**:
  ```json
  {
    "return": { "...": "status: REFUNDED" },
    "refund": {
      "refundId": "<uuid>",
      "paymentId": "<uuid>",
      "amount": "999.00",
      "status": "FAILED",
      "razorpayRefundId": null,
      "blocked": true
    },
    "restocked": { "skuId": "<uuid>", "available": 50, "reserved": 0 }
  }
  ```
  `refund.blocked: true` / `status: "FAILED"` is the **honest, expected**
  outcome with placeholder Razorpay credentials - not a bug, and not
  silently reported as success.
- **409** `CONFLICT`: already `REFUNDED` (idempotency guard)

### `GET /admin/returns`

Admin list across all sellers/buyers, paginated.

## Real integration-test evidence (chapter-5-complete)

A real end-to-end run: buyer requested a return on a real `DELIVERED`
item, admin approved (default full `refundAmount`), marked picked up, then
processed the refund - confirming `refund.blocked: true`/`FAILED` (honest,
Razorpay-blocked), `restocked.available` correctly incremented back, and
`order_item.sellerStatus` reaching `RETURNED`.
