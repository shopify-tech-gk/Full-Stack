-- W9: YouMart Wallet (store credit: refunds credited to the wallet, top-ups, pay with wallet),
-- customer help tickets, a SKIPPED notification status (per-customer notification settings), and
-- account deletion (a deleted account keeps no phone/email). Additive except `refund`, whose
-- existing rows are back-filled (order_id from their payment, method ORIGINAL_PAYMENT).
-- CreateEnum
CREATE TYPE "payments"."RefundMethod" AS ENUM ('ORIGINAL_PAYMENT', 'WALLET');

-- CreateEnum
CREATE TYPE "payments"."WalletTxnType" AS ENUM ('TOPUP', 'REFUND', 'ORDER_PAYMENT', 'FORFEIT');

-- CreateEnum
CREATE TYPE "payments"."WalletDirection" AS ENUM ('CREDIT', 'DEBIT');

-- CreateEnum
CREATE TYPE "payments"."WalletHoldStatus" AS ENUM ('HELD', 'CAPTURED', 'RELEASED');

-- CreateEnum
CREATE TYPE "payments"."WalletTopupStatus" AS ENUM ('CREATED', 'PAID', 'FAILED');

-- CreateEnum
CREATE TYPE "notifications"."SupportTicketTopic" AS ENUM ('ORDER_STATUS', 'CANCELLATION', 'RETURN_REFUND', 'PAYMENT_WALLET', 'DAMAGED_WRONG_ITEM', 'ACCOUNT', 'OTHER');

-- CreateEnum
CREATE TYPE "notifications"."SupportTicketStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'RESOLVED');

-- AlterEnum
ALTER TYPE "notifications"."NotificationStatus" ADD VALUE 'SKIPPED';

-- DropForeignKey
ALTER TABLE "payments"."refund" DROP CONSTRAINT "refund_payment_id_fkey";

-- AlterTable
ALTER TABLE "payments"."refund" ADD COLUMN     "idempotency_key" TEXT,
ADD COLUMN     "method" "payments"."RefundMethod" NOT NULL DEFAULT 'WALLET',
ADD COLUMN     "order_id" TEXT,
ALTER COLUMN "payment_id" DROP NOT NULL;

-- Back-fill: every pre-W9 refund was a Razorpay refund against a payment of a known order.
UPDATE "payments"."refund" r SET "order_id" = p."order_id", "method" = 'ORIGINAL_PAYMENT'
  FROM "payments"."payment" p WHERE p."id" = r."payment_id";
ALTER TABLE "payments"."refund" ALTER COLUMN "order_id" SET NOT NULL;

-- CreateTable
CREATE TABLE "payments"."wallet" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "balance" DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    "held" DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "wallet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payments"."wallet_transaction" (
    "id" TEXT NOT NULL,
    "wallet_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "type" "payments"."WalletTxnType" NOT NULL,
    "direction" "payments"."WalletDirection" NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "balance_after" DECIMAL(12,2) NOT NULL,
    "order_id" TEXT,
    "order_number" TEXT,
    "description" TEXT NOT NULL,
    "idempotency_key" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "wallet_transaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payments"."wallet_hold" (
    "id" TEXT NOT NULL,
    "wallet_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "order_id" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "status" "payments"."WalletHoldStatus" NOT NULL DEFAULT 'HELD',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "wallet_hold_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payments"."wallet_topup" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "status" "payments"."WalletTopupStatus" NOT NULL DEFAULT 'CREATED',
    "razorpay_order_id" TEXT,
    "razorpay_payment_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "wallet_topup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications"."support_ticket" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "order_id" TEXT,
    "order_number" TEXT,
    "topic" "notifications"."SupportTicketTopic" NOT NULL,
    "message" TEXT NOT NULL,
    "status" "notifications"."SupportTicketStatus" NOT NULL DEFAULT 'OPEN',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "support_ticket_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "wallet_user_id_idx" ON "payments"."wallet"("user_id");

-- CreateIndex
CREATE INDEX "wallet_transaction_wallet_id_created_at_idx" ON "payments"."wallet_transaction"("wallet_id", "created_at");

-- CreateIndex
CREATE INDEX "wallet_transaction_user_id_idx" ON "payments"."wallet_transaction"("user_id");

-- CreateIndex
CREATE INDEX "wallet_transaction_order_id_idx" ON "payments"."wallet_transaction"("order_id");

-- CreateIndex
CREATE INDEX "wallet_hold_wallet_id_idx" ON "payments"."wallet_hold"("wallet_id");

-- CreateIndex
CREATE INDEX "wallet_hold_order_id_idx" ON "payments"."wallet_hold"("order_id");

-- CreateIndex
CREATE INDEX "wallet_hold_status_idx" ON "payments"."wallet_hold"("status");

-- CreateIndex
CREATE INDEX "wallet_topup_user_id_idx" ON "payments"."wallet_topup"("user_id");

-- CreateIndex
CREATE INDEX "wallet_topup_razorpay_order_id_idx" ON "payments"."wallet_topup"("razorpay_order_id");

-- CreateIndex
CREATE INDEX "support_ticket_user_id_created_at_idx" ON "notifications"."support_ticket"("user_id", "created_at");

-- CreateIndex
CREATE INDEX "support_ticket_order_id_idx" ON "notifications"."support_ticket"("order_id");

-- CreateIndex
CREATE INDEX "support_ticket_status_idx" ON "notifications"."support_ticket"("status");

-- CreateIndex
CREATE INDEX "refund_order_id_idx" ON "payments"."refund"("order_id");

-- AddForeignKey
ALTER TABLE "payments"."refund" ADD CONSTRAINT "refund_payment_id_fkey" FOREIGN KEY ("payment_id") REFERENCES "payments"."payment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments"."wallet_transaction" ADD CONSTRAINT "wallet_transaction_wallet_id_fkey" FOREIGN KEY ("wallet_id") REFERENCES "payments"."wallet"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments"."wallet_hold" ADD CONSTRAINT "wallet_hold_wallet_id_fkey" FOREIGN KEY ("wallet_id") REFERENCES "payments"."wallet"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ---------------------------------------------------------------------------
-- Hand-added (not expressible in Prisma): partial unique indexes, CHECKs, grants.
-- ---------------------------------------------------------------------------

-- One live wallet per customer.
CREATE UNIQUE INDEX "wallet_user_id_active_key" ON "payments"."wallet"("user_id") WHERE "deleted_at" IS NULL;

-- The balance can never go negative, and the reserved part never exceeds it.
ALTER TABLE "payments"."wallet"
  ADD CONSTRAINT "wallet_balance_non_negative_check" CHECK ("balance" >= 0),
  ADD CONSTRAINT "wallet_held_within_balance_check" CHECK ("held" >= 0 AND "held" <= "balance");

ALTER TABLE "payments"."wallet_transaction"
  ADD CONSTRAINT "wallet_transaction_amount_positive_check" CHECK ("amount" > 0),
  ADD CONSTRAINT "wallet_transaction_balance_after_check" CHECK ("balance_after" >= 0);
-- A retried credit/debit (same key) can never apply twice.
CREATE UNIQUE INDEX "wallet_transaction_idempotency_key_active_key" ON "payments"."wallet_transaction"("idempotency_key") WHERE "idempotency_key" IS NOT NULL AND "deleted_at" IS NULL;

ALTER TABLE "payments"."wallet_hold" ADD CONSTRAINT "wallet_hold_amount_positive_check" CHECK ("amount" > 0);
-- At most one live (held or spent) wallet hold per order; a released one can be replaced.
CREATE UNIQUE INDEX "wallet_hold_order_id_live_key" ON "payments"."wallet_hold"("order_id") WHERE "deleted_at" IS NULL AND "status" IN ('HELD', 'CAPTURED');

ALTER TABLE "payments"."wallet_topup" ADD CONSTRAINT "wallet_topup_amount_positive_check" CHECK ("amount" > 0);
CREATE UNIQUE INDEX "wallet_topup_razorpay_order_id_active_key" ON "payments"."wallet_topup"("razorpay_order_id") WHERE "razorpay_order_id" IS NOT NULL AND "deleted_at" IS NULL;

-- A retried refund (same return / cancel request) returns the first one - never pays twice.
CREATE UNIQUE INDEX "refund_idempotency_key_active_key" ON "payments"."refund"("idempotency_key") WHERE "idempotency_key" IS NOT NULL AND "deleted_at" IS NULL;

-- Account deletion clears the phone and email of a deleted account, so the "at least one
-- identifier" rule now applies to live accounts only.
ALTER TABLE "auth"."user" DROP CONSTRAINT "user_phone_or_email_check";
ALTER TABLE "auth"."user"
  ADD CONSTRAINT "user_phone_or_email_check" CHECK ("phone" IS NOT NULL OR "email" IS NOT NULL OR "deleted_at" IS NOT NULL);

-- Least privilege: payments_svc / notifications_svc already get CRUD on new tables in their own
-- schema via ALTER DEFAULT PRIVILEGES (Ch2); granted explicitly too so it is auditable here.
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "payments"."wallet", "payments"."wallet_transaction", "payments"."wallet_hold", "payments"."wallet_topup" TO "payments_svc";
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "notifications"."support_ticket" TO "notifications_svc";
