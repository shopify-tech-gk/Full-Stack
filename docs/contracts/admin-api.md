# Admin API Contract (login, RBAC, platform settings)

**FROZEN as of `chapter-6-complete` (2026-09-24).** This is the stable
surface other services and the frontend build against. Changes after this
freeze must be additive where possible (new optional fields, new endpoints)
or require a version bump communicated to all consumers - do not silently
change a shape or status code of an endpoint listed here.

## Base URL

Admin service (`@youmart/admin-service`), port **4015** in dev
(`http://localhost:4015`). Public routes are reached through the gateway
at `/api/admin/*` (mounted LAST in the gateway's routing table so it never
swallows the four more specific `/api/admin/<x>` prefixes that route to
OTHER services' admin sub-routers - seller/settlement/returns/invoice).

## Identity model

Admins are STAFF, distinct from customers: email + bcrypt-hashed password
login (never OTP). Admin JWTs reuse the SAME RS256 keypair as customer
access tokens, distinguished ONLY by a `typ:"admin"` claim (+ a `role`
claim) - a customer token can never pass `requireAdmin`, and an admin
token can never pass `requireAuth` (verified live both directions).
Access-token-only (no refresh) - 8h TTL, staff re-log-in when it expires.

## RBAC model

`admin.admin_role` enum (`SUPER_ADMIN`|`OPS`|`SUPPORT`|`FINANCE`) is the
coarse label on each `Admin` row. Separate `role`/`permission`/
`role_permission` tables are seeded with the SAME data for auditability
(SQL-queryable), but the ACTUAL per-request enforcement is an in-code
static `ROLE_PERMISSIONS` map (`@youmart/auth-middleware`'s `adminAuth.ts`)

- zero DB calls per permission check.

| Role          | Permissions                                                                                                    |
| ------------- | -------------------------------------------------------------------------------------------------------------- |
| `SUPER_ADMIN` | every permission, including dormant multivendor ones                                                           |
| `OPS`         | `catalog.manage`, `orders.manage`, `inventory.manage`, `fulfillment.manage`, `returns.manage`, `search.manage` |
| `FINANCE`     | `invoices.view`, `invoices.manage`, `refunds.manage`, `settlements.view`                                       |
| `SUPPORT`     | none yet (enum value exists, dormant/unused)                                                                   |

Dormant multivendor permissions (`sellers.approve`, `sellers.kyc`) are
granted to `SUPER_ADMIN` only - not exercised at single-vendor launch
(seller self-registration is hard-off by default, see below).

## Endpoints

### `GET /health` / `GET /ready`

Same shape as [auth-api.md](./auth-api.md) (`service: "admin"`; `/ready`
checks Postgres as the `admin_svc` role).

### `POST /admin/login`

Body: `{ email, password }`. Rate-limited (15min window, 10 attempts).
Returns `{ accessToken, expiresIn, admin: {id, email, name, role,
permissions} }`. Wrong email/password -> generic 401 (never reveals
which).

### `GET /admin/me` (requireAdmin())

The logged-in admin's own profile + resolved permissions.

### `POST /admin/admins` (requireAdmin('admins.manage'))

Creates a new staff account. Body: `{ email, name, password, role }`.

### `GET /admin/admins` (requireAdmin('admins.manage'))

Cursor-paginated list of staff accounts.

### `POST /admin/admins/:id/deactivate` (requireAdmin('admins.manage'))

Soft-deletes a staff account.

### `GET /admin/settings` (requireAdmin())

Any logged-in admin may VIEW settings. Returns:

```json
{
  "marketplaceMode": "ENABLED" | "DISABLED",
  "commission": { "enabled": true, "defaultPercent": "10.00" },
  "tcs": { "enabled": true, "percent": "1.00" },
  "tds": { "enabled": false, "percent": "0.00" },
  "updatedAt": "..."
}
```

### `PATCH /admin/settings` (requireAdmin('settings.manage'))

Partial update of any subset of the same fields (percents validated
0-100). Returns the updated settings. **This is THE marketplace on/off
switch** - flipping `marketplaceMode` here changes seller-service's
hard-off gate behavior with NO code change, NO redeploy, NO env edit
(within the settings client's ~30s cache TTL). Verified live BOTH
directions (Ch6.7b, re-confirmed Ch6.8): `DISABLED` -> registration 403;
`ENABLED` -> registration 201; flipped back -> 403 again. **Marketplace
stays `DISABLED` by default (launch default)**.

### `GET /admin/internal/settings` (requireServiceAuth, Ch6.5)

SERVICE-ONLY - every other service's `@youmart/service-client` settings
client fetches from here (cached, ~30s TTL, fail-closed on unavailability

- see [service-auth.md](./service-auth.md)). **Not reachable through the
  gateway** (the `/internal` segment is blocked, verified live).

## Verified live (Ch6.8 end-to-end integration)

`SUPER_ADMIN` login -> real admin token (`typ:"admin"`, `role:
"SUPER_ADMIN"`); `GET`/`PATCH /admin/settings` both work and persist
(psql-confirmed); an `OPS` admin attempting `PATCH /admin/settings` (lacks
`settings.manage`) -> `403 FORBIDDEN`.
