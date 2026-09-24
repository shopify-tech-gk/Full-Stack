# API Gateway Contract (the public surface)

**FROZEN as of `chapter-6-complete` (2026-09-24).** This is the stable
surface the frontend builds against. Changes after this freeze must be
additive where possible (new prefixes, new optional fields) or require a
version bump communicated to all consumers.

## Base URL

`api-gateway` (`@youmart/api-gateway`), port **4000** - the ONE public
port. The frontend (and every example in this doc set) calls ONLY this
URL; it never talks to any of the 15 backend services' own ports
directly. Gateway itself is a pure proxy - no database, no `_svc` role, no
JWT verification of its own (services keep verifying their own auth -
defense in depth, not replaced).

## Routing table (`/api/<prefix>` -> service)

`pathRewrite` strips ONLY the leading `/api` - every downstream service
already mounts its own routers at a path matching this prefix.

| Public prefix            | Target service            | Notes                                                                                                                    |
| ------------------------ | ------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `/api/auth`              | auth-service (4001)       | login/OTP/session                                                                                                        |
| `/api/catalog`           | catalog-service (4002)    | public browse + seller/admin writes                                                                                      |
| `/api/inventory`         | inventory-service (4003)  | admin stock-set op only; its other route stays SERVICE-ONLY even though reachable by path                                |
| `/api/cart`              | cart-service (4004)       |                                                                                                                          |
| `/api/orders`            | order-service (4005)      | ALWAYS-AUTHENTICATED at the gateway (fast-fail 401 if no token at all)                                                   |
| `/api/payments`          | payment-service (4006)    | includes the Razorpay webhook - raw body preserved (see below)                                                           |
| `/api/sellers`           | seller-service (4007)     | includes the marketplace hard-off gate                                                                                   |
| `/api/logistics`         | logistics-service (4009)  |                                                                                                                          |
| `/api/returns`           | returns-service (4010)    |                                                                                                                          |
| `/api/addresses`         | address-service (4011)    | ALWAYS-AUTHENTICATED at the gateway                                                                                      |
| `/api/search`            | search-service (4013)     | public, unauthenticated                                                                                                  |
| `/api/invoices`          | invoice-service (4014)    |                                                                                                                          |
| `/api/settlements`       | settlement-service (4008) |                                                                                                                          |
| `/api/admin/sellers`     | seller-service (4007)     | admin sub-router, mounted at `/admin/sellers` on the backend                                                             |
| `/api/admin/settlements` | settlement-service (4008) | admin sub-router, mounted at `/admin/settlements`                                                                        |
| `/api/admin/returns`     | returns-service (4010)    | admin sub-router, mounted at `/admin/returns`                                                                            |
| `/api/admin/invoices`    | invoice-service (4014)    | admin sub-router, mounted at `/admin/invoices`                                                                           |
| `/api/admin`             | admin-service (4015)      | registered LAST - never swallows the 4 more specific `/api/admin/<x>` prefixes above; login/me/admin-management/settings |

`notification-service` (4012) is NOT routed at all - it has no HTTP
surface (pure BullMQ consumer), nothing for a frontend to call.

## `/internal/*` exclusion

Every service's `/internal/*` (or, for a couple of services, an
un-prefixed but still `requireServiceAuth`-gated route) is service-to-
service only (Ch6.5, HS256 tokens) and must NEVER be reachable through
this public gateway. Enforced by a global regex check
(`/(^|\/)internal(\/|$)/`) running BEFORE any proxy route is even
registered - independent of the routing table above, so it can't be
bypassed by prefix trickery. Verified live (Ch6.6, re-confirmed Ch6.8):
`/api/orders/internal/...` and `/api/catalog/internal/...` both -> gateway's
own `404 {"code":"NOT_FOUND"}`, never reaching the real service.

## Cross-cutting behavior

- **CORS**: centralized (`CORS_ALLOWED_ORIGINS` env), allowed origins get
  `Access-Control-Allow-Origin`, others don't.
- **Rate limiting**: coarse IP-level backstop (`express-rate-limit`,
  default 300/60s), 429 with a `RATE_LIMITED` `ApiError` envelope.
- **Request tracing**: `x-request-id` generated if absent, forwarded
  downstream unchanged, echoed back to the client - correlates gateway and
  service logs for one request (grep the same id across both).
- **Health aggregation**: `GET /health` (gateway's own liveness, always 200) and `GET /health/services` (pings every downstream's own `/health`
  in parallel, reports per-service up/down).
- **Downstream-unreachable**: clean `502 {"code":"INTERNAL_ERROR"}`, never
  a raw connection-refused/stack trace leaked to the client.
- **Webhook raw body**: the gateway has NO body-parsing middleware
  anywhere - every request's raw bytes stream through untouched, which is
  what keeps the Razorpay webhook's HMAC signature (computed over the
  exact raw bytes) valid end-to-end through the proxy hop. Verified live
  (Ch6.6, re-confirmed Ch6.8 with a real payment-confirm flow): identical
  signed payload sent directly to payment-service vs. through the gateway
  both verify and process identically.
- **Auth**: hybrid. Gateway fast-fails (401, no token at all) on
  `/api/orders`, `/api/cart`, `/api/addresses`, `/api/inventory`, and the 4
  admin-scoped `/api/admin/<x>` prefixes - every route under those has no
  public/optional-auth path. Every other prefix is pure routing (mixed
  public/protected routes coexist there) - the service's own
  `requireAuth`/`optionalAuth`/`requireAdmin` remains the real boundary.

## Verified live (Ch6.8 end-to-end integration)

The full 13-step launchable-store + admin flow (login through logistics
delivery through invoice download through the marketplace toggle) was run
entirely against `http://localhost:4000` - see the Ch6.8 integration
record for the complete transcript.
