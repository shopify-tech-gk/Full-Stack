# YouMart Public API Contract (v1.7)

**STATUS: FROZEN as of chapter-7-complete (2026-09-28); v1.1 additive
revision 2026-09-29 (W1), v1.2 additive revision 2026-09-30 (W2), v1.3
additive revision 2026-09-30 (W3), v1.4 additive revision 2026-10-01 (W4),
v1.5 revision 2026-10-01 (W5), v1.6 additive revision 2026-10-01 (W6)
— see §17 change log.**

This is the single, authoritative, consolidated contract for the **public
gateway API** — everything a frontend web app or mobile client calls. It
supersedes the per-chapter docs in this same folder (`auth-api.md`,
`catalog-api.md`, etc.) as the one document the Chapter 8 frontend and any
mobile client build against. The per-chapter docs remain in the repo as
historical/implementation detail (each still individually accurate) but
this file is the one to read first and the one that must not shift
without a deliberate version bump.

Every endpoint documented here has been verified against the real running
system as of this freeze (see "Verification" note per section where
relevant, and the full verification log in the Ch7.4 commit).

**Versioning policy**: this is v1.6 of the contract. Changes after the
freeze must be additive/backward-compatible (new optional fields, new
endpoints) wherever possible; each additive revision bumps the MINOR
version (v1.1, v1.2, ...) and is listed in §17. Any breaking change
(removed/renamed field, changed status code, changed auth requirement)
requires a new major version and an explicit migration note here.

**The client talks to the gateway ONLY** — `http://<host>:4000` in dev, a
single public origin in production. Every path below is prefixed `/api/`
and proxied by the gateway to the owning backend service; the client
never addresses a backend service directly.

---

## 1. Shared shapes

### 1.1 `ApiError` envelope

Every error response (400/401/403/404/409/429/500/502/503) uses this
exact shape:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "human-readable message",
    "details": "optional, shape varies by code - e.g. Zod issues array, or {skuId, requested, available} for stock conflicts"
  }
}
```

### 1.2 `ApiErrorCode` -> HTTP status

| Code               | Status          | Meaning                                                                                                                                             |
| ------------------ | --------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| `VALIDATION_ERROR` | 400             | Malformed/missing body, query, or params (Zod validation failure or malformed JSON)                                                                 |
| `UNAUTHORIZED`     | 401             | Missing/invalid/expired bearer token, or invalid refresh cookie                                                                                     |
| `FORBIDDEN`        | 403             | Valid token but insufficient permission/role, or a hard-off gate (e.g. marketplace disabled)                                                        |
| `NOT_FOUND`        | 404             | Resource doesn't exist, unknown route, or belongs to someone else (never distinguished from "doesn't exist")                                        |
| `CONFLICT`         | 409             | Valid request but current state disallows it (insufficient stock, illegal status transition, duplicate resource)                                    |
| `RATE_LIMITED`     | 429             | Gateway IP limit, OTP limit, admin-login limit, or checkout limit exceeded                                                                          |
| `INTERNAL_ERROR`   | 500 / 502 / 503 | Unexpected server error (500, generic message in production), downstream unreachable (502), or `/ready` dependency down (503 - not client-relevant) |

### 1.3 `Money`

Always a **string**, never a JSON number: `^\d+\.\d{2}$`, e.g. `"1299.00"`,
`"0.00"`. Applies to every price/amount field in every response.
Exception: `payment.amount`/`payment.razorpayOrderId`'s `amount` field is
in **paise as a JSON number** (Razorpay's own convention, e.g. `259800`
for ₹2598.00) — the one deliberate exception, called out explicitly at
that endpoint.

### 1.4 `Uuid`

Standard RFC 4122 UUID string, e.g. `"01a0c906-85df-77ea-9261-08d8adb7a2a1"`.

### 1.5 `Paginated<T>`

```json
{ "items": [/* T[] */], "nextCursor": "string | null" }
```

`nextCursor` is opaque (an internal row id) — pass it back verbatim as
the next request's `cursor` query param; don't parse or construct it.
`null` means no more pages.

### 1.6 `PaginationQuery` (query params, where used)

| Param    | Type                    | Default           |
| -------- | ----------------------- | ----------------- |
| `cursor` | string, optional        | none (first page) |
| `limit`  | integer 1-100, optional | 20                |

### 1.7 Timestamps

All timestamps are ISO 8601 UTC strings, e.g. `"2026-09-28T06:30:28.845Z"`.

---

## 2. Auth model

### 2.1 Customer login (passwordless OTP — mobile number over WhatsApp, or email)

1. `POST /api/auth/otp/request` with `{ identifier }` — ONE field holding a
   mobile number OR an email (v1.2). The server detects which: a value
   containing `@` is an email (code sent by email), anything else must be
   a mobile number (code sent on WhatsApp). No SMS.
2. User receives the code, client calls `POST /api/auth/otp/verify` with
   `{ identifier, code }`. The FIRST successful verify for a phone/email
   creates that account — there is no separate sign-up.
3. Response body: `{ accessToken, expiresIn, user }`. Response also sets
   an `httpOnly` cookie `ym_rt` (the refresh token) — **never appears in
   the JSON body**.
4. Client stores `accessToken` **in memory only** (not localStorage — it's
   short-lived by design) and attaches it on every subsequent call:
   `Authorization: Bearer <accessToken>`.
5. On page load, and whenever a call returns `401 UNAUTHORIZED` (token
   expired), call `POST /api/auth/refresh` (browser sends the `ym_rt`
   cookie automatically — no body needed) to get a fresh `accessToken` +
   `user` + rotated cookie, then retry the original call once. Run at most
   ONE refresh at a time: the cookie rotates on every use.
6. `POST /api/auth/logout` clears the cookie server-side; client also
   discards its in-memory `accessToken`.

**Accounts (v1.2)**: a phone and an email are SEPARATE accounts — logging
in by email never finds the account created by phone, and vice versa.
Account linking/merging is a planned refinement, not part of v1.2.

### 2.2 Token facts

| Token                  | Alg                         | TTL                                        | Carried via                               | Claims of interest                                                             |
| ---------------------- | --------------------------- | ------------------------------------------ | ----------------------------------------- | ------------------------------------------------------------------------------ |
| Customer access token  | RS256                       | 900s (15 min)                              | `Authorization: Bearer`                   | `sub` (userId), `typ:"access"`, `phone` (absent for email-only accounts, v1.2) |
| Customer refresh token | opaque (hashed server-side) | 1,209,600s (14 days), rotated on every use | `ym_rt` httpOnly cookie, `Path=/api/auth` | n/a (not a JWT)                                                                |
| Admin access token     | RS256                       | 28,800s (8h)                               | `Authorization: Bearer`                   | `sub` (adminId), `typ:"admin"`, `role`                                         |

There is **no refresh token for admins** — staff re-login when the 8h
token expires (no persistent admin session).

### 2.3 Admin login

`POST /api/admin/login` with `{ email, password }` (bcrypt-verified, NOT
OTP) returns `{ accessToken, expiresIn, admin: { id, email, name, role,
permissions[] } }`. Attach the same way: `Authorization: Bearer
<accessToken>`. `permissions` is the exact list of permission strings this
admin can act on — the admin dashboard should use it to show/hide UI, not
hard-code per-role assumptions (see §8 permission table).

### 2.4 Public key (for local JWT verification, rarely needed by a client)

`GET /api/auth/public-key` returns the RS256 public key as PEM text
(`Content-Type: text/plain`). A frontend never needs this (it isn't
verifying tokens itself) — documented for completeness/mobile edge cases.

---

## 3. Auth domain (`/api/auth`)

### `POST /api/auth/otp/request`

- **Auth**: public
- **Body (v1.2)**: `{ identifier: string, purpose?: "LOGIN" | "PHONE_VERIFY" }` (`purpose` defaults `"LOGIN"`). `identifier` is a mobile number (`9876543210`, `+91 98765 43210`, `09876543210`, `919876543210` or any E.164) or an email (compared lower-cased). `PHONE_VERIFY` requires a mobile number.
  - **v1 body still accepted**: `{ phone: string (E.164) }` — `identifier` wins if both are sent.
- **200**: `{ "status": "otp_sent", "expiresInSeconds": 300 }` — the code goes on WhatsApp (mobile) or by email (email)
- **Errors**: `400 VALIDATION_ERROR` `"Enter a valid mobile number or email address"`; `429 RATE_LIMITED` (`"Please wait before requesting another code"` — 60s resend cooldown; `"Too many code requests, try again later"` — 5/hour per identifier; or the gateway's per-IP public-form limit, §14)
- **Notes**: identical response whether or not the phone/email has an account (no enumeration). Code never appears in any response or log.

### `POST /api/auth/otp/verify`

- **Auth**: public
- **Body (v1.2)**: `{ identifier: string, code: string (6 digits), purpose?: "LOGIN" | "PHONE_VERIFY" }` (v1 `{ phone, code }` still accepted)
- **200**: `{ "accessToken": string, "expiresIn": 900, "user": AuthUser }` + `Set-Cookie: ym_rt=...; HttpOnly; Path=/api/auth; SameSite=Lax; Max-Age=1209600` (+ `Secure` in production)
- `AuthUser` (v1.2): `{ "id": Uuid, "phone": string | null, "email": string | null, "name": string | null, "isPhoneVerified": boolean, "isEmailVerified": boolean }` — `phone` is `null` for an account created by email login (v1.0 clients that assumed a non-null `phone` must handle this; `id`/`phone`/`isPhoneVerified` are otherwise unchanged).
- **v1.1 fix**: v1.0 set `Path=/auth`, which a browser never sends to `/api/auth/refresh` (the path the client actually calls through the gateway), so refresh silently failed. The path is now `/api/auth` (configurable server-side via `REFRESH_COOKIE_PATH`). Cookies issued before the fix are orphaned — affected users simply log in again.
- **Errors**: `400 VALIDATION_ERROR` (wrong/expired code — generic message, never reveals which); `429 RATE_LIMITED` (5 wrong attempts on one challenge); `403 FORBIDDEN` (account BLOCKED)
- **Verified live** (2026-09-28): exact match, incl. cookie flags.

### `POST /api/auth/refresh`

- **Auth**: `ym_rt` cookie (browser sends automatically; no bearer token, no body)
- **200**: `{ "accessToken": string, "expiresIn": 900, "user": AuthUser }` (`user` added v1.2 — restores who is signed in after a page reload in one call) + new rotated `Set-Cookie: ym_rt=...`
- **Errors**: `401 UNAUTHORIZED` (missing/invalid/already-rotated cookie); `403 FORBIDDEN` (account BLOCKED)

### `GET /api/auth/me` — v1.2

- **Auth**: customer bearer token
- **200**: `AuthUser` (the caller's own profile)
- **Errors**: `401` (missing/expired token — refresh and retry); `403` (account BLOCKED)

### `PATCH /api/auth/me` — v1.6

- **Auth**: customer bearer token
- **Body**: `{ "name": "string" }` (trimmed, 1-100 chars). Only the display name is editable; email and phone are OTP-verified login identities and cannot be changed here.
- **200**: `AuthUser` (updated)
- **Errors**: `400 VALIDATION_ERROR`; `401`

### `POST /api/auth/logout`

- **Auth**: `ym_rt` cookie (optional — always succeeds)
- **200**: `{ "status": "logged_out" }` + `Set-Cookie` clearing `ym_rt`

### `GET /api/auth/public-key`

- **Auth**: public
- **200**: PEM text, `Content-Type: text/plain`

---

## 4. Catalog domain (`/api/catalog`)

**v1.3 — attribute-driven catalog.** Products carry free-form `attributes`
(key -> value); every category carries a **filter definition** (data:
which attributes it filters on and how, inherited from the nearest
ancestor that has one). The listing and filter endpoints below are generic
— no endpoint or client ever branches on a category or attribute name.
Adding a category or a filter is a data change (admin API / import,
`docs/catalog/IMPORT-SPEC.md`), never a code change. Listing, facet values
and counts are served by the Typesense index (search-service), so cost
doesn't grow with a Postgres scan — see §4.1.

### `GET /api/catalog/products` — generic filtered listing (v1.3)

- **Auth**: public (optional bearer, no behavior difference for a customer)
- **Query**:
  - `category?: string` (category **slug**) — includes products of its sub-categories. `categoryId?: Uuid` still accepted.
  - `q?: string` (1-200) — full-text, typo-tolerant (title weighted over description).
  - `min_price?`, `max_price?` (rupees; v1 `minPrice`/`maxPrice` still accepted), `rating?: 0-5` (minimum average rating).
  - **Attribute filters** — only keys declared in the category's filter definition are applied; any other param is ignored:
    - `multi_select`: `<key>=v1,v2` (matches any; values are comma-separated) — e.g. `brand=Samsung,LG`
    - `single_select` / `boolean`: `<key>=value` — e.g. `network=5G`, `insulated=true`
    - `range`: `<key>_min=`, `<key>_max=` — e.g. `screen_size_min=6&screen_size_max=6.7`
  - `sort?`: `relevance` (default; newest first when there is no `q`) | `newest` | `price_asc` | `price_desc` | `rating` | `discount`
  - `limit?` (1-100, default 20); `page?` (1-500) or `cursor?` (the previous response's `nextCursor`)
- **200**:
  ```json
  {
    "items": [
      {
        "id": "Uuid", "title": "string", "slug": "string",
        "price": "Money", "mrp": "Money", "skuId": "Uuid | null", "imageUrl": "string | null",
        "rating": "number | null", "ratingCount": number,
        "category": { "id": "Uuid", "name": "string", "slug": "string" }
      }
    ],
    "nextCursor": "string | null", "total": number, "page": number, "perPage": number
  }
  ```
- **Errors**: `404 NOT_FOUND` (unknown `category`); `400 VALIDATION_ERROR` (non-numeric range bound, malformed cursor, value > 100 chars)
- **Notes**: only `ACTIVE`, non-deleted products. `price`/`mrp` are the cheapest SKU's. `nextCursor` stays opaque (it is now a page token); deep pagination is capped at page 500 — narrow with filters instead.

### `GET /api/catalog/categories/:slug/filters` — v1.3

The category's filter definition + the values/counts available **for the
current selection**. Accepts the same query params as the listing (so
counts follow the shopper's choices). Multi-select counts are
**disjunctive**: a filter's own selection doesn't narrow its own options
(`Brand: Samsung(2), Xiaomi(1)` stays visible after picking Samsung).

- **Auth**: public
- **200**:
  ```json
  {
    "category": { "id": "Uuid", "name": "Mobiles", "slug": "mobiles", "parentId": "Uuid | null" },
    "path": [
      { "id": "Uuid", "name": "Electronics", "slug": "electronics" },
      { "...": "root -> this category" }
    ],
    "definitionFrom": "mobiles",
    "total": 12,
    "price": { "min": 7999, "max": 69900 },
    "filters": [
      {
        "key": "brand",
        "label": "Brand",
        "type": "multi_select",
        "order": 1,
        "values": [{ "value": "Samsung", "count": 4 }]
      },
      {
        "key": "screen_size",
        "label": "Screen Size",
        "type": "range",
        "unit": "in",
        "order": 4,
        "min": 6.1,
        "max": 6.78
      },
      {
        "key": "network",
        "label": "Network",
        "type": "single_select",
        "order": 5,
        "values": [{ "value": "5G", "count": 9 }]
      }
    ]
  }
  ```
- `type`: `multi_select` | `single_select` | `boolean` (have `values`; boolean values are `"true"`/`"false"`) | `range` (has `min`/`max`, `null` when no product carries the attribute). Price (`price`, rupees, `null` for an empty category) and rating are universal and never appear in `filters`.
- `definitionFrom`: slug of the category the definition was inherited from (itself or an ancestor), `null` when none.
- **Errors**: `404` (unknown slug)

### 4.1 How it scales (350k products)

- Postgres (`catalog`) is the source of truth; the Typesense collection is a derived, rebuildable index (event-driven upsert per product change + nightly zero-downtime full rebuild via alias swap).
- Every product attribute is indexed generically: `attrs_<key>` (string values, faceted) and `attrn_<key>` (the number, for ranges/stats). A new attribute key needs **no schema change and no reindex**; a filter definition only selects which indexed attributes a category offers.
- Category membership is indexed as the full ancestor path (`categoryIds`), so a parent listing is one filter, not a tree walk.
- One listing page = one Typesense `multi_search` round trip (results + one extra facet query per _selected_ multi-select filter for disjunctive counts). No per-request Postgres scan; catalog-service only reads the category row(s) to resolve the definition.

### `GET /api/catalog/products/:slug`

- **Auth**: public
- **200**:
  ```json
  {
    "id": "Uuid",
    "title": "string",
    "slug": "string",
    "description": "string | null",
    "category": { "id": "Uuid", "name": "string", "slug": "string" },
    "skus": [
      {
        "id": "Uuid",
        "skuCode": "string",
        "mrp": "Money",
        "sellingPrice": "Money",
        "attributes": {}
      }
    ],
    "images": [{ "id": "Uuid", "url": "string", "position": 0 }],
    "attributes": { "brand": "OnePlus", "ram": "12", "screen_size": 6.78 },
    "specifications": [{ "key": "ram", "label": "RAM", "value": "12", "unit": "GB" }],
    "rating": 4.6,
    "ratingCount": 990,
    "categoryPath": [
      { "id": "Uuid", "name": "Electronics", "slug": "electronics" },
      { "id": "Uuid", "name": "Mobiles", "slug": "mobiles" }
    ]
  }
  ```
- `attributes`, `specifications`, `rating`, `ratingCount`, `categoryPath` are v1.3 additions. `specifications` lists every attribute with the label/unit from the category's filter definition (definition order first, others A-Z with a humanised key as label). `images[].url` is absolute: `CDN_BASE_URL` + the stored key, or the stored absolute URL.
- **Errors**: `404 NOT_FOUND` (no such ACTIVE product)
- **Verified live** (2026-09-28): exact match.

### Product reviews — v1.6

One review per customer per product, **purchase-verified**: only a customer with a non-cancelled item of the product on a `CONFIRMED` (paid) order may submit. Reviews publish immediately. `rating`/`ratingCount` on the product (and in search, after the async reindex) include them; ratings imported with the catalogue are kept.

`Review`: `{ id, rating: 1-5, title: string|null, body, author, verifiedPurchase: boolean, createdAt, updatedAt }` (`author` is the name the customer chose, or `"YouMart customer"`).

- `GET /api/catalog/products/:slug/reviews?page&limit` — public. **200** `{ items: Review[], total, page, perPage, breakdown: {"1".."5": count} }`, newest first (`limit` 1-50, default 10). `404` unknown product.
- `GET /api/catalog/products/:slug/reviews/mine` — customer token. **200** `{ canReview: boolean, review: Review|null }`.
- `POST /api/catalog/products/:slug/reviews` — customer token. **Body** `{ rating: 1-5, body: 10-2000 chars, title?: <=120, authorName?: 1-60 }`. **201** `Review` (created) / **200** `Review` (the caller's existing review, edited). **Errors**: `400`; `401`; `403 FORBIDDEN` ("Only customers who have bought this product can review it"); `404`.

### `GET /api/catalog/categories`

- **Auth**: public
- **200**: `{ "items": [{ "id": "Uuid", "name": "string", "slug": "string", "parentId": "Uuid | null" }] }`

### Recently viewed (view tracking) — v1.7

A customer's recently viewed products, kept by catalog-service (`catalog.recently_viewed`, `catalog_svc` role). **Per user and private**: every call acts on the token's own user only. **Capped**: one entry per product (a re-view moves it to the top), newest first, at most **50** per user — older entries are deleted, not kept. Guests keep the same capped list in their own browser only (never sent) and it is merged on login.

`RecentlyViewedItem` = a listing item (exactly the `GET /api/catalog/products` item shape) + `viewedAt: string` (ISO).

- `POST /api/catalog/recently-viewed` — customer token. **Body** `{ productId: Uuid }`. **202** `{ "accepted": true }` — returned **before** the write, which runs after the response (fire-and-forget: a page never waits on it, a failed write is logged and dropped). Ids that aren't live products are ignored. **Errors**: `400` (not a uuid); `401`.
- `GET /api/catalog/recently-viewed?limit` — customer token. **200** `{ items: RecentlyViewedItem[] }`, newest first (`limit` 1-50, default 50). Products archived since they were viewed drop out. **Errors**: `401`.
- `POST /api/catalog/recently-viewed/merge` — customer token. **Body** `{ items: [{ productId: Uuid, viewedAt: ISO }] }` (max 50) — a guest's local history on login; each product keeps its latest view time (future times count as now), then the cap applies. **200** `{ items: RecentlyViewedItem[] }` (the merged list). **Errors**: `400` (more than 50, bad id/time); `401`.
- `DELETE /api/catalog/recently-viewed` — customer token. Clears the caller's history (rows deleted). **204**.
- `GET /api/catalog/product-cards?ids=Uuid,Uuid` — public. **200** `{ items: ProductListItem[] }` — live products as listing cards, in the order given (unknown/archived ids skipped); 1-50 ids. How a guest's locally kept ids become fresh cards (prices are never stored in the browser). **Errors**: `400`.

### `GET /api/catalog/skus/:skuId`

- **Auth**: public
- **200**: `{ "skuId": "Uuid", "productId": "Uuid", "productSlug": "string", "title": "string", "sellerId": "Uuid", "sellingPrice": "Money", "mrp": "Money", "active": boolean }`
- **Errors**: `404 NOT_FOUND`
- **Notes**: `active: false` (not a 404) when the SKU exists but its product is DRAFT/ARCHIVED — lets a client distinguish "unsellable" from "doesn't exist" (e.g. for an old cart line).

### Catalog admin (requires `catalog.manage`)

All of these require `Authorization: Bearer <admin token>` with the
`catalog.manage` permission.

| Method + path                           | Body                                                                                                                             | Success                               | Errors                                               |
| --------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------- | ---------------------------------------------------- |
| `POST /api/catalog/products`            | `{ title, description?, categoryId, attributes?, skus: [{skuCode?, mrp, sellingPrice, attributes?}] (min 1), images?, status? }` | `201` full product detail             | `400` (bad categoryId, sellingPrice>mrp), `403`      |
| `PATCH /api/catalog/products/:id`       | any of `title, description, categoryId, attributes, status`                                                                      | `200` full product detail             | `400` (empty body, illegal status transition), `404` |
| `DELETE /api/catalog/products/:id`      | —                                                                                                                                | `204`                                 | `404`                                                |
| `POST /api/catalog/products/:id/skus`   | `{skuCode?, mrp, sellingPrice, attributes?}`                                                                                     | `201` full product detail             | `400` (sellingPrice>mrp, duplicate skuCode), `404`   |
| `PATCH /api/catalog/skus/:id`           | any of `mrp, sellingPrice, attributes`                                                                                           | `200` full product detail             | `400`, `404`                                         |
| `POST /api/catalog/products/:id/images` | `{url, position?}`                                                                                                               | `201` full product detail             | `404`                                                |
| `DELETE /api/catalog/images/:id`        | —                                                                                                                                | `204`                                 | `404`                                                |
| `POST /api/catalog/categories`          | `{name, parentId?, filterDefinition?}` (v1.3)                                                                                    | `201` category (+ `filterDefinition`) | `400`                                                |
| `PATCH /api/catalog/categories/:id`     | any of `name, parentId, filterDefinition` (v1.3; `null` = inherit again)                                                         | `200` category (+ `filterDefinition`) | `400`, `404`                                         |

`filterDefinition` (v1.3): array (max 30) of `{ key, label, type:
"multi_select"|"single_select"|"range"|"boolean", unit?, order? }` —
format and rules in `docs/catalog/IMPORT-SPEC.md` §2. Takes effect on the
next request; no reindex needed.

`status` transitions allowed: `DRAFT->ACTIVE`, `ACTIVE->ARCHIVED`,
`ARCHIVED->ACTIVE` only; any other requested transition is `400
VALIDATION_ERROR`. Product delete is soft (never hard-deleted).

---

## 5. Search domain (`/api/search`)

### `GET /api/search/products`

- **Auth**: public
- **Query**: `q?: string`, `category?: Uuid`, `minPrice?: number`, `maxPrice?: number`, `brand?: string`, `sort?: "relevance" | "price_asc" | "price_desc" | "newest"`, `page?: number (default 1)`, `perPage?: number (default 20)`
- **200**:
  ```json
  {
    "results": [{ "id": "Uuid", "title": "string", "slug": "string", "price": "Money", "mrp": "Money", "skuId": "Uuid | null", "rating": "number | null", "primaryImageUrl": "string | null", "categoryName": "string" }],
    "facets": { "category": [{ "value": "string", "count": number }], "brand": [...], "price": [...] },
    "found": number, "page": number, "perPage": number
  }
  ```
- **Notes**: typo-tolerant (Typesense fuzzy matching). Not a `Paginated<T>` shape (uses `results`/`found`/`page`/`perPage`, not `items`/`nextCursor`) — a deliberate, documented exception since it mirrors Typesense's own native response shape. v1.3: `mrp`/`rating` added; served by the same generic engine as the catalog listing; `category` now also matches sub-categories; the `brand` facet reads the generic `brand` attribute.
- **Verified live** (2026-09-28): exact match (note `primaryImageUrl` can be `null`, corrected from an earlier informal description of it as always a string).

### `GET /api/search/suggest`

- **Auth**: public
- **Query**: `q: string`, `limit?: number`
- **200**: lightweight autocomplete suggestion list

### `POST /api/search/admin/reindex` (requires `search.manage`)

- **Auth**: admin Bearer token
- **200**: reindex triggered (ops/testing tool; a nightly job is the real safety net — not a normal frontend call, included here only in case the admin dashboard wants a manual "reindex now" button)

---

## 6. Cart domain (`/api/cart`)

All routes require a customer bearer token (`Authorization: Bearer
<accessToken>`); gateway fast-fails `401` with no token at all before
proxying.

### `GET /api/cart`

- **200**:
  ```json
  {
    "cartId": "Uuid | null",
    "items": [{ "cartItemId": "Uuid", "skuId": "Uuid", "productId": "Uuid", "productSlug": "string", "title": "string", "quantity": number, "priceSnapshot": "Money", "lineTotal": "Money" }],
    "subtotal": "Money", "itemCount": number
  }
  ```
- **Notes**: never `404` — an empty/no cart returns `{cartId:null, items:[], subtotal:"0.00", itemCount:0}`. `itemCount` sums quantities, not distinct lines.

### `POST /api/cart/items`

- **Body**: `{ skuId: Uuid, quantity: integer >= 1 }`
- **200**: updated cart (same shape as `GET /api/cart`)
- **Errors**: `400 VALIDATION_ERROR`; `409 CONFLICT` (`"This product is not currently available"` or `"Insufficient stock"` with `details:{skuId,requested,available}`)
- **Notes**: adding an already-present SKU merges into that line and refreshes `priceSnapshot` to the SKU's current price. Stock check here is a soft UX check only — the hard guarantee is enforced at checkout.
- **Verified live** (2026-09-28): exact match.

### `PATCH /api/cart/items/:cartItemId`

- **Body**: `{ quantity: integer >= 1 }`
- **200**: updated cart
- **Errors**: `400`, `404` (not caller's item), `409 CONFLICT` (insufficient stock)

### `DELETE /api/cart/items/:cartItemId`

- **200**: updated cart
- **Errors**: `404`

### `POST /api/cart/clear`

- **200**: updated (empty) cart. No-op if already empty.

---

## 6a. Wishlist domain (`/api/wishlist`) — v1.1

All routes require a customer bearer token; gateway fast-fails `401`
with no token. Every wishlist is scoped to the caller. Owned by
cart-service. Product details are resolved LIVE from the catalog on
every read (never snapshotted) — a wishlist shows today's price.

`WishlistView`:

```json
{
  "items": [{ "wishlistItemId": "Uuid", "skuId": "Uuid", "productId": "Uuid", "productSlug": "string | null", "title": "string | null", "sellingPrice": "Money | null", "mrp": "Money | null", "available": boolean, "addedAt": "ISO" }],
  "itemCount": number
}
```

`available:false` with `null` product fields means the product was
removed/deactivated (or the catalog was briefly unreachable) — show it
as "no longer available" and let the user remove it. Newest first.

### `GET /api/wishlist`

- **200**: `WishlistView` (never `404` — empty wishlist is `{items:[], itemCount:0}`)

### `POST /api/wishlist/items`

- **Body**: `{ skuId: Uuid }`
- **200**: updated `WishlistView`
- **Errors**: `400 VALIDATION_ERROR`; `404 NOT_FOUND` (unknown SKU); `409 CONFLICT` (`"Your wishlist is full (maximum 200 items)"`)
- **Notes**: idempotent — adding a SKU already on the wishlist returns `200` with no duplicate.

### `DELETE /api/wishlist/items/:wishlistItemId`

- **200**: updated `WishlistView`
- **Errors**: `404` (`"Wishlist item not found"` — also for another user's item)

---

## 7. Address domain (`/api/addresses`)

All routes require a customer bearer token; gateway fast-fails `401`
with no token. Every address is scoped to the caller — there is no way
to read/modify anyone else's.

### `GET /api/addresses`

- **200**: `{ "items": [Address[]] }` (not cursor-paginated — a customer's address book is small)

### `GET /api/addresses/:id`

- **200**: one `Address`
- **Errors**: `404` (not caller's own)

### `POST /api/addresses`

- **Body**: `{ fullName: string, phone: string (E.164), line1: string, line2?: string, landmark?: string, city: string, state: string, pincode: string (exactly 6 digits), country?: string (default "India"), addressType?: string (default "HOME"), isDefault?: boolean }`
- **201**: `Address` — the exact response shape (verified live 2026-09-28):
  ```json
  {
    "id": "Uuid", "fullName": "string", "phone": "string",
    "line1": "string", "line2": "string | null", "landmark": "string | null",
    "city": "string", "state": "string", "pincode": "string", "country": "string",
    "addressType": "string", "isDefault": boolean,
    "createdAt": "ISO", "updatedAt": "ISO"
  }
  ```
- **Notes**: setting `isDefault:true` un-defaults any prior default in the same transaction.

### `PATCH /api/addresses/:id`

- **Body**: partial, any subset of the create fields
- **200**: updated `Address`
- **Errors**: `404`

### `DELETE /api/addresses/:id`

- **204**. Soft-delete.
- **Errors**: `404`

### `POST /api/addresses/:id/default`

- **200**: updated `Address` with `isDefault:true` (un-defaults any other)
- **Errors**: `404`

---

## 8. Order domain (`/api/orders`)

All routes require a customer bearer token; gateway fast-fails `401`
with no token. Every order is scoped to the caller. **Single exception
(v1.1)**: `POST /api/orders/track` is public.

### `POST /api/orders/checkout`

- **Body**: `{ addressId: Uuid }` — **this is the ONLY thing the client contributes**; items/prices are never read from the request (server re-derives everything from the caller's own server-side cart + live catalog prices).
- **201**: `OrderView` (exact shape, verified live 2026-09-28 — corrects an omission in the per-chapter `order-api.md`, which did not previously document the `shippingAddress` field even though the running system has always returned it):
  ```json
  {
    "orderId": "Uuid", "orderNumber": "string (e.g. YM-MUKVCCGR-25E4)",
    "status": "PENDING_PAYMENT | CONFIRMED | CANCELLED",
    "items": [{ "skuId": "Uuid", "productId": "Uuid", "sellerId": "Uuid", "title": "string", "unitPrice": "Money", "quantity": number, "lineTotal": "Money", "sellerStatus": "PENDING | CONFIRMED | PACKED | SHIPPED | DELIVERED | CANCELLED | RETURNED" }],
    "subtotal": "Money", "shippingTotal": "Money", "grandTotal": "Money",
    "shippingAddress": { "addressId": "Uuid", "fullName": "string", "phone": "string", "line1": "string", "line2": "string | null", "landmark": "string | null", "city": "string", "state": "string", "pincode": "string", "country": "string" }
  }
  ```
- **Errors**: `400 VALIDATION_ERROR` (`"Cart is empty"`); `409 CONFLICT` (`"<title> is no longer available"` or `"Insufficient stock for '<title>'"` with `details:{skuId,requested,available}`); `429 RATE_LIMITED` (>20 checkout attempts/10min per user)
- **Notes**:
  - `order.status` (payment lifecycle) and each item's `sellerStatus` (fulfillment lifecycle) are **intentionally independent** — an order can be `CONFIRMED` while its items are still `PENDING`/`PACKED`/etc, and correctly stays `CONFIRMED` (not re-tracked) all the way through delivery. Track FULFILLMENT progress via `sellerStatus` per item (and §10 tracking), not `order.status`.
  - Repeated checkout calls within 30s of an existing `PENDING_PAYMENT` order return that SAME order (best-effort duplicate-click guard, not a full idempotency-key system).

### `GET /api/orders`

- **Query**: `cursor?`, `limit?` (1-100, default 20)
- **200**: `Paginated<{ orderId, orderNumber, status, grandTotal: Money, createdAt }>`, newest-first

### `GET /api/orders/:id`

- `:id` is the order's `orderId` **or** its `orderNumber` (v1.6, case-insensitive) — storefront order pages use `/account/orders/<orderNumber>`.
- **200**: `OrderView` (same shape as checkout's response). v1.6 adds `createdAt`, `timeline: [{ status, at }]` (order status history, oldest first) and `items[].orderItemId` (for `GET /api/logistics/track/order-item/:orderItemId`).
- **Errors**: `404` (not caller's own, or doesn't exist)

### `POST /api/orders/track` — v1.1, guest order tracking

- **Auth**: public (no token needed; a token is ignored)
- **Body**: `{ orderNumber: string, phone: string }` — `orderNumber` is case-insensitive; `phone` is the order's DELIVERY phone, accepted as `+91XXXXXXXXXX`, `91XXXXXXXXXX`, `0XXXXXXXXXX` or `XXXXXXXXXX` (spaces/dashes ignored)
- **200** (safe subset only — no ids, prices, names, street address or phone):
  ```json
  {
    "orderNumber": "string", "status": "PENDING_PAYMENT | CONFIRMED | CANCELLED", "placedAt": "ISO",
    "shipTo": { "city": "string", "state": "string" },
    "items": [{ "title": "string", "quantity": number, "sellerStatus": "...", "shipment": { "status": "string", "carrier": "string | null", "awbNumber": "string | null", "events": [{ "status": "string", "location": "string | null", "occurredAt": "ISO" }] } }],
    "timeline": [{ "status": "string", "at": "ISO" }]
  }
  ```
  `shipTo` may be `null`; `shipment` is `null` until the item has shipped.
- **Errors**: `404 NOT_FOUND` `"No order matches that order number and phone number"` — returned IDENTICALLY for unknown order number, wrong phone, and malformed input (no enumeration); `429 RATE_LIMITED` (§14)

### `POST /api/orders/:id/cancel` — v1.1

- **Body**: `{ reason: string (3-200), comment?: string (<=1000) }`
- **200** `{ outcome: "CANCELLED", order: OrderView, cancelRequest: null }` — order was `PENDING_PAYMENT` (unpaid): cancelled immediately, all items `CANCELLED`, held stock released. Idempotent: an already-`CANCELLED` order returns the same `200`.
- **202** `{ outcome: "CANCEL_REQUESTED", order: OrderView, cancelRequest: CancelRequestView }` — order is `CONFIRMED` (paid) and nothing has shipped: a cancel REQUEST is recorded for staff review; the order is unchanged until an admin approves (refund + restock, see §13) or rejects it. Asking again while a request is open returns the SAME request.
- `CancelRequestView`: `{ cancelRequestId, orderId, status: "REQUESTED"|"APPROVED"|"REJECTED", reason, comment: string|null, resolutionNote: string|null, createdAt, resolvedAt: ISO|null }`
- **Errors**: `400 VALIDATION_ERROR`; `404` (not caller's order); `409 CONFLICT` (`"This order has already shipped and can no longer be cancelled - please request a return instead"`, or the order changed state mid-request)
- **Notes**: requires login — there is no guest cancel (a phone number alone is not strong enough to authorise a state change).

### `GET /api/orders/:id/notify` / `PUT /api/orders/:id/notify` — v1.1

- **PUT body**: `{ whatsapp: boolean, sms: boolean }`
- **200** (both): `{ orderId, whatsapp: boolean, sms: boolean, updatedAt: ISO | null }` — `GET` with no saved preference returns the defaults `{whatsapp:true, sms:false, updatedAt:null}`
- **Errors**: `400`; `404` (not caller's order)
- **Notes**: v1.1 STORES the per-order preference only; outbound senders do not yet consult it, and SMS is not an active channel yet.

---

## 9. Payment domain (`/api/payments`)

### `POST /api/payments/razorpay-order`

- **Auth**: customer bearer token
- **Body**: `{ orderId: Uuid }`
- **201**:
  ```json
  {
    "razorpayOrderId": "string (Razorpay's own id, e.g. order_...)",
    "razorpayKeyId": "string (PUBLIC key, safe to embed in client SDK)",
    "amount": 259800,
    "currency": "INR",
    "orderId": "Uuid"
  }
  ```
  **`amount` is in paise as a plain JSON number** (the one deliberate exception to the Money-string rule, since it's handed directly to the Razorpay Checkout SDK which expects paise-as-number).
- **Errors**: `404` (not caller's order); `409 CONFLICT` (`"Cannot pay for an order in status <status>"` — order not `PENDING_PAYMENT`); `500 INTERNAL_ERROR` (Razorpay API call itself failed)
- **Client flow**: call this, then open Razorpay's Checkout with `{key: razorpayKeyId, order_id: razorpayOrderId, currency}` (no client amount - Razorpay uses the order's). Razorpay calls the server-side webhook directly when payment completes — **the client does NOT call any "confirm payment" endpoint**; it should poll/refetch `GET /api/orders/:id` (or listen for Razorpay's client-side success callback, then refetch) to see the order's status flip. The storefront's implementation: `packages/shared-client/src/checkout.ts`.
- **Retries** (v1.5): calling this again for the same unpaid order returns the SAME Razorpay order. A failed payment attempt (`payment.failed`) no longer cancels the order - it stays payable.
- **Verified live** (2026-09-28): with placeholder dev credentials, correctly returns `500 INTERNAL_ERROR` (Razorpay itself rejects the fake key) — this is the expected/honest dev behavior, not a contract violation.
- **Verified live** (2026-09-30, W5): with real Razorpay TEST keys, `201` with a real `order_...` id from the Razorpay test API, the public `rzp_test_...` key id and `amount` = the order's `grand_total` × 100 (e.g. `29900` for `299.00`); nothing else in the body.

### `POST /api/payments/webhook` — **NOT a client endpoint**

Called directly by Razorpay's servers (HMAC-signature-authenticated, no
user/admin token). Documented in `payment-api.md` for completeness; a
frontend/mobile client never calls this.

---

## 10. Invoice domain (`/api/invoices`)

### `GET /api/invoices/order/:orderId`

- **Auth**: customer bearer token
- **200**: full invoice JSON — `{ id, orderId, userId, invoiceNumber, invoiceDate, buyerName, buyerAddress, buyerState, buyerGstin, businessName, businessGstin, businessAddress, businessState, subtotalTaxable: Money, totalCgst: Money, totalSgst: Money, totalIgst: Money, totalTax: Money, grandTotal: Money, placeOfSupply, taxType: "CGST_SGST" | "IGST", pdfPath, lines: [{productId, skuId, titleSnapshot, hsnCode, quantity, unitPrice: Money, taxableValue: Money, gstRatePercent, cgstAmount: Money, sgstAmount: Money, igstAmount: Money, lineTotal: Money}] }`
- **Errors**: `404` (no invoice yet, or not caller's order)
- **Notes**: `pdfPath` is a server-local filesystem path (not a URL) — **not directly useful to a client**; use the download endpoint below to actually fetch the PDF. Flagged as a minor pre-existing detail worth hiding/URL-ifying in a future hardening pass (not fixed here — docs-only chapter).
- **Verified live** (2026-09-28): exact match.

### `GET /api/invoices/order/:orderId/download`

- **Auth**: customer bearer token
- **200**: raw PDF bytes, `Content-Type: application/pdf`, `Content-Disposition: attachment`
- **Errors**: `404` (no invoice, or not caller's order)
- **Verified live** (2026-09-28): `200`, `application/pdf`, real byte content.

---

## 11. Returns domain (`/api/returns`)

### `POST /api/returns`

- **Auth**: customer bearer token
- **Body**: `{ orderItemId: Uuid, reason: string }`
- **201**: `{ id, orderItemId, userId, reason, status: "REQUESTED", refundAmount: null, createdAt, updatedAt }`
- **Errors**: `404` (not caller's item); `409 CONFLICT` (not yet `DELIVERED`, outside the return window - default 7 days from delivery, or a blocking return already exists for this item)

### `GET /api/returns`

- **Auth**: customer bearer token
- **Query**: `cursor?`, `limit?`
- **200**: `Paginated<ReturnView>` — caller's own returns only

### `GET /api/returns/:id`

- **Auth**: customer bearer token
- **200**: one `ReturnView`
- **Errors**: `404` (not caller's own)

### Returns admin (`requires returns.manage`, except process-refund which requires `refunds.manage`)

Full lifecycle: `REQUESTED -> APPROVED -> PICKED_UP -> REFUNDED` (or
`REJECTED` at any point before `REFUNDED`).

| Method + path                                | Body                                                | Success                                                                                                                                                                                           |
| -------------------------------------------- | --------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GET /api/admin/returns`                     | —                                                   | `200 Paginated<ReturnView>`, all sellers/buyers                                                                                                                                                   |
| `POST /api/admin/returns/:id/approve`        | `{ refundAmount?: Money }` (defaults to line total) | `200`, `status:"APPROVED"`                                                                                                                                                                        |
| `POST /api/admin/returns/:id/reject`         | `{ reason?: string }`                               | `200`, `status:"REJECTED"`                                                                                                                                                                        |
| `POST /api/admin/returns/:id/picked-up`      | `{}`                                                | `200`, `status:"PICKED_UP"`                                                                                                                                                                       |
| `POST /api/admin/returns/:id/process-refund` | `{}`                                                | `200` — `{ return, refund: {refundId, paymentId, amount: Money, status:"SUCCEEDED"\|"FAILED", razorpayRefundId, blocked}, restocked: {skuId, available, reserved} }`; `409` if already `REFUNDED` |

`process-refund`'s `refund.blocked:true` + `status:"FAILED"` with
placeholder Razorpay credentials is expected/honest dev behavior — the
return itself still flips to `REFUNDED` and inventory/order-item state
still update correctly regardless (verified in Ch7.1).

---

## 12. Logistics / tracking domain (`/api/logistics`)

### `GET /api/logistics/track/order-item/:orderItemId`

- **Auth**: customer bearer token
- **200**: shipment status + full tracking event history for that order item
- **Errors**: `404` (no shipment yet, or not caller's item)
- **Notes**: this is the ONE logistics endpoint a customer-facing frontend needs. Everything else in this domain (shipment creation/status/tracking-event endpoints) is seller/admin fulfillment tooling.

### Logistics admin (`requires fulfillment.manage`) — for the admin dashboard

| Method + path                                 | Body                                                                                                  | Success                                                    |
| --------------------------------------------- | ----------------------------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| `POST /api/logistics/shipments`               | `{ orderItemId: Uuid, carrier?: string, awbNumber?: string, fulfillmentMode?: "PLATFORM"\|"SELLER" }` | `201` shipment (requires the item to already be `PACKED`)  |
| `PATCH /api/logistics/shipments/:id/status`   | `{ status: ShipmentStatus }`                                                                          | `200` shipment                                             |
| `POST /api/logistics/shipments/:id/tracking`  | `{ status: string, location?: string, occurredAt?: ISO }`                                             | `200` shipment incl. `events[]`                            |
| `POST /api/logistics/shipments/:id/delivered` | `{}`                                                                                                  | `200`, `status:"DELIVERED"` (must already be `IN_TRANSIT`) |
| `GET /api/logistics/shipments/:id`            | —                                                                                                     | `200` shipment detail incl. tracking history               |

Shipment lifecycle: `CREATED -> PICKED_UP -> IN_TRANSIT -> DELIVERED` (or
`-> RTO`, or `CREATED -> CANCELLED`). Out-of-order transitions ->
`409 CONFLICT`.

---

## 13. Admin & platform management domain (`/api/admin`)

For the Ch8 admin dashboard. All routes except login require
`Authorization: Bearer <admin token>`; most additionally require a
specific permission (§13.4).

### `POST /api/admin/login`

- **Auth**: public
- **Body**: `{ email: string, password: string }`
- **200**: `{ accessToken, expiresIn: 28800, admin: { id, email, name, role, permissions: string[] } }`
- **Errors**: `401 UNAUTHORIZED` (wrong email/password, generic); `429 RATE_LIMITED` (10 attempts/15min per IP)
- **Verified live** (2026-09-28): exact match; live-demonstrated 429 after 10 failed attempts in Ch7.2.

### `GET /api/admin/me`

- **Auth**: any logged-in admin
- **200**: caller's own admin profile + resolved permissions

### `GET /api/admin/settings`

- **Auth**: any logged-in admin (view-only, no extra permission)
- **200**: `{ marketplaceMode: "ENABLED"|"DISABLED", commission: {enabled, defaultPercent: Money}, tcs: {enabled, percent: Money}, tds: {enabled, percent: Money}, updatedAt }`
- **Verified live** (2026-09-28): exact match.

### `PATCH /api/admin/settings` (requires `settings.manage`)

- **Body**: any subset of the fields above (percents 0-100)
- **200**: updated settings
- **Notes**: `marketplaceMode` is THE single-vendor/multivendor on/off switch — takes effect for every consuming service within ~30s (cached), no redeploy.

### Admin staff management (requires `admins.manage`)

| Method + path                           | Body                                                                          | Success                       |
| --------------------------------------- | ----------------------------------------------------------------------------- | ----------------------------- |
| `POST /api/admin/admins`                | `{ email, name, password, role: "SUPER_ADMIN"\|"OPS"\|"SUPPORT"\|"FINANCE" }` | `201` created staff account   |
| `GET /api/admin/admins`                 | — (`cursor?`, `limit?`)                                                       | `200 Paginated<AdminAccount>` |
| `POST /api/admin/admins/:id/deactivate` | —                                                                             | `200` (soft-deleted)          |

### Seller management (requires `sellers.approve` / `sellers.kyc`) — mounted at `/api/admin/sellers`

| Method + path                            | Body                               | Permission        | Success                       |
| ---------------------------------------- | ---------------------------------- | ----------------- | ----------------------------- |
| `GET /api/admin/sellers`                 | — (`cursor?`, `limit?`, `status?`) | `sellers.approve` | `200 Paginated<SellerView>`   |
| `GET /api/admin/sellers/:id`             | —                                  | `sellers.approve` | `200` one `SellerView`        |
| `POST /api/admin/sellers/:id/approve`    | —                                  | `sellers.approve` | `200`, `status:"APPROVED"`    |
| `POST /api/admin/sellers/:id/reject`     | `{reason?}`                        | `sellers.approve` | `200`, `status:"REJECTED"`    |
| `POST /api/admin/sellers/:id/suspend`    | —                                  | `sellers.approve` | `200`, `status:"SUSPENDED"`   |
| `POST /api/admin/sellers/:id/reinstate`  | —                                  | `sellers.approve` | `200`, back to `"APPROVED"`   |
| `POST /api/admin/sellers/:id/kyc/verify` | —                                  | `sellers.kyc`     | `200`, `kycStatus:"VERIFIED"` |
| `POST /api/admin/sellers/:id/kyc/reject` | `{reason?}`                        | `sellers.kyc`     | `200`, `kycStatus:"REJECTED"` |
| `POST /api/admin/sellers/:id/commission` | `{commissionRatePercent: Money}`   | `sellers.approve` | `200` seller with new rate    |

`SellerView`: `{ id, displayName, legalName, status, isDefaultSeller,
commissionRatePercent: Money, ownerUserId: Uuid | null, createdAt }`.
Verified live (2026-09-28) against the default seller — `ownerUserId:
null` is expected/correct for the platform's own single-vendor seller.

### Order/fulfillment management (requires `orders.manage`) — mounted at `/api/orders`

| Method + path                                                                     | Body                                     | Success                                                                                                                                                                                                                                                                              |
| --------------------------------------------------------------------------------- | ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `PATCH /api/orders/admin/items/:orderItemId/status`                               | `{ status: "PACKED" }`                   | `200` item — admin-driven pack, the only path that can ever pack the default (unowned) seller's items (Ch7.1)                                                                                                                                                                        |
| `GET /api/orders/admin/sellers/:sellerId/items`                                   | — (`cursor?`, `limit?`, `sellerStatus?`) | `200 Paginated<SellerOrderItemView>` — what a given seller (incl. the default one) needs fulfilled (Ch7.2)                                                                                                                                                                           |
| `GET /api/orders/admin/cancel-requests` (v1.1)                                    | — (`status?`, `cursor?`, `limit?`)       | `200 Paginated<CancelRequestView>` (§8), newest first                                                                                                                                                                                                                                |
| `POST /api/orders/admin/cancel-requests/:id/approve` (v1.1, **`refunds.manage`**) | `{ note?: string }`                      | `200` `{ cancelRequest, refund: {refundId, paymentId, amount, status, razorpayRefundId, blocked} }` — refunds the full `grandTotal` FIRST, then restocks and cancels every unshipped item, then marks the order `CANCELLED`; `409` if already resolved or anything shipped meanwhile |
| `POST /api/orders/admin/cancel-requests/:id/reject` (v1.1)                        | `{ note?: string }`                      | `200` `{ cancelRequest }` with `status:"REJECTED"`; order untouched                                                                                                                                                                                                                  |

v1.1 cancel note: an invoice already issued for an approved-cancel
order is NOT reversed (credit notes are not built yet) — finance handles
that manually for now.

### Inventory management (requires `inventory.manage`) — mounted at `/api/inventory`

| Method + path                     | Body                          | Success                                                        |
| --------------------------------- | ----------------------------- | -------------------------------------------------------------- |
| `POST /api/inventory/:skuId/set`  | `{ available: integer >= 0 }` | `200` `{skuId, available, reserved}`                           |
| `GET /api/inventory/admin/:skuId` | —                             | `200` `{skuId, available, reserved}` (admin stock view, Ch7.2) |

### Settlement management — mounted at `/api/admin/settlements` and `/api/settlements`

| Method + path                     | Body                                                    | Permission             | Success                                                                                                                       |
| --------------------------------- | ------------------------------------------------------- | ---------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `POST /api/admin/settlements/run` | `{ periodStart: ISO, periodEnd: ISO, sellerId?: Uuid }` | `settlements.manage`   | `200` `{results: [{settled:true, settlement:{...Money fields...}} \| {settled:false, sellerId, reason:"NOTHING_TO_SETTLE"}]}` |
| `GET /api/admin/settlements`      | — (`cursor?`, `limit?`)                                 | `settlements.view`     | `200 Paginated<SettlementView>`                                                                                               |
| `GET /api/admin/settlements/:id`  | —                                                       | `settlements.view`     | `200` one `SettlementView`                                                                                                    |
| `GET /api/settlements/me`         | —                                                       | (any logged-in seller) | `200 Paginated<SettlementView>`, caller's own only                                                                            |

`SettlementView` money fields (`grossAmount`, `commissionAmount`,
`tcsAmount`, `tdsAmount`, `netPayable`) are all `Money` strings, verified
live to satisfy `netPayable = gross - commission - tcs - tds` exactly.

### 13.4 Permission reference (exact strings)

`catalog.manage`, `orders.manage`, `inventory.manage`,
`fulfillment.manage`, `returns.manage`, `refunds.manage`,
`search.manage`, `invoices.view`, `invoices.manage`, `settlements.view`,
`settlements.manage`, `sellers.approve`, `sellers.kyc`,
`settings.manage`, `admins.manage`.

Role -> permission map (fixed, in-code, not DB-editable):

| Role          | Permissions                                                                                                    |
| ------------- | -------------------------------------------------------------------------------------------------------------- |
| `SUPER_ADMIN` | all of the above                                                                                               |
| `OPS`         | `catalog.manage`, `orders.manage`, `inventory.manage`, `fulfillment.manage`, `returns.manage`, `search.manage` |
| `FINANCE`     | `invoices.view`, `invoices.manage`, `refunds.manage`, `settlements.view`                                       |
| `SUPPORT`     | (role exists, currently no permissions wired - dormant)                                                        |

The admin dashboard should drive its UI off the LOGGED-IN admin's own
`permissions[]` array (from `/api/admin/login` or `/api/admin/me`), not
by re-deriving from `role` client-side — the array is the source of
truth and may not map 1:1 to the table above in the future.

### Invoice admin (requires `invoices.view` / `invoices.manage`) — mounted at `/api/admin/invoices`

| Method + path                                  | Permission        | Success                                                    |
| ---------------------------------------------- | ----------------- | ---------------------------------------------------------- |
| `GET /api/admin/invoices`                      | `invoices.view`   | `200 Paginated<Invoice>`                                   |
| `GET /api/admin/invoices/:id`                  | `invoices.view`   | `200` one invoice                                          |
| `POST /api/admin/invoices/regenerate/:orderId` | `invoices.manage` | `200` (idempotent — never creates a second invoice number) |

---

## 13a. Support / contact domain (`/api/support`) — v1.1

### `POST /api/support/messages`

- **Auth**: public
- **Body**: `{ name: string (1-200), phone: string (same formats as §8 track), email?: string (valid email), message: string (10-2000) }`
- **201**: `{ "messageId": "Uuid", "reference": "SUP-XXXXXXXX", "receivedAt": "ISO" }` — show `reference` to the user
- **Errors**: `400 VALIDATION_ERROR` (incl. unrecognised phone); `429 RATE_LIMITED` (§14)
- **Notes**: the message is stored for staff and an email is queued to the support inbox. The contact's personal fields are redacted in notification logs.

---

## 14. Rate limits (client-relevant)

| Surface                                                                                       | Limit                                                | Response on exceed |
| --------------------------------------------------------------------------------------------- | ---------------------------------------------------- | ------------------ |
| Every gateway request (IP)                                                                    | 300/60s                                              | `429 RATE_LIMITED` |
| `POST /api/auth/otp/request`                                                                  | 1/60s cooldown + 5/hour, per phone or email          | `429 RATE_LIMITED` |
| `POST /api/auth/otp/verify`                                                                   | 5 wrong attempts per challenge, then must re-request | `429 RATE_LIMITED` |
| `POST /api/admin/login`                                                                       | 10 attempts/15min per IP                             | `429 RATE_LIMITED` |
| `POST /api/orders/checkout`                                                                   | 20 attempts/10min per logged-in user                 | `429 RATE_LIMITED` |
| `POST /api/orders/track` + `POST /api/support/messages` + `POST /api/auth/otp/request` (v1.2) | 20 combined/15min per IP (gateway)                   | `429 RATE_LIMITED` |
| `POST /api/orders/track` (v1.1)                                                               | 10/15min per order number                            | `429 RATE_LIMITED` |
| `POST /api/support/messages` (v1.1)                                                           | 5/hour per phone number                              | `429 RATE_LIMITED` |

A client should treat `429` as "back off and retry later" (not a bug) —
show a clear "too many attempts" message, don't auto-retry immediately.

---

## 15. What's NOT in this contract (excluded — not frontend concerns)

- **`/internal/*`** on every service — service-to-service only (HS256
  service tokens), and additionally hard-blocked at the gateway itself
  (any path containing an `/internal` segment returns the gateway's own
  `404 NOT_FOUND` before even reaching a backend service). A frontend can
  never reach these regardless of what token it sends.
- **`POST /api/payments/webhook`** — called directly by Razorpay's
  servers, authenticated by HMAC signature, not a token. A frontend never
  calls this.
- **Background/scheduled jobs** (nightly search reindex, weekly
  settlement scheduler) — no HTTP surface at all, not reachable by any
  client.
- **`notification-service`** internals — the BullMQ consumer has no
  HTTP surface. Its ONLY public route is `POST /api/support/messages`
  (v1.1, §13a).

---

## 16. Freeze & change policy

This contract is **FROZEN as of chapter-7-complete (2026-09-28)**. The
Chapter 8 frontend and any mobile client are built against exactly what's
written here, verified against the real running system on the freeze
date. If reality and this doc ever disagree again in the future, that's a
regression to fix in code (reality must keep matching THIS doc, not the
other way around) — unless a deliberate, versioned contract change is
being made, in which case: bump to v2, keep v1 endpoints working
unchanged wherever possible (additive), and document the migration here.
Purely additive changes bump the minor version instead (§17).

---

## 17. Change log

### v1.7 — 2026-10-05 (view tracking, additive)

- **Added**: recently viewed — `POST/GET/DELETE /api/catalog/recently-viewed`, `POST /api/catalog/recently-viewed/merge`, and the public `GET /api/catalog/product-cards` — §4. Served by catalog-service (no new service) through the existing `/api/catalog` gateway route; additive migration `20261005070532_view_tracking_recently_viewed` (one new `catalog` table, `catalog_svc` grants). No existing endpoint, shape or status code changed.

### v1.6 — 2026-10-01 (W6, additive)

- **Added**: `PATCH /api/auth/me { name }` — §3.
- **Added**: product reviews (list / mine / submit, purchase-verified, one per customer) — §4. Backed by catalog-service on the least-privilege `reviews_svc` DB role; purchase checks go to order-service's internal `GET /orders/internal/purchases` (service token, not exposed by the gateway).
- **Added**: `OrderView.createdAt`, `OrderView.timeline`, `items[].orderItemId`; `GET /api/orders/:id` also accepts the order number — §8.
- No other change: order history, guest tracking, cancel, notify, wishlist and the contact form use the v1.1 endpoints as documented. The guest wishlist (signed out) is client-side only and merges over `POST /api/wishlist/items` on login (rules: `packages/shared-client/src/guest-wishlist.ts`).

### v1.5 — 2026-10-01 (W5, compatible behaviour change)

- **Changed**: the `payment.failed` webhook no longer cancels the order or releases its stock. Razorpay Checkout lets the customer retry the same Razorpay order after a declined attempt, so the order stays `PENDING_PAYMENT` and `POST /api/payments/razorpay-order` keeps returning the same Razorpay order. Before, "declined, then paid" confirmed nothing and auto-refunded the capture. No request/response shape changed — §9, `payment-api.md`.
- Local development without a public URL: `pnpm dev:razorpay-webhook <razorpay_order_id>` relays the real test payment's signed event (`payment-api.md`, "Local webhooks").

### v1.4 — 2026-10-01 (W4, additive)

- **Added**: `skuId` on `GET /api/catalog/products` items and `GET /api/search/products` results — the cheapest SKU (the one `price`/`mrp` describe), so a listing card can `POST /api/cart/items { skuId, quantity }` without fetching the product. `null` only for a product with no SKU (or one indexed before v1.4 — a reindex fills it) — §4, §5.
- No other endpoint changed: the storefront cart and address book use the existing `/api/cart` and `/api/addresses` endpoints as documented. The guest cart (signed out) is client-side only; merge-on-login is a client flow over `POST /api/cart/items` (rules: `packages/shared-client/src/guest-cart.ts`).

### v1.3 — 2026-09-30 (W3, additive)

- **Added**: attribute-driven catalog. Categories carry a `filterDefinition` (admin `POST|PATCH /api/catalog/categories`, inherited by sub-categories); `GET /api/catalog/categories/:slug/filters` returns it with live facet values/counts — §4.
- **Changed (compatible)**: `GET /api/catalog/products` is now served by the search index: new `category` (slug), `min_price`/`max_price`, `rating`, `sort`, `page` and generic attribute-filter params; items gain `mrp`, `rating`, `ratingCount` (`price` is never `null` now); the page gains `total`, `page`, `perPage`. `nextCursor` remains opaque but is now a page token; `categoryId`/`category` include sub-categories; `q` is full-text relevance instead of a title substring match.
- **Added**: product detail `attributes`, `specifications`, `rating`, `ratingCount`, `categoryPath`; search results `mrp`, `rating` — §4, §5.
- **Added**: absolute image URLs stored by an import are returned as-is (otherwise `CDN_BASE_URL` + key).
- Import format for the bulk catalog: `docs/catalog/IMPORT-SPEC.md`.

### v1.2 — 2026-09-30 (W2, additive)

- **Added**: passwordless login by mobile number OR email through one `identifier` field on `POST /api/auth/otp/request|verify` (v1 `{ phone }` still accepted). Email codes go by email; mobile codes on WhatsApp — §2.1, §3.
- **Added**: `AuthUser` gains `email`, `name`, `isEmailVerified`; `phone` is `null` for email-created accounts; the access token omits the `phone` claim for them — §2.2, §3.
- **Added**: `user` in the `POST /api/auth/refresh` response; `GET /api/auth/me` — §3.
- **Added**: OTP requests share the gateway's per-IP public-form limit — §14.
- **Fixed**: the gateway now strips downstream services' `Access-Control-*` headers so its own origin-specific, credentialed CORS applies. Before, services' `Access-Control-Allow-Origin: *` reached the browser and every credentialed call from the storefront (login, refresh) was blocked.
- A phone and an email are separate accounts (no linking yet).

### v1.1 — 2026-09-29 (W1, additive)

- **Fixed**: refresh cookie `ym_rt` is now `Path=/api/auth` (was `/auth`, never sent to `/api/auth/refresh` through the gateway) — §2.2, §3.
- **Added**: `POST /api/orders/track` (public guest tracking), `POST /api/orders/:id/cancel`, `GET|PUT /api/orders/:id/notify` — §8.
- **Added**: admin `GET /api/orders/admin/cancel-requests`, `POST .../:id/approve`, `POST .../:id/reject` — §13.
- **Added**: `GET /api/wishlist`, `POST /api/wishlist/items`, `DELETE /api/wishlist/items/:wishlistItemId` — §6a.
- **Added**: `POST /api/support/messages` — §13a.
- **Added**: rate limits for the new public endpoints — §14.
- No existing field, status code or auth requirement changed.
