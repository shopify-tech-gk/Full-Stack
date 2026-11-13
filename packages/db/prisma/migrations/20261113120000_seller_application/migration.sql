-- v1.19 "Sell on YouMart" early-access applications.
-- CreateEnum
CREATE TYPE "sellers"."SellerApplicationStatus" AS ENUM ('NEW', 'CONTACTED', 'SHORTLISTED', 'ONBOARDED', 'DECLINED');

-- CreateTable
CREATE TABLE "sellers"."seller_application" (
    "id" TEXT NOT NULL,
    "reference_code" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "business_name" TEXT NOT NULL,
    "contact_name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "email" TEXT,
    "city" TEXT NOT NULL,
    "business_type" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "has_gstin" BOOLEAN NOT NULL DEFAULT false,
    "note" TEXT,
    "status" "sellers"."SellerApplicationStatus" NOT NULL DEFAULT 'NEW',
    "admin_note" TEXT,
    "contacted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "seller_application_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "seller_application_reference_code_key" ON "sellers"."seller_application"("reference_code");
CREATE UNIQUE INDEX "seller_application_user_id_key" ON "sellers"."seller_application"("user_id");
CREATE INDEX "seller_application_status_created_at_idx" ON "sellers"."seller_application"("status", "created_at");

-- The service role (default privileges cover this too; explicit for clarity).
GRANT SELECT, INSERT, UPDATE, DELETE ON "sellers"."seller_application" TO "sellers_svc";
