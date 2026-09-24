# Seller API Contract

**FROZEN as of `chapter-6-complete` (2026-09-24), originally frozen at
`chapter-5-complete`.** This is the stable
surface other services and the frontend build against. Changes after this
freeze must be additive where possible (new optional fields, new endpoints)
or require a version bump communicated to all consumers - do not silently
change a shape or status code of an endpoint listed here.

## Base URL

Seller service (`@youmart/seller-service`), port **4007** in dev
(`http://localhost:4007`).

## Common envelope

Same `ApiError` shape as [auth-api.md](./auth-api.md): `{ "error": { "code",
"message", "details"? } }`, same `ApiErrorCode` set, same 404/400/500
defaults for unmatched routes / validation failures / internal errors.

## The marketplace hard-off gate

Self-registration (`POST /sellers/register`) is gated by
`assertMarketplaceOpen()` (`marketplace-gate.ts`), which reads
`marketplace_mode` from admin-service's authoritative settings row via
`@youmart/service-client`'s cached settings client (Ch6.7b - replaces the
retired `MARKETPLACE_MODE` env var; see
[admin-api.md](./admin-api.md)/[cross-cutting-notes.md](./cross-cutting-notes.md)).
Launch default is `DISABLED` (single-vendor) - in that mode the endpoint
always returns `403 FORBIDDEN` with message `"Seller registration is
currently disabled"`, verified live multiple times (Ch5, re-confirmed
Ch6.7b and Ch6.8): real `PATCH /admin/settings` toggle, real token, real
`403`/`201` responses in both directions, with NO env change or redeploy.
**Fails CLOSED** (`DISABLED`) if the settings row is truly unreachable and
no cached value exists - verified live (Ch6.7b). Admin-driven seller
management
(approve/reject/suspend/reinstate/KYC) is **not** gated by this toggle - an
admin can manage any already-existing seller regardless of whether
self-registration is currently open.

## `isSellerActive` resolution

A seller is considered **active** (usable to sell - list products, receive
orders) only when **both**:

- `seller.status === 'APPROVED'`, and
- `seller.kycStatus === 'VERIFIED'`

This is the single source of truth other services rely on via
`GET /sellers/internal/:id/active` and `GET /sellers/internal/by-owner/me`

- catalog-service's `requireActiveSeller` middleware and order-service's
  seller-scoped routes both resolve seller identity this way, never by
  trusting a client-supplied `sellerId`.

## Endpoints

### `GET /health` / `GET /ready`

Same shape as [auth-api.md](./auth-api.md) (`service: "seller"`; `/ready`
checks Postgres as the `sellers_svc` role).

### `POST /sellers/register`

Registers the caller as a seller. Requires `requireAuth`. Gated by the
marketplace hard-off toggle (see above).

Request body: `{ displayName: string }`

- **201** (actually returns the created seller synchronously, no explicit
  status override observed beyond the framework default success path):
  ```json
  {
    "id": "<uuid>",
    "displayName": "string",
    "legalName": null,
    "status": "PENDING",
    "isDefaultSeller": false,
    "commissionRatePercent": "10.00",
    "ownerUserId": "<uuid>",
    "createdAt": "<iso>"
  }
  ```
- **403** `FORBIDDEN`: `"Seller registration is currently disabled"` (marketplace hard-off)
- **409** `CONFLICT`: caller already owns a seller (one-seller-per-user), or `displayName` already taken

### `GET /sellers/me`

Returns the caller's own seller identity. Requires `requireAuth`.

- **200**: same seller shape as above
- **404** `NOT_FOUND`: caller doesn't own a seller

### `POST /sellers/me/kyc`

Submits/updates KYC for the caller's own seller. Requires `requireAuth`.
Bank account numbers are hashed (HMAC-SHA256, `hash.util.ts`) before
storage - never stored or returned in plaintext.

Request body: `{ gstin?: string, pan?: string, bankAccountNumber: string, bankIfsc: string }`

- **200**:
  ```json
  {
    "sellerId": "<uuid>",
    "kycStatus": "PENDING",
    "gstin": "string|null",
    "pan": "string|null",
    "bankIfsc": "string",
    "submittedAt": "<iso>",
    "verifiedAt": null
  }
  ```
  Resets `kycStatus` to `PENDING` on every (re)submission - a prior
  `VERIFIED`/`REJECTED` state does not persist across a new submission.

### `GET /sellers/internal/:id/active`

Internal, service-to-service read (catalog-service, order-service). No
`requireAuth`-forwarded ownership check beyond auth itself - any
authenticated caller can check any seller id's active status (this is
intentionally public-within-the-platform information, not sensitive).

- **200**:
  ```json
  {
    "active": true,
    "status": "APPROVED",
    "kycStatus": "VERIFIED",
    "commissionRatePercent": "10.00"
  }
  ```
- **404** `NOT_FOUND`: no such seller

### `GET /sellers/internal/by-owner/me`

Resolves the **caller's own** seller identity by their `ownerUserId` (the
forwarded end-user token's `sub`) - used by catalog-service's
`requireActiveSeller` middleware to attach `req.sellerId` server-side,
never trusting a client-supplied value. Requires `requireAuth`.

- **200**: `{ active, sellerId, status, kycStatus, commissionRatePercent }`
- **403** `FORBIDDEN`: `"seller not active"` if the caller owns no seller, or their seller isn't active

### `GET /sellers/internal/active-list`

Internal, service-to-service read (settlement-service's weekly job
iterates every active seller). Returns every seller where `isSellerActive`
is true.

- **200**: `{ items: [{ sellerId, commissionRatePercent }, ...] }`

## Admin endpoints (`/admin/sellers/*`)

Every route requires `requireAdmin('sellers.approve')` (Ch6.7a real RBAC -
**DORMANT MULTIVENDOR permission**, granted to `SUPER_ADMIN` only, not
exercised at single-vendor launch) except the two KYC routes below, which
require the separate `sellers.kyc` permission - **not** the marketplace
hard-off gate.

### `GET /admin/sellers`

Lists sellers, paginated. Query: standard pagination + optional status filters.

### `POST /admin/sellers/:id/approve`

Transitions `status` to `APPROVED`. Verified live (real integration test):
`PENDING -> APPROVED`.

### `POST /admin/sellers/:id/reject`

Body: `{ reason?: string }`. Transitions `status` to `REJECTED`.

### `POST /admin/sellers/:id/suspend` / `POST /admin/sellers/:id/reinstate`

Toggles an already-approved seller's ability to trade without re-running
the full approval workflow.

### `POST /admin/sellers/:id/kyc/verify`

**Note the real path is `/kyc/verify`, not `/kyc-verify`** - verified live
during integration testing (a `/kyc-verify` call 404s). Transitions
`kycStatus` to `VERIFIED`, stamps `verifiedAt`.

### `POST /admin/sellers/:id/kyc/reject`

Body: `{ reason?: string }`. Transitions `kycStatus` to `REJECTED`.

### `POST /admin/sellers/:id/commission`

Body: `{ commissionRatePercent: string }`. Sets the seller's own commission
override, consulted by settlement-service's rule resolution (see
[settlement-api.md](./settlement-api.md)).

## Real integration-test evidence (chapter-5-complete)

A real end-to-end run (`chapter-5-complete` closing integration test)
exercised, with real tokens against live services:

1. Hard-off gate: `MARKETPLACE_MODE=DISABLED` -> `POST /sellers/register` -> real `403 FORBIDDEN`.
2. Full onboarding with `MARKETPLACE_MODE=ENABLED`: register -> `PENDING`, KYC submit -> `PENDING`, admin approve -> `APPROVED`, admin KYC verify -> `VERIFIED`, `GET /sellers/internal/:id/active` -> `{ active: true }`.

(`MARKETPLACE_MODE` was later retired, Ch6.7b - the SAME toggle behavior
above now comes from `PATCH /admin/settings {marketplaceMode}`, not an env
var; re-verified with real requests in the `chapter-6-complete` closing
integration test.)
