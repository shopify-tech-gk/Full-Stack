-- QR sign-in: the website shows a short-lived single-use QR that a signed-in YouMart app user scans and
-- confirms (WhatsApp Web / Amazon style). Additive only - one new auth table + enum.

-- CreateEnum
CREATE TYPE "auth"."QrLoginStatus" AS ENUM ('PENDING', 'SCANNED', 'APPROVED', 'USED', 'REJECTED');

-- CreateTable
CREATE TABLE "auth"."qr_login_session" (
    "id" TEXT NOT NULL,
    "code_hash" TEXT NOT NULL,
    "browser_key_hash" TEXT NOT NULL,
    "status" "auth"."QrLoginStatus" NOT NULL DEFAULT 'PENDING',
    "user_id" TEXT,
    "user_agent" TEXT,
    "ip_address" TEXT,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "scanned_at" TIMESTAMP(3),
    "approved_at" TIMESTAMP(3),
    "used_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "qr_login_session_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "qr_login_session_code_hash_idx" ON "auth"."qr_login_session"("code_hash");

-- CreateIndex
CREATE INDEX "qr_login_session_user_id_idx" ON "auth"."qr_login_session"("user_id");

-- CreateIndex
CREATE INDEX "qr_login_session_expires_at_idx" ON "auth"."qr_login_session"("expires_at");

-- Hand-added: the QR code (hash) is unique among live rows; auth_svc grant (auditable here).
CREATE UNIQUE INDEX "qr_login_session_code_hash_active_key" ON "auth"."qr_login_session"("code_hash") WHERE "deleted_at" IS NULL;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "auth"."qr_login_session" TO "auth_svc";
