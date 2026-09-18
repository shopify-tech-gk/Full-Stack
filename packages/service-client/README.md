# @youmart/service-client

Typed HTTP client machinery for synchronous service-to-service calls on the
critical path (cart -> inventory, cart -> catalog, order -> inventory,
order -> catalog, payment -> order, ...). This is transport only - no
business logic lives here.

## Why synchronous HTTP (not shared DB, not queues)

Each service owns its own schema and Postgres role - there is no shared DB
access across services. Queues (`@youmart/queue`) are for async/background
work. Critical-path operations (checking stock, reading a price, reserving
inventory) need an immediate answer to decide what to do next, so they go
over plain HTTP with a strict timeout, not a queue round-trip.

## Timeouts

Every call enforces a `timeoutMs` (default `5000`) via `AbortController`. A
hung downstream service must never hang the caller - on timeout the call
throws `AppError('INTERNAL_ERROR', 503, 'Upstream service timeout')`.

## Error mapping

- Downstream non-2xx response matching our `ApiError` envelope (`{ error:
{ code, message, details? } }`) -> rethrown as an `AppError` with the
  SAME `code`/status/`message` - a downstream 409 "insufficient stock"
  surfaces as a 409 `AppError` with code `CONFLICT` in the caller, so
  business errors propagate meaningfully.
- Downstream non-2xx response that ISN'T our envelope (unexpected shape) ->
  `AppError('INTERNAL_ERROR', 502, 'Upstream service error')` - the raw
  body is never leaked.
- Network failure (connection refused, DNS, etc) ->
  `AppError('INTERNAL_ERROR', 503, 'Upstream service unavailable')`.

## Auth-token forwarding

Every client method takes an `authToken` forwarded as `Authorization: Bearer
<authToken>` - today this is simply the calling user's own access token,
forwarded on their behalf. A dedicated service-to-service auth token can
replace/augment this later without changing any method signature.

## Factory / injected baseUrl pattern

Like `@youmart/auth-middleware`, this package never reads `process.env`.
Each client is created with its `baseUrl` (and optional `timeoutMs`)
injected by the caller:

```ts
import { createInventoryClient } from '@youmart/service-client';

const inventory = createInventoryClient({ baseUrl: config.inventoryServiceUrl });
const stock = await inventory.getStock(skuId, req.auth.accessToken);
```

## Known gap: `getSku(skuId)`

`createCatalogClient().getSku(skuId)` is a typed method signature only -
catalog-service does not yet expose a lookup by `skuId` (only `GET
/catalog/products/:slug`). Cart/checkout need to look up price + active
status for a SKU by id. **4.4b (or a small catalog-service addition) must
add `GET /catalog/skus/:skuId`** (or `/internal/skus/:skuId`) returning the
`SkuDetail` shape before this method can be used for real - calling it
today will 404.
