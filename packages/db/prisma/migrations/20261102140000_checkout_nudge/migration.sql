-- CreateTable
CREATE TABLE "notifications"."checkout_nudge" (
    "user_id" TEXT NOT NULL,
    "started_at" TIMESTAMP(3) NOT NULL,
    "ordered_at" TIMESTAMP(3),
    "last_sent_at" TIMESTAMP(3),
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "checkout_nudge_pkey" PRIMARY KEY ("user_id")
);

-- CreateIndex
CREATE INDEX "checkout_nudge_started_at_idx" ON "notifications"."checkout_nudge"("started_at");
