-- Ch6.1 (address-service): follow-up to 20260921111904_init_addresses_schema.
-- The table itself was created in the prior migration; this migration adds
-- the two pieces that must be hand-written SQL (same pattern as every other
-- schema in this repo - Prisma cannot express either of these
-- declaratively):
--
-- 1. A PARTIAL UNIQUE INDEX enforcing at most ONE default address per user
--    among ACTIVE (non-soft-deleted) rows - mirrors sellers.seller's
--    "is_default_seller" partial unique index (Ch2) exactly. This is the
--    actual database-level guarantee against a race producing two
--    defaults for the same user; address.service.ts's transactional
--    unset-others logic is a courtesy for a clean read path on top of it.
CREATE UNIQUE INDEX "address_user_id_default_active_key" ON "addresses"."address"("user_id") WHERE "is_default" = true AND "deleted_at" IS NULL;

-- 2. The least-privilege "addresses_svc" runtime role (same pattern as
--    every "<schema>_svc" role created in the Ch2 consolidated roles
--    migration) - USAGE + CRUD on the addresses schema only, no access to
--    any other schema, no DDL. Idempotent (guarded CREATE ROLE + naturally
--    idempotent GRANT/ALTER DEFAULT PRIVILEGES), same as every other role
--    migration in this repo.
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'addresses_svc') THEN
    CREATE ROLE "addresses_svc" LOGIN PASSWORD 'addresses_svc_dev_pw';
  END IF;
END
$$;
GRANT USAGE ON SCHEMA "addresses" TO "addresses_svc";
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA "addresses" TO "addresses_svc";
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA "addresses" TO "addresses_svc";
ALTER DEFAULT PRIVILEGES IN SCHEMA "addresses" GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO "addresses_svc";
ALTER DEFAULT PRIVILEGES IN SCHEMA "addresses" GRANT USAGE, SELECT ON SEQUENCES TO "addresses_svc";
