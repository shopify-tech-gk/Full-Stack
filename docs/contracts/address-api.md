# Address API Contract

**FROZEN as of `chapter-6-complete` (2026-09-24).** This is the stable
surface other services and the frontend build against. Changes after this
freeze must be additive where possible (new optional fields, new endpoints)
or require a version bump communicated to all consumers - do not silently
change a shape or status code of an endpoint listed here.

## Base URL

Address service (`@youmart/address-service`), port **4011** in dev
(`http://localhost:4011`). Public routes are reached through the gateway
at `/api/addresses/*` (Ch6.6).

## Common envelope

Same `ApiError` shape as [auth-api.md](./auth-api.md).

## Ownership model

Every address always belongs to the CALLER's own `req.auth.userId` - there
is no client-supplied `userId` anywhere in the public surface. `isDefault`
is per-user: setting a new default un-defaults any prior one in the same
transaction. `GET /` returns the default address first (if one exists).

## Endpoints

### `GET /health` / `GET /ready`

Same shape as [auth-api.md](./auth-api.md) (`service: "address"`; `/ready`
checks Postgres as the `addresses_svc` role).

### `GET /` (requireAuth)

Lists the caller's own addresses, default first. `{ items: Address[] }`.

### `GET /:id` (requireAuth)

One address by id - 404 if it doesn't exist or belongs to someone else.

### `POST /` (requireAuth)

Body: `{ fullName, phone, line1, line2?, landmark?, city, state, pincode, country?, addressType?, isDefault? }`.
`phone` must match `^\+[1-9]\d{7,14}$`; `pincode` must be exactly 6 digits
(India-only for launch). Returns `201` + the created address.

### `PATCH /:id` (requireAuth)

Partial update of the same fields as create. `200` + the updated address.

### `DELETE /:id` (requireAuth)

Soft-delete. `204` no body.

### `POST /:id/default` (requireAuth)

Sets this address as the caller's default (un-defaults any other). `200` +
the updated address.

### `GET /internal/for-order` (requireServiceAuth)

SERVICE-ONLY (Ch6.5) - order-service's checkout calls this to validate +
snapshot a SPECIFIC user's address at the moment of order creation.
Query params: `userId`, `addressId` (both explicit - the service token
authenticates the CALLER, not the subject). Registered before `/:id` so it
is never swallowed as an id. **Not reachable through the gateway** -
Ch6.6's gateway blocks any path containing an `/internal` segment,
verified live.

## Verified live (Ch6.8 end-to-end integration)

Real address created via `POST /api/addresses` through the gateway,
confirmed default-first ordering via `GET /api/addresses`, and consumed by
a real checkout's shipping-address snapshot (order-service's
`GET /internal/for-order` call, Ch6.1).
