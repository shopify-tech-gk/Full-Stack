# Settlement API Contract

**FROZEN as of `chapter-6-complete` (2026-09-24), originally frozen at
`chapter-5-complete`.** This is the stable
surface other services and the frontend build against. Changes after this
freeze must be additive where possible (new optional fields, new endpoints)
or require a version bump communicated to all consumers - do not silently
change a shape or status code of an endpoint listed here.

## Base URL

Settlement service (`@youmart/settlement-service`), port **4008** in dev
(`http://localhost:4008`).

## Common envelope

Same `ApiError` shape as [auth-api.md](./auth-api.md).

## Settlement rules (Ch6.7b: admin-service's authoritative settings row)

`getSettlementRules()` reads live from admin-service's platform settings
row via `@youmart/service-client`'s cached settings client (~30s TTL) -
replaces the retired `COMMISSION_ENABLED`/`COMMISSION_DEFAULT_PERCENT`/
`TCS_ENABLED`/`TCS_PERCENT`/`TDS_ENABLED`/`TDS_PERCENT` env vars:

- `commission.enabled`/`commission.defaultPercent` (a per-seller override via `commissionRatePercent`, set by seller-service's `POST /admin/sellers/:id/commission`, takes precedence when present)
- `tcs.enabled`/`tcs.percent`
- `tds.enabled`/`tds.percent`

**FAIL-CLOSED**: if the settings row is truly unreachable (no cache
exists), `getSettlementRules()` rethrows rather than guessing a rate - a
settlement run must never silently use a wrong/stale-beyond-recovery rate.
Verified live (Ch6.7b): changing `tcsPercent`/`tdsPercent` via
`PATCH /admin/settings` and re-running a real settlement against real
pre-existing delivered items produced `tcsAmount`/`tdsAmount` that exactly
matched the new rates.

## Exact money math

`computeSettlement` uses `@youmart/shared-utils`'s exact decimal-string
arithmetic (never floating point) for:

```
grossAmount     = sum(lineTotal for every settleable order_item)
commissionAmount = grossAmount * commissionRatePercent / 100   (if COMMISSION_ENABLED)
tcsAmount        = grossAmount * TCS_PERCENT / 100             (if TCS_ENABLED)
tdsAmount        = grossAmount * TDS_PERCENT / 100             (if TDS_ENABLED)
netPayable       = grossAmount - commissionAmount - tcsAmount - tdsAmount
```

Verified live (real integration test): `grossAmount=999.00`,
`commissionAmount=99.90` (10%), `tcsAmount=9.99` (1%), `tdsAmount=0.00`
(disabled), `netPayable=889.11` - matches the formula exactly.

A `net >= 0` guard throws (misconfiguration protection) if rates are set
such that net payable would go negative.

## Settleable items & idempotency

"Settleable" = an `order_item` with `sellerStatus = 'DELIVERED'` (the
`updatedAt` timestamp on that transition is used as a `deliveredAt` proxy -
order-service has no dedicated `deliveredAt` column yet), **excluding**
items already covered by a `settlement_line` (join against prior
settlements for that seller). Re-running `POST /admin/settlements/run` for
the same seller/period after everything has already been settled is a
safe no-op:

```json
{ "settled": false, "sellerId": "<uuid>", "reason": "NOTHING_TO_SETTLE" }
```

Verified live: same request body re-sent for the same period returned
exactly this no-op shape, no duplicate settlement row created.

## Endpoints

### `GET /health` / `GET /ready`

Same shape as [auth-api.md](./auth-api.md) (`service: "settlement"`;
`/ready` checks Postgres as the `settlements_svc` role).

### `POST /admin/settlements/run`

Requires `requireAdmin('settlements.manage')` (Ch6.7a real RBAC - separate
from `settlements.view`, which gates the read-only list/detail endpoints
below). Runs settlement for one seller (if `sellerId` given) or every
APPROVED+VERIFIED active seller (if omitted).

Request body: `{ periodStart: string (ISO datetime), periodEnd: string (ISO datetime), sellerId?: string (uuid) }`

- **200**:
  ```json
  {
    "results": [
      {
        "settled": true,
        "settlement": {
          "id": "<uuid>",
          "sellerId": "<uuid>",
          "periodStart": "<iso>",
          "periodEnd": "<iso>",
          "grossAmount": "999.00",
          "commissionAmount": "99.90",
          "tcsAmount": "9.99",
          "tdsAmount": "0.00",
          "netPayable": "889.11",
          "status": "PENDING",
          "razorpayPayoutId": null,
          "createdAt": "<iso>"
        }
      }
    ]
  }
  ```
  or, when there's nothing new to settle: `{ "settled": false, "sellerId": "<uuid>", "reason": "NOTHING_TO_SETTLE" }` per seller.

### `GET /admin/settlements` / `GET /admin/settlements/:id`

Lists/details settlements (admin view across all sellers).

### `GET /settlements/me`

Seller-facing list of the caller's own settlements (resolved via
seller-service's `by-owner/me`, never a client-supplied `sellerId`).

## The scheduled job has no service credential

`settlement.queue.ts` registers a weekly BullMQ job
(`Queue.upsertJobScheduler`, since bullmq@6.3.4 removed the legacy
`repeat` option) that calls `runSettlementForAllSellers`. **This scheduled
job has no service-to-service credential to call other services with**
(see [cross-cutting-notes.md](./cross-cutting-notes.md)) - if it fires
without one, it logs a warning and skips. The admin manual-trigger
endpoint (`POST /admin/settlements/run`) is the only path that actually
works today in dev, since it forwards a real admin's bearer token. This is
a known, documented Ch6/Ch7 gap, not a bug.

## Real integration-test evidence (chapter-5-complete)

A real end-to-end run computed a live settlement for one delivered item
(`grossAmount=999.00 -> netPayable=889.11`, exact math verified), then
re-ran the identical request and confirmed the idempotent
`NOTHING_TO_SETTLE` no-op response, with no duplicate row created.
