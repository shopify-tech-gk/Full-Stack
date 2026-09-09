# @youmart/shared-types

The single source of truth for cross-cutting data shapes used across every YouMart backend
service and frontend.

## Rule: Zod first, derive types

We define [Zod](https://zod.dev) schemas, and derive TypeScript types from them with
`z.infer<typeof Schema>`. Validation and types always come from the same definition, so
frontend and backend can never disagree about a shape.

Do not hand-write a `type`/`interface` that duplicates a schema - if you need a type, infer it.

## What's here

- `common.ts` - `Uuid`, `Money` (decimal string, never a number), `Timestamp`, and the
  `Paginated()` cursor-pagination helper.
- `errors.ts` - `ApiErrorCode` and the standard `ApiError` envelope.
- `pagination.ts` - `PaginationQuery` for incoming cursor/limit request params.

## What's NOT here

No domain schemas (product, order, user, seller, cart, payment, etc.) live in this package.
Those belong to their own dedicated packages/chapters. This package only holds primitives that
every domain schema will build on top of.
