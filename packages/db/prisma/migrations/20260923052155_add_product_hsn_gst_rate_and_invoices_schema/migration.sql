-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "invoices";

-- CreateEnum
CREATE TYPE "invoices"."InvoiceTaxType" AS ENUM ('CGST_SGST', 'IGST');

-- AlterTable
ALTER TABLE "catalog"."product" ADD COLUMN     "gst_rate_percent" DECIMAL(5,2),
ADD COLUMN     "hsn_code" TEXT;

-- CreateTable
CREATE TABLE "invoices"."invoice" (
    "id" TEXT NOT NULL,
    "order_id" TEXT NOT NULL,
    "invoice_number" TEXT NOT NULL,
    "invoice_date" TIMESTAMP(3) NOT NULL,
    "buyer_name" TEXT NOT NULL,
    "buyer_address" TEXT NOT NULL,
    "buyer_state" TEXT NOT NULL,
    "buyer_gstin" TEXT,
    "business_name" TEXT NOT NULL,
    "business_gstin" TEXT NOT NULL,
    "business_address" TEXT NOT NULL,
    "business_state" TEXT NOT NULL,
    "subtotal_taxable" DECIMAL(12,2) NOT NULL,
    "total_cgst" DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    "total_sgst" DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    "total_igst" DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    "total_tax" DECIMAL(12,2) NOT NULL,
    "grand_total" DECIMAL(12,2) NOT NULL,
    "pdf_path" TEXT NOT NULL,
    "place_of_supply" TEXT NOT NULL,
    "tax_type" "invoices"."InvoiceTaxType" NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "invoice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invoices"."invoice_line" (
    "id" TEXT NOT NULL,
    "invoice_id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "sku_id" TEXT NOT NULL,
    "title_snapshot" TEXT NOT NULL,
    "hsn_code" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unit_price" DECIMAL(12,2) NOT NULL,
    "taxable_value" DECIMAL(12,2) NOT NULL,
    "gst_rate_percent" DECIMAL(5,2) NOT NULL,
    "cgst_amount" DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    "sgst_amount" DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    "igst_amount" DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    "line_total" DECIMAL(12,2) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "invoice_line_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invoices"."invoice_counter" (
    "id" TEXT NOT NULL,
    "financial_year" TEXT NOT NULL,
    "next_number" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "invoice_counter_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "invoice_order_id_idx" ON "invoices"."invoice"("order_id");

-- CreateIndex
CREATE INDEX "invoice_invoice_number_idx" ON "invoices"."invoice"("invoice_number");

-- CreateIndex
CREATE INDEX "invoice_line_invoice_id_idx" ON "invoices"."invoice_line"("invoice_id");

-- CreateIndex
CREATE INDEX "invoice_line_product_id_idx" ON "invoices"."invoice_line"("product_id");

-- CreateIndex
CREATE UNIQUE INDEX "invoice_counter_financial_year_key" ON "invoices"."invoice_counter"("financial_year");

-- AddForeignKey
ALTER TABLE "invoices"."invoice_line" ADD CONSTRAINT "invoice_line_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "invoices"."invoice"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
