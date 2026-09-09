-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "auth";

-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "sellers";

-- CreateEnum
CREATE TYPE "auth"."UserStatus" AS ENUM ('ACTIVE', 'BLOCKED');

-- CreateEnum
CREATE TYPE "auth"."OtpPurpose" AS ENUM ('LOGIN', 'PHONE_VERIFY');

-- CreateEnum
CREATE TYPE "auth"."OAuthProvider" AS ENUM ('GOOGLE', 'APPLE');

-- CreateEnum
CREATE TYPE "sellers"."SellerStatus" AS ENUM ('PENDING', 'APPROVED', 'SUSPENDED', 'REJECTED');

-- CreateEnum
CREATE TYPE "sellers"."KycStatus" AS ENUM ('NOT_SUBMITTED', 'PENDING', 'VERIFIED', 'REJECTED');

-- CreateTable
CREATE TABLE "auth"."user" (
    "id" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "email" TEXT,
    "name" TEXT,
    "is_phone_verified" BOOLEAN NOT NULL DEFAULT false,
    "is_email_verified" BOOLEAN NOT NULL DEFAULT false,
    "status" "auth"."UserStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "user_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "auth"."otp_challenge" (
    "id" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "code_hash" TEXT NOT NULL,
    "purpose" "auth"."OtpPurpose" NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "consumed_at" TIMESTAMP(3),
    "attempt_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "otp_challenge_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "auth"."refresh_token" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "token_hash" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "revoked_at" TIMESTAMP(3),
    "user_agent" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "refresh_token_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "auth"."oauth_account" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "provider" "auth"."OAuthProvider" NOT NULL,
    "provider_account_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "oauth_account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sellers"."seller" (
    "id" TEXT NOT NULL,
    "display_name" TEXT NOT NULL,
    "legal_name" TEXT,
    "status" "sellers"."SellerStatus" NOT NULL DEFAULT 'PENDING',
    "is_default_seller" BOOLEAN NOT NULL DEFAULT false,
    "commission_rate_percent" DECIMAL(5,2) NOT NULL DEFAULT 0.00,
    "owner_user_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "seller_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sellers"."seller_kyc" (
    "id" TEXT NOT NULL,
    "seller_id" TEXT NOT NULL,
    "gstin" TEXT,
    "pan" TEXT,
    "bank_account_number_hash" TEXT,
    "bank_ifsc" TEXT,
    "kyc_status" "sellers"."KycStatus" NOT NULL DEFAULT 'NOT_SUBMITTED',
    "submitted_at" TIMESTAMP(3),
    "verified_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "seller_kyc_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "user_phone_idx" ON "auth"."user"("phone");

-- CreateIndex
CREATE INDEX "user_email_idx" ON "auth"."user"("email");

-- CreateIndex
CREATE INDEX "otp_challenge_phone_purpose_idx" ON "auth"."otp_challenge"("phone", "purpose");

-- CreateIndex
CREATE INDEX "refresh_token_user_id_idx" ON "auth"."refresh_token"("user_id");

-- CreateIndex
CREATE INDEX "oauth_account_provider_provider_account_id_idx" ON "auth"."oauth_account"("provider", "provider_account_id");

-- CreateIndex
CREATE INDEX "seller_display_name_idx" ON "sellers"."seller"("display_name");

-- CreateIndex
CREATE INDEX "seller_owner_user_id_idx" ON "sellers"."seller"("owner_user_id");

-- CreateIndex
CREATE INDEX "seller_kyc_seller_id_idx" ON "sellers"."seller_kyc"("seller_id");

-- CreateIndex
CREATE INDEX "seller_kyc_gstin_idx" ON "sellers"."seller_kyc"("gstin");

-- AddForeignKey
ALTER TABLE "auth"."refresh_token" ADD CONSTRAINT "refresh_token_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "auth"."oauth_account" ADD CONSTRAINT "oauth_account_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sellers"."seller_kyc" ADD CONSTRAINT "seller_kyc_seller_id_fkey" FOREIGN KEY ("seller_id") REFERENCES "sellers"."seller"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Hand-edited addition (platform-wide soft-delete + uniqueness rule):
-- declarative @unique is not used on soft-deletable columns, since re-creating a
-- row with a previously "deleted" value would otherwise violate a plain UNIQUE
-- constraint. Partial unique indexes enforce uniqueness only among active rows.

-- PartialUniqueIndex: User.phone active-only (primary identity for OTP login)
CREATE UNIQUE INDEX "user_phone_active_key" ON "auth"."user"("phone") WHERE "deleted_at" IS NULL;

-- PartialUniqueIndex: User.email active-only, only enforced when present
CREATE UNIQUE INDEX "user_email_active_key" ON "auth"."user"("email") WHERE "email" IS NOT NULL AND "deleted_at" IS NULL;

-- PartialUniqueIndex: OAuthAccount(provider, provider_account_id) active-only
CREATE UNIQUE INDEX "oauth_account_provider_provider_account_id_active_key" ON "auth"."oauth_account"("provider", "provider_account_id") WHERE "deleted_at" IS NULL;

-- PartialUniqueIndex: Seller.display_name active-only
CREATE UNIQUE INDEX "seller_display_name_active_key" ON "sellers"."seller"("display_name") WHERE "deleted_at" IS NULL;

-- PartialUniqueIndex: at most ONE active default-seller row platform-wide.
-- This is the hard-off gate's data-layer guarantee - the platform's own
-- first-party store, seeded in prompt 2.4.
CREATE UNIQUE INDEX "seller_is_default_seller_active_key" ON "sellers"."seller"("is_default_seller") WHERE "is_default_seller" = true AND "deleted_at" IS NULL;

-- PartialUniqueIndex: SellerKyc.gstin active-only, only enforced when present
CREATE UNIQUE INDEX "seller_kyc_gstin_active_key" ON "sellers"."seller_kyc"("gstin") WHERE "gstin" IS NOT NULL AND "deleted_at" IS NULL;

-- ============================================================================
-- PLACEHOLDER: per-schema database ROLES and GRANTs
-- ----------------------------------------------------------------------------
-- Per-schema scoped Postgres roles (e.g. an "auth_service" role limited to the
-- "auth" schema, a "sellers_service" role limited to the "sellers" schema) are
-- intentionally NOT created in this migration, for the same reason as in the
-- admin schema's migration: we're adding schemas one at a time, and creating
-- roles/GRANTs per-chapter would mean rewriting the same statements repeatedly.
-- Roles/GRANTs will be added in one consolidated migration once all schemas
-- listed in the datasource block exist.
-- ============================================================================

