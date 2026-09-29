-- W1: follow-up to 20260929114859_w1_wishlist_support_cancel_notify. The tables were created in
-- that migration; this one adds the pieces Prisma cannot express (same pattern as every schema
-- in this repo): partial unique indexes scoped to non-deleted rows, and explicit grants.
--
-- 1. One ACTIVE wishlist row per (user, sku) - the DB backstop behind wishlist.service.ts's
--    "already there? return the list" check.
CREATE UNIQUE INDEX "wishlist_item_user_id_sku_id_active_key" ON "cart"."wishlist_item"("user_id", "sku_id") WHERE "deleted_at" IS NULL;

-- 2. At most ONE open (REQUESTED) cancel request per order - a race between two customer
--    submissions can never create two requests for an admin to approve twice.
CREATE UNIQUE INDEX "order_cancel_request_order_id_open_key" ON "orders"."order_cancel_request"("order_id") WHERE "status" = 'REQUESTED' AND "deleted_at" IS NULL;

-- 3. One ACTIVE notify preference per order.
CREATE UNIQUE INDEX "order_notify_preference_order_id_active_key" ON "orders"."order_notify_preference"("order_id") WHERE "deleted_at" IS NULL;

-- 4. Least-privilege access. No new schema and no new role: each table sits in a schema whose
--    "<schema>_svc" role already receives CRUD on new tables via ALTER DEFAULT PRIVILEGES (Ch2).
--    Granted explicitly as well so the intent is auditable here and holds even if the tables
--    were created by a different role than the one that set those defaults. Idempotent.
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "cart"."wishlist_item" TO "cart_svc";
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "orders"."order_cancel_request" TO "orders_svc";
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "orders"."order_notify_preference" TO "orders_svc";
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "notifications"."support_message" TO "notifications_svc";
