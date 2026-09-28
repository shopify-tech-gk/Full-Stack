# YouMart Backend — Chapter 7 Complete

**Status: backend feature-complete, hardened, observable, API-frozen
(v1). Tagged `chapter-7-complete`.** This is the map of the finished
system for the frontend team (Chapter 8), deploy, and future reference.

For the actual contract the frontend builds against, see
[contracts/API.md](./contracts/API.md) (frozen v1). For running/
debugging the system, see [ops/running.md](./ops/running.md). For
per-domain implementation detail, see the individual
[contracts/](./contracts/) files.

---

## 1. Services

16 backend services + 1 gateway. Every service is Express 5 +
TypeScript, built to `dist/`, run as `node dist/index.js`. Each has its
own Postgres schema and a least-privilege DB role that can only touch
that one schema (no service reads another's tables directly — all
cross-service reads go through HTTP calls).

| #   | Service              | Port | Responsibility                                                                                                                                                                    | DB schema / role                           |
| --- | -------------------- | ---- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------ |
| —   | **api-gateway**      | 4000 | Single public entry point; proxies `/api/*` to the owning service; CORS, IP rate-limit, request-id generation, `/internal/*` blocking, `/health` + `/health/services` aggregation | none (pure proxy)                          |
| 1   | auth-service         | 4001 | Customer identity: OTP login (WhatsApp), RS256 access tokens, rotating refresh-token cookie, public-key endpoint                                                                  | `auth` / `auth_svc`                        |
| 2   | catalog-service      | 4002 | Product/SKU/category catalog (browse + admin CRUD)                                                                                                                                | `catalog` / `catalog_svc`                  |
| 3   | inventory-service    | 4003 | Stock levels, reservation locking (anti-oversell), commit/release                                                                                                                 | `inventory` / `inventory_svc`              |
| 4   | cart-service         | 4004 | Per-user active cart, line items, live price/stock soft-checks                                                                                                                    | `cart` / `cart_svc`                        |
| 5   | order-service        | 4005 | Checkout (server-side repricing), order + order-item lifecycle, seller/admin fulfillment status                                                                                   | `orders` / `order_svc`                     |
| 6   | payment-service      | 4006 | Razorpay order creation, webhook (HMAC-verified), refund calls                                                                                                                    | `payments` / `payment_svc`                 |
| 7   | seller-service       | 4007 | Seller registration/KYC (dormant), seller identity resolution, marketplace hard-off gate                                                                                          | `sellers` / `seller_svc`                   |
| 8   | settlement-service   | 4008 | Seller payout calculation (commission/TCS/TDS), idempotent settlement runs                                                                                                        | `settlements` / `settlement_svc`           |
| 9   | logistics-service    | 4009 | Shipment creation, tracking events, delivery hand-off                                                                                                                             | `logistics` + `tracking` / `logistics_svc` |
| 10  | returns-service      | 4010 | Return request → approve/reject → pickup → refund workflow                                                                                                                        | `returns` / `returns_svc`                  |
| 11  | address-service      | 4011 | Customer saved addresses (CRUD, default)                                                                                                                                          | `addresses` / `address_svc`                |
| 12  | notification-service | 4012 | BullMQ consumer only (WhatsApp/SMS/email sends); **no HTTP surface, not gateway-routed**                                                                                          | `notifications` / `notification_svc`       |
| 13  | search-service       | 4013 | Product search/facets/suggest via Typesense; reindex queue consumer                                                                                                               | none (Typesense-only, no Postgres role)    |
| 14  | invoice-service      | 4014 | GST-compliant invoice generation (queued on order confirm), PDF storage/download                                                                                                  | `invoices` / `invoice_svc`                 |
| 15  | admin-service        | 4015 | Staff accounts + RBAC, platform settings source-of-truth (marketplace mode, commission/TCS/TDS)                                                                                   | `admin` / `admin_svc`                      |

---

## 2. Architecture summary

- **Single public entry point**: the gateway (4000) is the ONLY port a
  frontend/mobile client ever calls. Every other port is internal-network
  only. `/api/<prefix>` strips to the owning service's own mount path;
  4 services (seller/settlement/returns/invoice) additionally mount an
  admin sub-router at a literal `/admin/<service>` path, giving 4 extra
  `/api/admin/<service>` gateway prefixes alongside `/api/admin` itself
  (admin-service, registered last).
- **Per-service DB isolation**: one Postgres database, one schema per
  service, one least-privilege DB role per service that can only see its
  own schema. No service ever queries another's tables directly.
- **Three distinct auth mechanisms, cryptographically inseparable**:
  - **User tokens**: RS256, `typ:"access"`, 900s TTL, minted by
    auth-service, verified locally by every service via a shared public
    key (no network call per request).
  - **Admin tokens**: RS256, `typ:"admin"` + `role` claim, 8h TTL, SAME
    keypair as user tokens (distinguished only by `typ`), minted by
    admin-service. RBAC via a fixed in-code permission map
    (`@youmart/auth-middleware`), not a DB lookup per request.
  - **Service-to-service tokens**: HS256, `typ:"service"`, 300s TTL,
    minted fresh per outbound call by `@youmart/service-client`. A
    completely different algorithm+secret from user/admin tokens, so a
    customer token can never be replayed as a service token or vice
    versa (`jsonwebtoken`'s algorithm allowlist enforces this before any
    signature check even runs).
  - `/internal/*` endpoints (service-token-only) are additionally
    hard-blocked at the gateway itself, regardless of token — a public
    client can never reach them.
- **Async work — BullMQ + Redis**: notification sends, invoice
  generation, search reindexing, and settlement runs are all queued jobs
  (never inline in the request path). Every worker-having service closes
  its worker(s) before its queue connection before its DB pool on
  shutdown (SIGINT/SIGTERM).
- **Search — Typesense**: product search/facets/autocomplete, kept in
  sync with catalog via queued reindex jobs (per-write) plus a nightly
  full-reindex safety net. search-service has no Postgres schema at all.
- **Settings source-of-truth — admin-service**: a single
  `admin.marketplace_settings` row (marketplace mode, commission/TCS/TDS
  enabled+percent) is the ONE place these are configured. Every consuming
  service reads it through `@youmart/service-client`'s cached settings
  client (~30s TTL, fail-closed where "safe" means DISABLED/no-guess).
  Changing a rate takes effect for every consumer within ~30s — no env
  edit, no redeploy.
- **The marketplace hard-off toggle**: `marketplaceMode: "DISABLED"` (the
  launch default) blocks seller self-registration at seller-service. It
  does NOT block admin from managing existing sellers (including the
  seeded default seller) — see §4.
- **Observability (Ch7.3)**: every service logs structured JSON (pino)
  with a `name` field identifying itself, and a `req.id` that equals the
  gateway's `x-request-id` for that request — a single customer request
  is traceable end-to-end (gateway → service A → service B) by grepping
  one id, via `@youmart/request-context`'s `AsyncLocalStorage`-based
  propagation (zero call-site changes needed). Every service has
  `/health` (liveness, no deps touched) and `/ready` (readiness, checks
  Postgres and, where relevant, Redis/Typesense — genuinely 503s when a
  dependency is down).
- **Error handling**: every service uses the shared `@youmart/errors`
  package — one `AppError` class, one `createErrorHandler`, one
  `{error:{code,message,details?}}` envelope, everywhere. Unknown errors
  are generic in production, detailed in dev; never leak internals or
  secrets.

---

## 3. Where to look for more detail

| Need                                                        | Document                                                                                                             |
| ----------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| The exact public API a frontend/mobile client calls         | [contracts/API.md](./contracts/API.md) — **frozen v1**, the one to build against                                     |
| Per-domain implementation detail (as each chapter built it) | `contracts/<domain>-api.md` (18 files)                                                                               |
| How to run/debug the whole system locally                   | [ops/running.md](./ops/running.md) — port map, health/ready matrix, request-id tracing, log levels, env requirements |
| Full-system integration test record                         | [testing/ch7-full-system-integration.md](./testing/ch7-full-system-integration.md)                                   |
| Git workflow / commit conventions                           | [VERSIONING.md](./VERSIONING.md)                                                                                     |

---

## 4. Multivendor basement (built, dormant, behind the hard-off toggle)

The following exist in code today but are **not exercised at launch**
(single-vendor, `marketplaceMode: "DISABLED"`). They're real, tested code
paths, not stubs — flipping the toggle (an admin API call, no redeploy)
is what activates them:

- **Seller self-registration + KYC** (`POST /api/sellers/register`,
  `POST /api/sellers/me/kyc`) — gated by the marketplace toggle; a real
  seller can register, submit KYC, and be admin-approved/verified today
  if the toggle is flipped ENABLED.
- **Seller-scoped operational paths**: catalog CRUD, order-item
  fulfillment (pack), settlement views, shipment creation — all have a
  seller-owned route (resolved via the caller's own token, never a
  trusted client-supplied id) AND an admin-gated equivalent that works
  regardless (the admin path is what runs the single-vendor default
  seller today; see §5's Ch7.1 note).
- **Real per-seller settlement**: commission-rate override per seller,
  TCS/TDS from platform settings, idempotent settlement runs — proven
  live with the platform's own (0%-commission) default seller; the exact
  same code path runs a real seller's settlement at their own rate once
  one exists.
- **Seller-chosen couriers / fulfillment mode**: `logistics-service`'s
  `FulfillmentMode: "PLATFORM" | "SELLER"` and its `ShippingProvider`
  interface are ready for a real seller-driven shipment flow (currently
  everything ships via the admin/PLATFORM path, the only one exercised).

---

## 5. Known launch to-dos (not bugs — documented, proven-but-blocked)

### External credentials (placeholder in dev `.env`, real values needed before go-live)

- **Razorpay** (`RAZORPAY_KEY_ID/KEY_SECRET/WEBHOOK_SECRET`) — order
  creation and refunds correctly reach Razorpay's real API and fail
  honestly with placeholder keys (401). The entire surrounding flow
  (webhook HMAC verify, idempotency, stock commit/release, order
  confirm/cancel) is proven end-to-end by simulating the webhook payload
  against a manually-inserted payment row — this is the standing,
  repeated verification technique for this gap across Ch4.6-Ch7.5.
- **MSG91** (WhatsApp/SMS templates) — OTP/notification delivery falls
  back to a dev-log path; the queue/worker/redaction code is real and
  tested, just needs real provider credentials.
- **Zoho** (transactional email, refresh token) — same shape of gap as
  MSG91.

### Deferred hardening (flagged in Ch7, intentionally not done — future follow-up)

- **Shutdown-timeout backstop**: no service currently force-exits if a
  graceful `SIGTERM` close hangs (relies entirely on the orchestrator's
  own hard-kill timeout). Noted in Ch7.3, not implemented (would touch
  all 16 services' shutdown code — out of scope for a targeted pass).
- **Invoice `pdfPath` is a server-local filesystem path**, not a URL —
  fine for today's synchronous same-machine download endpoint, but should
  move to S3/object storage + signed URLs before a real multi-instance
  production deploy. Flagged in Ch7.4, not fixed (docs-only chapter).
- **Settlement's weekly scheduled job has no service credential wired**
  (a Ch6 gap, still open) — the admin manual-trigger endpoint
  (`POST /api/admin/settlements/run`) is the only path that currently
  works; the scheduled job logs a warning and skips if it ever fires.
- **Checkout's duplicate-click guard** (30s window) is a pragmatic
  best-effort measure, not a full client-supplied idempotency-key system
  — documented as a known simplification since Ch4.5b.

None of the above block the frontend (Ch8) from building against the
frozen v1 contract — they're operational/infra to-dos for the real
production deploy, not API surface gaps.

---

## 6. What Chapter 7 added (for the record)

- **7.1**: first genuine full-system integration test across all 16
  services + gateway simultaneously. Found and fixed one launch-blocker
  (the default seller had no owning user, so its order items could never
  be packed) — added an admin-gated equivalent alongside the existing
  seller-owned path.
- **7.2**: targeted hardening pass — audited every seller-scoped
  operation for a working admin equivalent (closed 3 more small gaps:
  admin seller-by-id lookup, admin per-seller order-item view, admin
  stock view), confirmed error-handling/validation consistency across all
  16 services, added a per-user checkout rate limit, verified request-size
  limits and no secrets-in-logs.
- **7.3**: observability + ops readiness — request-id correlation
  end-to-end (new `@youmart/request-context` package), structured
  logging with per-service names, `/ready` now genuinely checks every
  critical dependency (added the missing Redis checks for 3 queue-backed
  services + search-service), verified graceful shutdown and fail-fast
  startup, wrote the ops guide.
- **7.4**: consolidated + froze the ONE public API contract
  (`contracts/API.md` v1) the frontend/mobile team builds against,
  verified line-by-line against the real running system (found and fixed
  one stale-doc gap: `shippingAddress` was undocumented despite always
  being returned).
- **7.5**: this document — final verification, backend map, merge to
  `main`, tag `chapter-7-complete`.
