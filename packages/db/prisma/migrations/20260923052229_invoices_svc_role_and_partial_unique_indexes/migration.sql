-- Ch6.4 (invoice-service): follow-up to
-- 20260923052155_add_product_hsn_gst_rate_and_invoices_schema. The tables
-- themselves were created in the prior migration; this migration adds the
-- pieces that must be hand-written SQL (same pattern as every other schema
-- in this repo - Prisma cannot express any of these declaratively):
--
-- 1. A PARTIAL UNIQUE INDEX on invoice.order_id (WHERE deleted_at IS NULL) -
--    at most ONE active invoice per order. This is the actual
--    database-level backstop against generateInvoice() ever creating a
--    second invoice for the same order; invoice.service.ts's own
--    "existing invoice? return it" idempotency check is the primary
--    guard, this index is defense-in-depth against a race.
CREATE UNIQUE INDEX "invoice_order_id_active_key" ON "invoices"."invoice"("order_id") WHERE "deleted_at" IS NULL;

-- 2. A PARTIAL UNIQUE INDEX on invoice.invoice_number (WHERE deleted_at IS
--    NULL) - the DB-level backstop against a duplicate sequential invoice
--    number. The actual generation is concurrency-safe by construction
--    (invoiceNumber.service.ts's atomic per-financial-year counter row
--    UPDATE), so this index should never actually be hit in practice - it
--    exists purely so a bug can never silently produce two invoices with
--    the same legally-significant number.
CREATE UNIQUE INDEX "invoice_invoice_number_active_key" ON "invoices"."invoice"("invoice_number") WHERE "deleted_at" IS NULL;

-- 3. The least-privilege "invoices_svc" runtime role (same pattern as every
--    "<schema>_svc" role created in the Ch2 consolidated roles migration
--    and Ch6.1's addresses_svc) - USAGE + CRUD on the invoices schema
--    only, no access to any other schema, no DDL. Idempotent (guarded
--    CREATE ROLE + naturally idempotent GRANT/ALTER DEFAULT PRIVILEGES).
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'invoices_svc') THEN
    CREATE ROLE "invoices_svc" LOGIN PASSWORD 'invoices_svc_dev_pw';
  END IF;
END
$$;
GRANT USAGE ON SCHEMA "invoices" TO "invoices_svc";
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA "invoices" TO "invoices_svc";
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA "invoices" TO "invoices_svc";
ALTER DEFAULT PRIVILEGES IN SCHEMA "invoices" GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO "invoices_svc";
ALTER DEFAULT PRIVILEGES IN SCHEMA "invoices" GRANT USAGE, SELECT ON SEQUENCES TO "invoices_svc";
