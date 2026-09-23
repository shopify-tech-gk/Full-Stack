/*
  Warnings:

  - Added the required column `user_id` to the `invoice` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "invoices"."invoice" ADD COLUMN     "user_id" TEXT NOT NULL;

-- CreateIndex
CREATE INDEX "invoice_user_id_idx" ON "invoices"."invoice"("user_id");
