-- CreateEnum
CREATE TYPE "notifications"."FinderResult" AS ENUM ('FOUND', 'NOT_FOUND');

-- CreateTable
CREATE TABLE "notifications"."finder_query" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "display_name" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "result" "notifications"."FinderResult" NOT NULL,
    "found" INTEGER NOT NULL DEFAULT 0,
    "products" JSONB NOT NULL DEFAULT '[]',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "finder_query_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "finder_query_created_at_idx" ON "notifications"."finder_query"("created_at");

-- CreateIndex
CREATE INDEX "finder_query_user_id_created_at_idx" ON "notifications"."finder_query"("user_id", "created_at");
