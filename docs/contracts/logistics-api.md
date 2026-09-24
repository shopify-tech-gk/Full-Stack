# Logistics API Contract

**FROZEN as of `chapter-6-complete` (2026-09-24), originally frozen at
`chapter-5-complete`.** This is the stable
surface other services and the frontend build against. Changes after this
freeze must be additive where possible (new optional fields, new endpoints)
or require a version bump communicated to all consumers - do not silently
change a shape or status code of an endpoint listed here.

## Base URL

Logistics service (`@youmart/logistics-service`), port **4009** in dev
(`http://localhost:4009`).

## Common envelope

Same `ApiError` shape as [auth-api.md](./auth-api.md).

## Shipping provider foundation

`providers/provider.interface.ts` defines a `ShippingProvider` interface
(`createShipment`/`getTracking`/`cancelShipment` required,
`checkServiceability`/`getRate` optional) and a `FulfillmentMode` of
`'PLATFORM' | 'SELLER'`. `providers/registry.ts` exposes
`registerProvider`/`getProvider`. The launch default
(`DEFAULT_SHIPPING_PROVIDER=manual`) is `ManualProvider`
(`providers/manual.provider.ts`) - no external courier API calls, just
echoes back the entered AWB. Adding a real courier integration in a later
chapter is a single new provider file plus a registry entry - the
route/service layer does not need to change.

## Shipment status model

```
CREATED -> PICKED_UP -> IN_TRANSIT -> DELIVERED
              \-> RTO
                    \-> CANCELLED (from CREATED only)
```

Enforced by `ALLOWED_SHIPMENT_TRANSITIONS` - an out-of-order transition
(e.g. `CREATED` straight to `DELIVERED`) returns `409 CONFLICT`
(`"Cannot transition shipment status from X to Y"`). Verified live during
integration testing: attempting `CREATED -> DELIVERED` directly was
correctly rejected; the full `CREATED -> PICKED_UP -> IN_TRANSIT ->
DELIVERED` chain succeeded.

**Important fix (made during Ch5.4 verification, carried forward here):**
`addTrackingEvent` drives the shipment's own `status` forward for **any**
recognized status via `mapTrackingStatus`, not only `DELIVERED` - this was
found to be inconsistent in an earlier draft and corrected. Only
`DELIVERED` additionally drives `order_item.seller_status` forward
(`SHIPPED -> DELIVERED`), since that is the hand-off that makes an item
settleable (see [settlement-api.md](./settlement-api.md)).

## Endpoints

### `GET /health` / `GET /ready`

Same shape as [auth-api.md](./auth-api.md) (`service: "logistics"`;
`/ready` checks Postgres as the `logistics_svc` role, which also has grants
on the `tracking` schema - a deliberate single-role decision, see the
Ch5.4 migration `20260921090000_logistics_svc_tracking_schema_grant`).

### `POST /logistics/seller/shipments`

Seller-owned shipment creation (`requireActiveSeller`). Requires the
order_item to be `PACKED` and owned by the caller's seller; enforces
AWB uniqueness. Drives `order_item.sellerStatus` `PACKED -> SHIPPED` and
records an initial `CREATED` tracking event.

Request body: `{ orderItemId: string (uuid), carrier?: string, awbNumber?: string, fulfillmentMode?: 'PLATFORM'|'SELLER' }`

- **201**:
  ```json
  {
    "id": "<uuid>",
    "orderItemId": "<uuid>",
    "carrier": "string",
    "awbNumber": "string",
    "status": "CREATED",
    "providerRef": "string",
    "createdAt": "<iso>",
    "updatedAt": "<iso>"
  }
  ```
- **409** `CONFLICT`: order_item isn't `PACKED`, or the AWB is already in use

### `POST /logistics/shipments` (admin, `PLATFORM` fulfillment path)

Same shape as the seller route above, gated by
`requireAdmin('fulfillment.manage')` (Ch6.7a real RBAC) instead of seller
ownership - for launch (single-vendor), YouMart itself ships every order,
so this **is** the launch fulfillment path.

### `PATCH /logistics/shipments/:id/status`

Admin-only direct status update. Body: `{ status: ShipmentStatus }`.
Subject to the same `ALLOWED_SHIPMENT_TRANSITIONS` guard.

### `POST /logistics/shipments/:id/tracking`

Admin-only. Records a new tracking event and drives the shipment status
forward per `mapTrackingStatus` (see above).

Request body: `{ status: string, location?: string, occurredAt?: string (iso) }`

- **200**: shipment detail including the full `events` array
- **409** `CONFLICT`: the implied status transition is invalid

### `POST /logistics/shipments/:id/delivered`

Admin-only convenience endpoint - marks the shipment `DELIVERED`
directly (must already be `IN_TRANSIT`, same transition guard as above).

### `GET /logistics/shipments/:id`

Admin/seller detail view including full tracking history.

### `GET /logistics/track/order-item/:orderItemId`

Customer-facing tracking. Requires `requireAuth`; verifies the caller owns
the underlying order via `orderClient.getInternalOrderItem` - returns
`404` (never revealing existence) if the order_item isn't the caller's own.

- **200**: shipment status + tracking event history
- **404** `NOT_FOUND`: no shipment, or the order_item belongs to a different user

## Real integration-test evidence (chapter-5-complete)

A real end-to-end run: seller created a shipment for a `PACKED` item
(`PACKED -> SHIPPED` confirmed), then drove it through
`PICKED_UP -> IN_TRANSIT -> DELIVERED` via three real
`POST /logistics/shipments/:id/tracking` calls (an initial attempted
`CREATED -> DELIVERED` skip was correctly rejected with `409`), confirming
`order_item.sellerStatus` reached `DELIVERED` only once the shipment
itself reached `DELIVERED`.
