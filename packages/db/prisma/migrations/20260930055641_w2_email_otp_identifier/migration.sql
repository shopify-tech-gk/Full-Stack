-- AlterTable
ALTER TABLE "auth"."otp_challenge" ADD COLUMN     "email" TEXT,
ALTER COLUMN "phone" DROP NOT NULL;

-- AlterTable
ALTER TABLE "auth"."user" ALTER COLUMN "phone" DROP NOT NULL;

-- CreateIndex
CREATE INDEX "otp_challenge_email_purpose_idx" ON "auth"."otp_challenge"("email", "purpose");
