-- View tracking: a customer's recently viewed products (catalog-service, capped at 50 per user).
-- Additive only - one new table in the existing catalog schema, no change to any other table.

-- CreateTable
CREATE TABLE "catalog"."recently_viewed" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "viewed_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "recently_viewed_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "recently_viewed_user_id_viewed_at_idx" ON "catalog"."recently_viewed"("user_id", "viewed_at" DESC);

-- One ACTIVE row per (user, product): the ON CONFLICT target of the record/merge upsert, so a
-- re-view moves viewed_at forward instead of duplicating (not expressible in Prisma).
CREATE UNIQUE INDEX "recently_viewed_user_id_product_id_active_key" ON "catalog"."recently_viewed"("user_id", "product_id") WHERE "deleted_at" IS NULL;

-- Least privilege: catalog_svc already gets CRUD on new catalog tables via ALTER DEFAULT
-- PRIVILEGES (Ch2); granted explicitly too so it is auditable here. Idempotent.
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "catalog"."recently_viewed" TO "catalog_svc";
