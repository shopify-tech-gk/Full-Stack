-- AlterTable
ALTER TABLE "admin"."marketplace_settings" ADD COLUMN     "commission_default_percent" DECIMAL(5,2) NOT NULL DEFAULT 10.00,
ADD COLUMN     "commission_enabled" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "tcs_enabled" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "tcs_percent" DECIMAL(5,2) NOT NULL DEFAULT 1.00,
ADD COLUMN     "tds_enabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "tds_percent" DECIMAL(5,2) NOT NULL DEFAULT 0.00;
