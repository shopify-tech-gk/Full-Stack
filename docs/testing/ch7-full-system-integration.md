# Chapter 7.1 — Full-System Integration Test

**Date:** 2026-09-24
**Branch:** `vijesh` (from `main` @ `chapter-6-complete` / commit `ad56929`)
**Scope:** All 16 backend components (15 services + api-gateway) running simultaneously, exercised end-to-end exactly as production will run it.

This was a TEST + minimal-fix + document exercise, not a feature chapter. Big hardening items are deferred to Chapter 7.2.

## 1. Fresh full-system boot

- Stopped all 15 services, ran `pnpm -r build` clean, restarted every service one-by-one from a clean state (not "already warm" from a previous session).
- Confirmed infra healthy: Postgres 16 (5433), Redis 7, Typesense (8108).
- `GET /health` and `GET /health/services` on the gateway confirmed all 15 services + gateway reporting healthy.
- **Result: PASS.**

## 2. Customer journey (via gateway only)

Register/login (OTP) → search → browse → add address → cart → checkout → payment → webhook-confirm → invoice → notifications → fulfillment (pack → ship → deliver) → invoice download → return → refund → settlement.

- Full flow driven through `http://localhost:4000/api/*` only (never called a service directly except for verification via psql).
- Razorpay **live order-create is BLOCKED** (placeholder API keys → 401 from Razorpay). This is expected/known and was worked around by simulating the payment row and sending a properly HMAC-signed webhook, exactly as done in prior chapters. The **internal confirm chain fully works**: stock reservation → stock commit, invoice generation (number/amount correct), WhatsApp notification logged.
- Fulfillment: pack → ship → deliver completed for **both** items in the order (see Bug #1 below for the seller-owned vs default-seller distinction).
- Invoice download as the owning customer: `200 application/pdf`, 2342 bytes.
- Return flow (second item, default-seller Wireless Mouse):
  - `POST /api/returns` → `REQUESTED`
  - `POST /api/admin/returns/:id/approve` → `APPROVED`, refundAmount auto-defaulted to line total
  - `POST /api/admin/returns/:id/picked-up` → `PICKED_UP`
  - `POST /api/admin/returns/:id/process-refund` → return status `REFUNDED`; refund sub-object `{"status":"FAILED","razorpayRefundId":null,"blocked":true}` — **honestly BLOCKED on Razorpay creds, as expected**, but the response is still `200` and the **internal chain fully completes**: inventory restocked (`available` 36→38), order item `seller_status` → `RETURNED`, `REFUND_PROCESSED` WhatsApp notification logged as `SENT`.
- Settlement for the default seller: `POST /api/admin/settlements/run` → gross `1099.00` (unreturned Wireless Mouse item only), commission `0.00` (default seller's own commission rate is 0%), TCS `10.99` (1% of gross, matching the live admin settings at the time), TDS `0.00` (disabled), netPayable `1088.01` — all figures cross-checked arithmetically and against `GET /api/admin/settings`.
- **Result: PASS** (with the two documented, expected external-credential blocks: Razorpay order-create/refund).

## 3. Admin journey

- Logged in as SUPER_ADMIN, viewed settings (`marketplaceMode: DISABLED`, commission 10%, TCS 1%, TDS disabled).
- Changed TCS to 2.50% via `PATCH /api/admin/settings`, confirmed the change reflected immediately in a subsequent `GET`. (The live-money-math proof that a downstream service picks up a settings change within the settings-client's 30s cache TTL was already rigorously demonstrated in Chapter 6.7b using the same architecture; not repeated here since no new unsettled data existed to re-derive it safely.)
- Reverted TCS back to `1.00%` (documented launch default) after the test.
- Created a new OPS admin (`ops-fullsystem@youmart.dev`) — confirmed granted permissions `catalog.manage, orders.manage, inventory.manage, fulfillment.manage, returns.manage, search.manage` (no `settings.manage`, no `settlements.*`, no `invoices.*`).
- Logged in as the OPS admin and confirmed RBAC scoping:
  - `PATCH /api/admin/settings` → `403 FORBIDDEN` (correctly blocked; OPS lacks `settings.manage`).
  - `GET /api/admin/settlements` → `403 FORBIDDEN` (correctly blocked; OPS lacks `settlements.view`, a FINANCE permission).
  - `GET /api/admin/invoices` → `403 FORBIDDEN` (correctly blocked; OPS lacks `invoices.view`, a FINANCE permission).
  - `PATCH /api/orders/admin/items/:id/status` on a non-existent item → `404 NOT_FOUND` (not `403`) — proves OPS **passed** the `orders.manage` permission gate and reached real business logic, confirming positive access within its own scope.
- **Result: PASS.**

## 4. Cross-service consistency checks

- **Money:** Traced one order's two line items end-to-end. Catalog/cart/order price for "Ch5 Integration Product" (₹999.00 × 2) and "Wireless Mouse" (₹1099.00 × 1) matched exactly in the generated invoice's line items (`invoices.invoice_line.unit_price`). **PASS.**
- **Status:** Confirmed `order.status` (payment lifecycle: `PENDING_PAYMENT|CONFIRMED|CANCELLED`) and `order_item.seller_status` (fulfillment lifecycle: `PENDING|CONFIRMED|PACKED|SHIPPED|DELIVERED|CANCELLED|RETURNED`) are intentionally independent — an order can correctly show `status:"CONFIRMED"` while its items are `DELIVERED`. **Not a bug — documented design.**
- **Auth:** Customer token rejected with `401` on an admin-only endpoint (`GET /api/admin/settings`). Admin token rejected with `401` on a customer-only endpoint (`GET /api/cart`). **PASS.**
- **Idempotency:**
  - Re-running the identical settlement period/seller returned `{"settled": false, "reason": "NOTHING_TO_SETTLE"}` — no duplicate settlement row created. **PASS.**
  - Re-processing the same already-refunded return returned `409 CONFLICT` ("This return has already been refunded"); verified via psql that inventory was **not** double-restocked (`available` stayed at 38, not 40). **PASS.**
- **Address snapshot:** Order `shippingAddress` (fullName "Full System Tester", line1 "42 Test Lane", city Bengaluru, state Karnataka, pincode 560001) matched the invoice's `buyer_name`/`buyer_address`/`buyer_state` fields exactly. **PASS.**

## 5. Resilience spot-checks

- Stopped `notification-service` mid-flow, then performed a return-request and an admin-approve while it was down. Both core operations returned `200` successfully (notification enqueue failure did not block the core flow). Restarted the service afterward and confirmed it came back healthy. **PASS — non-blocking design holds system-wide, not just per-chapter.**
- Sent malformed requests through the gateway:
  - Invalid JSON body to `POST /api/cart/items` → `400 {"error":{"code":"VALIDATION_ERROR","message":"Malformed JSON body"}}`.
  - Invalid field type to `PATCH /api/admin/settings` → `400` with structured Zod `details` array.
  - All responses used the standard `{"error": {...}}` envelope — no raw stack traces or generic HTML error pages were ever returned. **PASS.**

## 6. Findings

### Bug #1 — LAUNCH BLOCKER (found and fixed in this chapter)

**The default seller ("YouMart", `owner_user_id = NULL`) could never have its order items packed, because the only existing seller-fulfillment endpoint (`PATCH /orders/seller/items/:id/status`) resolves seller identity via `getByOwner(userId)`, which can never match a `NULL` owner.** Since the marketplace is hard-disabled at launch, essentially the entire catalog belongs to this default seller — this would have permanently blocked shipping/delivery/settlement for effectively all orders. This was only caught because the full-system test exercised the real default-seller product end-to-end, rather than a synthetic seller-owned test product.

**Fix (minimal, additive, no refactor):**
- `apps/order-service/src/order/seller-order.service.ts`: added `adminUpdateSellerItemStatus(orderItemId, nextStatus)` — same transition table/validation as the existing seller-owned function, but looks up the item by id only (no ownership check).
- `apps/order-service/src/authMiddleware.ts`: added `requireAdmin` export (mirrors the pattern already used by the other 8 admin-integrated services).
- `apps/order-service/src/routes/order.routes.ts`: added `PATCH /orders/admin/items/:orderItemId/status`, gated by the (previously dormant) `orders.manage` permission.

**Verified live:** default-seller item transitioned CONFIRMED → PACKED → (existing ship/deliver flow) → DELIVERED via the new endpoint; the pre-existing seller-owned path was exercised in parallel on the same order to confirm both paths coexist correctly. Full-repo `typecheck` and `build` pass after the fix.

### Known/expected blocks (not bugs — external credentials only)

- Razorpay: order-create and refund both return `401`/blocked with placeholder API keys. Internal chains (stock, invoice, notification, restock) all verified working regardless.
- MSG91 (real WhatsApp templates) and Zoho (refresh token) remain BLOCKED on real credentials, consistent with every prior chapter.

## 7. Summary

| Area | Result |
|---|---|
| Fresh full-system boot (16 components) | PASS |
| Customer journey (search→checkout→payment→invoice→notify→fulfillment→return→settlement) | PASS (Razorpay live calls honestly BLOCKED-on-creds) |
| Admin journey (settings, RBAC, OPS admin) | PASS |
| Cross-service consistency (money/status/auth/idempotency/address) | PASS |
| Resilience (non-critical service down, malformed requests) | PASS |
| Bugs found | 1 (launch blocker — FIXED, see above) |
