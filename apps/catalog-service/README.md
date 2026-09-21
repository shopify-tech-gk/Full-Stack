# @youmart/catalog-service

Read-only public catalog browsing: list/browse products, product detail,
categories. Follows the auth-service skeleton template (config, logger, db,
errors, health/ready, error envelope, graceful shutdown).

## Run

```
pnpm --filter @youmart/catalog-service dev
```

## Dev seed

Idempotent, local-testing-only seed (separate from the Chapter 2 main
`db:seed`, never wired into it):

```
pnpm --filter @youmart/catalog-service seed:dev
```

Requires `DEFAULT_SELLER_ID` in `.env` (see comment there) - `catalog_svc`
cannot read the `sellers` schema, so the default seller's id is looked up
once via the owner role and passed in as an env var.

## Endpoints

- `GET /health` - liveness. Never touches the DB.
- `GET /ready` - readiness. Runs `SELECT 1` against the database.
- `GET /catalog/products` - paginated, filterable product list (`categoryId`, `minPrice`, `maxPrice`, `q`). `optionalAuth`.
- `GET /catalog/products/:slug` - single product with SKUs + images. `optionalAuth`.
- `GET /catalog/categories` - category list. `optionalAuth`.

Only `ACTIVE`, non-deleted products/SKUs are ever returned. Money fields are
decimal strings (e.g. `"1299.00"`). Image URLs are absolute, built from
`CDN_BASE_URL` + the stored path.

## Database connection

Connects as the least-privilege `catalog_svc` Postgres role (Chapter 2's
roles/grants migration), not the migration/owner role - it can only
read/write the `catalog` schema.
