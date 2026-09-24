# Invoice API Contract

**FROZEN as of `chapter-6-complete` (2026-09-24).** This is the stable
surface other services and the frontend build against. Changes after this
freeze must be additive where possible (new optional fields, new endpoints)
or require a version bump communicated to all consumers - do not silently
change a shape or status code of an endpoint listed here.

## Base URL

Invoice service (`@youmart/invoice-service`), port **4014** in dev
(`http://localhost:4014`). Public routes are reached through the gateway
at `/api/invoices/*` and `/api/admin/invoices/*` (Ch6.6).

## Generation

An invoice is generated automatically (queued, non-blocking) when an order
is confirmed (payment captured) - GST-compliant, back-calculated from
inclusive prices, CGST/SGST or IGST depending on buyer vs. seller state,
sequential financial-year invoice numbering (`YM/<FY>/<seq>`). Generation
is idempotent: an existing invoice for the order is returned as-is, never
duplicated / never issued a second invoice number.

## Ownership model

A customer may only ever see/download THEIR OWN order's invoice - a
mismatch (or no invoice yet) is a 404, never a 403 (never confirms the
invoice/order exists for someone else).

## Endpoints

### `GET /health` / `GET /ready`

Same shape as [auth-api.md](./auth-api.md) (`service: "invoice"`; `/ready`
checks Postgres as the `invoices_svc` role).

### `GET /order/:orderId` (requireAuth)

Invoice metadata (JSON) for the caller's own order. 404 if none exists yet
or it belongs to someone else.

### `GET /order/:orderId/download` (requireServiceOrUser, Ch6.5)

Streams the generated PDF (`Content-Type: application/pdf`,
`Content-Disposition: attachment`). The owning customer's own token OR a
valid service token may call this; anyone else gets 404.

Verified live (Ch6.8): owner download -> `200`, real PDF bytes; a
different user's token -> `404 {"error":{"code":"NOT_FOUND",...}}`.

### `GET /admin/invoices` (requireAdmin('invoices.view'))

Lists all invoices (Ch6.7a RBAC - replaces the retired `ADMIN_USER_IDS`
gate).

### `GET /admin/invoices/:id` (requireAdmin('invoices.view'))

One invoice's full detail.

### `POST /admin/invoices/regenerate/:orderId` (requireAdmin('invoices.manage'))

Re-triggers generation for an order whose queued job failed or was never
enqueued - idempotent (same guarantee as automatic generation, never a
second invoice number).

## Verified live (Ch6.8 end-to-end integration)

A real order confirmed via the Razorpay webhook path produced a real
sequential invoice (`YM/2026-27/00006`, `grand_total=1998.00`) with no
manual trigger, and the owner successfully downloaded the real PDF through
the gateway.
