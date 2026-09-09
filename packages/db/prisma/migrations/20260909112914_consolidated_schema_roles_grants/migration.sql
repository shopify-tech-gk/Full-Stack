-- ============================================================================
-- Consolidated per-schema least-privilege RUNTIME roles + GRANTs.
-- ----------------------------------------------------------------------------
-- One dedicated Postgres role per module schema (e.g. "auth_svc" for the
-- "auth" schema), each granted USAGE + SELECT/INSERT/UPDATE/DELETE on ONLY
-- its own schema's tables/sequences - no access to any other schema, no
-- CREATE/DDL privileges. This enforces module isolation at the database
-- level: a bug in one service cannot read or write another module's tables,
-- even if the application code tries to.
--
-- Prisma migrations continue to run as the owner role (youmart_dev, the
-- DATABASE_URL user in prisma.config.ts) - that role needs DDL privileges
-- these scoped runtime roles deliberately do NOT have. Wiring each future
-- service to connect using its own "<schema>_svc" role/connection string
-- instead of the owner role is a DEPLOY-chapter concern, not done here.
--
-- Dev passwords below are obvious, non-secret local placeholders
-- ("<schema>_svc_dev_pw"), matching this repo's other local dev credentials
-- (see .env.example). Production credentials/secrets management (rotation,
-- a secrets manager, per-environment values, etc.) is a deploy-chapter task.
--
-- Idempotent by design: CREATE ROLE has no IF NOT EXISTS, so each role is
-- created inside a DO block guarded by a pg_roles existence check; every
-- GRANT / ALTER DEFAULT PRIVILEGES statement below is naturally idempotent
-- (re-granting an already-held privilege is a no-op, not an error) - running
-- this whole file a second time must succeed with no errors.
-- ============================================================================

-- The "recommendations" schema is declared in the datasource block but has
-- no tables yet (a future Python service owns it) - create it here so its
-- runtime role can be fully provisioned now and is ready the moment tables
-- are added, without a follow-up migration.
CREATE SCHEMA IF NOT EXISTS "recommendations";

-- admin
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'admin_svc') THEN
    CREATE ROLE "admin_svc" LOGIN PASSWORD 'admin_svc_dev_pw';
  END IF;
END
$$;
GRANT USAGE ON SCHEMA "admin" TO "admin_svc";
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA "admin" TO "admin_svc";
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA "admin" TO "admin_svc";
ALTER DEFAULT PRIVILEGES IN SCHEMA "admin" GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO "admin_svc";
ALTER DEFAULT PRIVILEGES IN SCHEMA "admin" GRANT USAGE, SELECT ON SEQUENCES TO "admin_svc";

-- auth
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'auth_svc') THEN
    CREATE ROLE "auth_svc" LOGIN PASSWORD 'auth_svc_dev_pw';
  END IF;
END
$$;
GRANT USAGE ON SCHEMA "auth" TO "auth_svc";
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA "auth" TO "auth_svc";
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA "auth" TO "auth_svc";
ALTER DEFAULT PRIVILEGES IN SCHEMA "auth" GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO "auth_svc";
ALTER DEFAULT PRIVILEGES IN SCHEMA "auth" GRANT USAGE, SELECT ON SEQUENCES TO "auth_svc";

-- sellers
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'sellers_svc') THEN
    CREATE ROLE "sellers_svc" LOGIN PASSWORD 'sellers_svc_dev_pw';
  END IF;
END
$$;
GRANT USAGE ON SCHEMA "sellers" TO "sellers_svc";
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA "sellers" TO "sellers_svc";
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA "sellers" TO "sellers_svc";
ALTER DEFAULT PRIVILEGES IN SCHEMA "sellers" GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO "sellers_svc";
ALTER DEFAULT PRIVILEGES IN SCHEMA "sellers" GRANT USAGE, SELECT ON SEQUENCES TO "sellers_svc";

-- catalog
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'catalog_svc') THEN
    CREATE ROLE "catalog_svc" LOGIN PASSWORD 'catalog_svc_dev_pw';
  END IF;
END
$$;
GRANT USAGE ON SCHEMA "catalog" TO "catalog_svc";
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA "catalog" TO "catalog_svc";
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA "catalog" TO "catalog_svc";
ALTER DEFAULT PRIVILEGES IN SCHEMA "catalog" GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO "catalog_svc";
ALTER DEFAULT PRIVILEGES IN SCHEMA "catalog" GRANT USAGE, SELECT ON SEQUENCES TO "catalog_svc";

-- inventory
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'inventory_svc') THEN
    CREATE ROLE "inventory_svc" LOGIN PASSWORD 'inventory_svc_dev_pw';
  END IF;
END
$$;
GRANT USAGE ON SCHEMA "inventory" TO "inventory_svc";
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA "inventory" TO "inventory_svc";
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA "inventory" TO "inventory_svc";
ALTER DEFAULT PRIVILEGES IN SCHEMA "inventory" GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO "inventory_svc";
ALTER DEFAULT PRIVILEGES IN SCHEMA "inventory" GRANT USAGE, SELECT ON SEQUENCES TO "inventory_svc";

-- cart
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'cart_svc') THEN
    CREATE ROLE "cart_svc" LOGIN PASSWORD 'cart_svc_dev_pw';
  END IF;
END
$$;
GRANT USAGE ON SCHEMA "cart" TO "cart_svc";
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA "cart" TO "cart_svc";
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA "cart" TO "cart_svc";
ALTER DEFAULT PRIVILEGES IN SCHEMA "cart" GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO "cart_svc";
ALTER DEFAULT PRIVILEGES IN SCHEMA "cart" GRANT USAGE, SELECT ON SEQUENCES TO "cart_svc";

-- orders
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'orders_svc') THEN
    CREATE ROLE "orders_svc" LOGIN PASSWORD 'orders_svc_dev_pw';
  END IF;
END
$$;
GRANT USAGE ON SCHEMA "orders" TO "orders_svc";
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA "orders" TO "orders_svc";
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA "orders" TO "orders_svc";
ALTER DEFAULT PRIVILEGES IN SCHEMA "orders" GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO "orders_svc";
ALTER DEFAULT PRIVILEGES IN SCHEMA "orders" GRANT USAGE, SELECT ON SEQUENCES TO "orders_svc";

-- payments
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'payments_svc') THEN
    CREATE ROLE "payments_svc" LOGIN PASSWORD 'payments_svc_dev_pw';
  END IF;
END
$$;
GRANT USAGE ON SCHEMA "payments" TO "payments_svc";
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA "payments" TO "payments_svc";
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA "payments" TO "payments_svc";
ALTER DEFAULT PRIVILEGES IN SCHEMA "payments" GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO "payments_svc";
ALTER DEFAULT PRIVILEGES IN SCHEMA "payments" GRANT USAGE, SELECT ON SEQUENCES TO "payments_svc";

-- logistics
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'logistics_svc') THEN
    CREATE ROLE "logistics_svc" LOGIN PASSWORD 'logistics_svc_dev_pw';
  END IF;
END
$$;
GRANT USAGE ON SCHEMA "logistics" TO "logistics_svc";
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA "logistics" TO "logistics_svc";
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA "logistics" TO "logistics_svc";
ALTER DEFAULT PRIVILEGES IN SCHEMA "logistics" GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO "logistics_svc";
ALTER DEFAULT PRIVILEGES IN SCHEMA "logistics" GRANT USAGE, SELECT ON SEQUENCES TO "logistics_svc";

-- tracking
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'tracking_svc') THEN
    CREATE ROLE "tracking_svc" LOGIN PASSWORD 'tracking_svc_dev_pw';
  END IF;
END
$$;
GRANT USAGE ON SCHEMA "tracking" TO "tracking_svc";
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA "tracking" TO "tracking_svc";
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA "tracking" TO "tracking_svc";
ALTER DEFAULT PRIVILEGES IN SCHEMA "tracking" GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO "tracking_svc";
ALTER DEFAULT PRIVILEGES IN SCHEMA "tracking" GRANT USAGE, SELECT ON SEQUENCES TO "tracking_svc";

-- returns
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'returns_svc') THEN
    CREATE ROLE "returns_svc" LOGIN PASSWORD 'returns_svc_dev_pw';
  END IF;
END
$$;
GRANT USAGE ON SCHEMA "returns" TO "returns_svc";
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA "returns" TO "returns_svc";
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA "returns" TO "returns_svc";
ALTER DEFAULT PRIVILEGES IN SCHEMA "returns" GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO "returns_svc";
ALTER DEFAULT PRIVILEGES IN SCHEMA "returns" GRANT USAGE, SELECT ON SEQUENCES TO "returns_svc";

-- notifications
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'notifications_svc') THEN
    CREATE ROLE "notifications_svc" LOGIN PASSWORD 'notifications_svc_dev_pw';
  END IF;
END
$$;
GRANT USAGE ON SCHEMA "notifications" TO "notifications_svc";
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA "notifications" TO "notifications_svc";
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA "notifications" TO "notifications_svc";
ALTER DEFAULT PRIVILEGES IN SCHEMA "notifications" GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO "notifications_svc";
ALTER DEFAULT PRIVILEGES IN SCHEMA "notifications" GRANT USAGE, SELECT ON SEQUENCES TO "notifications_svc";

-- promotions
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'promotions_svc') THEN
    CREATE ROLE "promotions_svc" LOGIN PASSWORD 'promotions_svc_dev_pw';
  END IF;
END
$$;
GRANT USAGE ON SCHEMA "promotions" TO "promotions_svc";
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA "promotions" TO "promotions_svc";
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA "promotions" TO "promotions_svc";
ALTER DEFAULT PRIVILEGES IN SCHEMA "promotions" GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO "promotions_svc";
ALTER DEFAULT PRIVILEGES IN SCHEMA "promotions" GRANT USAGE, SELECT ON SEQUENCES TO "promotions_svc";

-- reviews
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'reviews_svc') THEN
    CREATE ROLE "reviews_svc" LOGIN PASSWORD 'reviews_svc_dev_pw';
  END IF;
END
$$;
GRANT USAGE ON SCHEMA "reviews" TO "reviews_svc";
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA "reviews" TO "reviews_svc";
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA "reviews" TO "reviews_svc";
ALTER DEFAULT PRIVILEGES IN SCHEMA "reviews" GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO "reviews_svc";
ALTER DEFAULT PRIVILEGES IN SCHEMA "reviews" GRANT USAGE, SELECT ON SEQUENCES TO "reviews_svc";

-- settlements
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'settlements_svc') THEN
    CREATE ROLE "settlements_svc" LOGIN PASSWORD 'settlements_svc_dev_pw';
  END IF;
END
$$;
GRANT USAGE ON SCHEMA "settlements" TO "settlements_svc";
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA "settlements" TO "settlements_svc";
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA "settlements" TO "settlements_svc";
ALTER DEFAULT PRIVILEGES IN SCHEMA "settlements" GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO "settlements_svc";
ALTER DEFAULT PRIVILEGES IN SCHEMA "settlements" GRANT USAGE, SELECT ON SEQUENCES TO "settlements_svc";

-- recommendations (schema created above; no tables yet - table/sequence
-- grants below are no-ops today but take effect the moment the future
-- Python service's migrations add tables, since ALTER DEFAULT PRIVILEGES is
-- already in place for objects the owner role creates in this schema).
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'recommendations_svc') THEN
    CREATE ROLE "recommendations_svc" LOGIN PASSWORD 'recommendations_svc_dev_pw';
  END IF;
END
$$;
GRANT USAGE ON SCHEMA "recommendations" TO "recommendations_svc";
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA "recommendations" TO "recommendations_svc";
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA "recommendations" TO "recommendations_svc";
ALTER DEFAULT PRIVILEGES IN SCHEMA "recommendations" GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO "recommendations_svc";
ALTER DEFAULT PRIVILEGES IN SCHEMA "recommendations" GRANT USAGE, SELECT ON SEQUENCES TO "recommendations_svc";
