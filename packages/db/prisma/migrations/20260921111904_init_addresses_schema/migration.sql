-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "addresses";

-- CreateEnum
CREATE TYPE "addresses"."AddressType" AS ENUM ('HOME', 'WORK', 'OTHER');

-- CreateTable
CREATE TABLE "addresses"."address" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "full_name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "line1" TEXT NOT NULL,
    "line2" TEXT,
    "landmark" TEXT,
    "city" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "pincode" TEXT NOT NULL,
    "country" TEXT NOT NULL DEFAULT 'India',
    "address_type" "addresses"."AddressType" NOT NULL DEFAULT 'HOME',
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "address_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "address_user_id_idx" ON "addresses"."address"("user_id");
