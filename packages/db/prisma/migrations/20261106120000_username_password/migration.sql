-- AlterTable
ALTER TABLE "auth"."user" ADD COLUMN     "password_hash" TEXT,
ADD COLUMN     "username" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "user_username_key" ON "auth"."user"("username");
