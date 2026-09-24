# Catalog API Contract

**FROZEN as of `chapter-6-complete` (2026-09-24), originally frozen at
`chapter-4-complete`.** This is the stable
surface other services and the frontend build against. Changes after this
freeze must be additive where possible (new optional fields, new endpoints)
or require a version bump communicated to all consumers - do not silently
change a shape or status code of an endpoint listed here.

## Base URL

Catalog service (`@youmart/catalog-service`), port **4002** in dev
(`http://localhost:4002`). No path prefix beyond what's listed below.

## Common envelope

All error responses use this shape (`@youmart/shared-types` `ApiError`):

```json
{ "error": { "code": "VALIDATION_ERROR", "message": "string", "details": /* optional, unknown */ } }
```

`ApiErrorCode`: `VALIDATION_ERROR`, `UNAUTHORIZED`, `FORBIDDEN`, `NOT_FOUND`,
`CONFLICT`, `RATE_LIMITED`, `INTERNAL_ERROR`.

Unmatched routes → `404` `NOT_FOUND`. Malformed JSON body or a Zod
validation failure → `400` `VALIDATION_ERROR` (includes `details: issues[]`).
Unknown/internal errors → `500` `INTERNAL_ERROR` (generic message in
production, real message in dev).

See [cross-cutting-notes.md](./cross-cutting-notes.md) for the (now
RETIRED, Ch6.7a/b) history of the `ADMIN_USER_IDS`/`MARKETPLACE_MODE`
stop-gaps the write endpoints below used to rely on - they now use real
RBAC (`requireAdmin('catalog.manage')`).

## Endpoints

### `GET /health` / `GET /ready`

Same shape as [auth-api.md](./auth-api.md)'s health/ready endpoints
(`service: "catalog"`; `/ready` checks Postgres as the `catalog_svc` role).

### Public read endpoints (`optionalAuth` - work with or without a bearer token)

#### `GET /products`

List **only `ACTIVE`, non-deleted** products. `DRAFT`/`ARCHIVED` products are
never visible here regardless of filters.

Query params (Zod, all optional):

```
cursor?: string           // opaque, from a previous response's nextCursor
limit?: number            // 1-100, default 20 (coerced from query string)
categoryId?: string (uuid)
minPrice?: number         // filters on sellingPrice, does NOT change displayed price
maxPrice?: number
q?: string                // case-insensitive title contains-match, 1-200 chars
```

- **200**:
  ```json
  {
    "items": [
      {
        "id": "<uuid>",
        "title": "string",
        "slug": "string",
        "price": "1299.00 | null",
        "imageUrl": "string | null",
        "category": { "id": "<uuid>", "name": "string", "slug": "string" }
      }
    ],
    "nextCursor": "string | null"
  }
  ```
  `price` is the **minimum `sellingPrice` across all of the product's
  non-deleted SKUs** (a "from ₹X" storefront price), independent of any
  `minPrice`/`maxPrice` filter used to select the product. `imageUrl` is
  the first (lowest `position`) non-deleted image, built from
  `CDN_BASE_URL` + the stored path, or `null` if none.
- **400** `VALIDATION_ERROR`: malformed query params

#### `GET /products/:slug`

Full product detail. Same `ACTIVE`/non-deleted visibility rule as the list.

- **200**:
  ```json
  {
    "id": "<uuid>",
    "title": "string",
    "slug": "string",
    "description": "string | null",
    "category": { "id": "<uuid>", "name": "string", "slug": "string" },
    "skus": [
      {
        "id": "<uuid>",
        "skuCode": "string",
        "mrp": "1499.00",
        "sellingPrice": "1299.00",
        "attributes": { "...": "unknown JSON" }
      }
    ],
    "images": [{ "id": "<uuid>", "url": "string", "position": 0 }]
  }
  ```
- **404** `NOT_FOUND`: no matching `ACTIVE`, non-deleted product for that slug

#### `GET /categories`

- **200**: `{ "items": [{ "id": "<uuid>", "name": "string", "slug": "string", "parentId": "<uuid> | null" }] }`

#### `GET /skus/:skuId`

Internal-ish lookup used by cart/order-service via `@youmart/service-client`
(forwarded end-user bearer token, `optionalAuth`). Unlike `/products/:slug`,
a SKU belonging to a `DRAFT`/`ARCHIVED`/deleted product is **not** a 404 -
it returns `active: false` so a caller can distinguish "doesn't exist" from
"exists but can't be sold right now". Only a missing/deleted SKU itself
404s.

- **200**:
  ```json
  {
    "skuId": "<uuid>",
    "productId": "<uuid>",
    "productSlug": "string",
    "title": "string",
    "sellerId": "<uuid>",
    "sellingPrice": "1299.00",
    "mrp": "1499.00",
    "active": true
  }
  ```
  `sellerId` is the product's seller (today, always the single default
  seller - see cross-cutting notes) and is the **only** authoritative
  source of a SKU's seller for order-service, which cannot read the
  catalog schema directly.
- **404** `NOT_FOUND`: SKU doesn't exist or is soft-deleted

### Write endpoints (`requireAdmin('catalog.manage')`, Ch6.7a real RBAC)

All of the following require a valid ADMIN RS256 token whose role grants
the `catalog.manage` permission (see [admin-api.md](./admin-api.md)) -
otherwise `401`/`403`.

#### `POST /products`

Request body (Zod):

```
{
  title: string              // 1-300 chars
  description?: string       // max 5000 chars
  categoryId: string (uuid)  // must reference an existing, non-deleted category
  attributes?: Record<string, unknown>   // default {}
  skus: [{ skuCode?: string, mrp: Money, sellingPrice: Money, attributes?: object }]  // min 1
  images?: [{ url: string, position?: number }]  // default []
  status?: "DRAFT" | "ACTIVE" | "ARCHIVED"  // default "DRAFT"
}
```

`slug` is server-generated from `title` (unique, retried with a random
suffix on collision). Any `skuCode` omitted is server-generated. Every SKU's
`sellingPrice` must not exceed its `mrp`.

- **201**: `AdminProductDetail` (same as the detail shape above, plus `status` and `sellerId`)
- **400** `VALIDATION_ERROR`: malformed body, `categoryId` doesn't exist, or a SKU's `sellingPrice > mrp`
- **403** `FORBIDDEN`: not a catalog manager

#### `PATCH /products/:id`

Partial update - at least one field required. Body: any of `title`,
`description` (nullable), `categoryId`, `attributes`, `status` (only the
transitions `DRAFT→ACTIVE`, `ACTIVE→ARCHIVED`, `ARCHIVED→ACTIVE` are
allowed; same-status is a no-op).

- **200**: `AdminProductDetail`
- **400** `VALIDATION_ERROR`: empty body, invalid status transition, or bad `categoryId`
- **404** `NOT_FOUND`: no such product

#### `DELETE /products/:id`

Soft-delete (`deletedAt` set) - never a hard delete.

- **204**: no body
- **404** `NOT_FOUND`

#### `POST /products/:id/skus`

Add a SKU to an existing product. Same `SkuInput` shape as above (one SKU,
not an array).

- **201**: `AdminProductDetail` (full product, including the new SKU)
- **400** `VALIDATION_ERROR`: `sellingPrice > mrp`, or the (optional)
  `skuCode` is already in use
- **404** `NOT_FOUND`: no such product

#### `PATCH /skus/:id`

Partial update - at least one of `mrp`, `sellingPrice`, `attributes`.

- **200**: `AdminProductDetail`
- **400** `VALIDATION_ERROR`: empty body, or resulting `sellingPrice > mrp`
- **404** `NOT_FOUND`: no such SKU

#### `POST /products/:id/images` / `DELETE /images/:id`

Add or soft-delete a product image.

- **201** (add): `AdminProductDetail`
- **204** (delete): no body
- **404** `NOT_FOUND`

#### `POST /categories` / `PATCH /categories/:id`

`slug` is server-generated from `name` the same way as products.

- **201**/**200**: `{ "id": "<uuid>", "name": "string", "slug": "string", "parentId": "<uuid> | null" }`
- **400** `VALIDATION_ERROR`: empty patch body
- **404** `NOT_FOUND` (patch only)
