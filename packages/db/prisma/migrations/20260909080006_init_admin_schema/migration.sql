-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "admin";

-- CreateEnum
CREATE TYPE "admin"."AdminRole" AS ENUM ('SUPER_ADMIN', 'OPS', 'SUPPORT', 'FINANCE');

-- CreateEnum
CREATE TYPE "admin"."MarketplaceMode" AS ENUM ('ENABLED', 'DISABLED');

-- CreateTable
CREATE TABLE "admin"."admin" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "admin_role" "admin"."AdminRole" NOT NULL,
    "password_hash" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "admin_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "admin"."role" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "description" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "role_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "admin"."permission" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "description" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "permission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "admin"."role_permission" (
    "id" TEXT NOT NULL,
    "role_id" TEXT NOT NULL,
    "permission_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "role_permission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "admin"."marketplace_settings" (
    "id" TEXT NOT NULL,
    "marketplace_mode" "admin"."MarketplaceMode" NOT NULL DEFAULT 'DISABLED',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "marketplace_settings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "admin_email_idx" ON "admin"."admin"("email");

-- CreateIndex
CREATE INDEX "role_key_idx" ON "admin"."role"("key");

-- CreateIndex
CREATE INDEX "permission_key_idx" ON "admin"."permission"("key");

-- CreateIndex
CREATE INDEX "role_permission_role_id_permission_id_idx" ON "admin"."role_permission"("role_id", "permission_id");

-- AddForeignKey
ALTER TABLE "admin"."role_permission" ADD CONSTRAINT "role_permission_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "admin"."role"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "admin"."role_permission" ADD CONSTRAINT "role_permission_permission_id_fkey" FOREIGN KEY ("permission_id") REFERENCES "admin"."permission"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Hand-edited addition (platform-wide soft-delete + uniqueness rule):
-- declarative @unique is not used on soft-deletable columns, since re-creating a
-- row with a previously "deleted" value would otherwise violate a plain UNIQUE
-- constraint. Partial unique indexes enforce uniqueness only among active rows.

-- PartialUniqueIndex: Admin.email active-only
CREATE UNIQUE INDEX "admin_email_active_key" ON "admin"."admin"("email") WHERE "deleted_at" IS NULL;

-- PartialUniqueIndex: Role.key active-only
CREATE UNIQUE INDEX "role_key_active_key" ON "admin"."role"("key") WHERE "deleted_at" IS NULL;

-- PartialUniqueIndex: Permission.key active-only
CREATE UNIQUE INDEX "permission_key_active_key" ON "admin"."permission"("key") WHERE "deleted_at" IS NULL;

-- PartialUniqueIndex: RolePermission(role_id, permission_id) active-only
-- (RolePermission also carries deleted_at per our standing convention, so the
-- same soft-delete-reactivation problem applies to its pairing uniqueness.)
CREATE UNIQUE INDEX "role_permission_role_id_permission_id_active_key" ON "admin"."role_permission"("role_id", "permission_id") WHERE "deleted_at" IS NULL;

-- ============================================================================
-- PLACEHOLDER: per-schema database ROLES and GRANTs
-- ----------------------------------------------------------------------------
-- Per-schema scoped Postgres roles (e.g. an "admin_service" role limited to the
-- "admin" schema) are intentionally NOT created in this migration. We're adding
-- one schema at a time right now; creating and re-granting roles per-chapter
-- would mean rewriting the same GRANT statements repeatedly as more schemas are
-- added. Roles/GRANTs will be added in one consolidated migration once all
-- schemas listed in the datasource block exist.
-- ============================================================================

