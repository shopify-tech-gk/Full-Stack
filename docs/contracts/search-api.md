# Search API Contract

**FROZEN as of `chapter-6-complete` (2026-09-24).** This is the stable
surface other services and the frontend build against. Changes after this
freeze must be additive where possible (new optional fields, new endpoints)
or require a version bump communicated to all consumers - do not silently
change a shape or status code of an endpoint listed here.

## Base URL

Search service (`@youmart/search-service`), port **4013** in dev
(`http://localhost:4013`). Public routes are reached through the gateway
at `/api/search/*` (Ch6.6).

## Data model

`search-service` is the ONE service in this repo that is NOT a Postgres
client - it owns no schema, has no `_svc` role, and never imports
`@youmart/db`. Typesense is its only datastore, a rebuildable derived read
model of `catalog-service`'s products (the actual source of truth), kept
in sync via a real-time reindex queue + a nightly full-reindex safety net
(BullMQ, `full-reindex.queue.ts`).

## Endpoints

### `GET /health` / `GET /ready`

Same shape as [auth-api.md](./auth-api.md) (`service: "search"`; `/ready`
checks Typesense connectivity, not Postgres).

### `GET /products` (optionalAuth - public)

Query: `{ q?, category? (uuid), minPrice?, maxPrice?, brand?, sort? ('relevance'|'price_asc'|'price_desc'|'newest'), page?, perPage? }`.

Response: `{ results: [{id, title, slug, price, primaryImageUrl, categoryName}], facets: {category, brand, price}, found, page, perPage }`.

**Typo-tolerant** (Typesense's built-in fuzzy matching) - verified live: a
query with a typo (`"vaccum"`) still matched "Robot Vacuum Cleaner".

### `GET /suggest` (optionalAuth - public)

Query: `{ q, limit? }`. Lightweight autocomplete-style suggestions.

### `POST /admin/reindex` (requireAdmin('search.manage'))

Manual full-reindex trigger for ops/testing (Ch6.7a real RBAC - replaces
the retired `ADMIN_USER_IDS` gate). The real safety net is the nightly
scheduled job; this exists to force a rebuild on demand.

## Verified live (Ch6.8 end-to-end integration)

`GET /api/search/products?q=vaccum` through the gateway returned "Robot
Vacuum Cleaner" (typo tolerance confirmed); a follow-up search after a
real checkout/order confirmed the index stayed consistent with reality.
