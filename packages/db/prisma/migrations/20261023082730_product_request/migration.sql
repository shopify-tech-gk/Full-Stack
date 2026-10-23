-- CreateEnum
CREATE TYPE "notifications"."ProductRequestStatus" AS ENUM ('OPEN', 'RESTOCKED', 'CLOSED');

-- CreateTable
CREATE TABLE "notifications"."product_request" (
    "id" TEXT NOT NULL,
    "user_id" TEXT,
    "item" TEXT NOT NULL,
    "note" TEXT,
    "chat_transcript" TEXT,
    "status" "notifications"."ProductRequestStatus" NOT NULL DEFAULT 'OPEN',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "product_request_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "product_request_status_created_at_idx" ON "notifications"."product_request"("status", "created_at");
