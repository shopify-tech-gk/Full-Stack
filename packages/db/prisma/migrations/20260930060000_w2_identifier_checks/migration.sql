-- W2: follow-up to 20260930055641_w2_email_otp_identifier (which made `phone` nullable and added
-- otp_challenge.email). These invariants cannot be expressed in Prisma, so they live here -
-- same pattern as every hand-written migration in this repo. Existing rows all satisfy both.
--
-- 1. A customer account is identified by a phone, an email, or both - never neither.
ALTER TABLE "auth"."user"
  ADD CONSTRAINT "user_phone_or_email_check" CHECK ("phone" IS NOT NULL OR "email" IS NOT NULL);

-- 2. An OTP challenge targets exactly one channel: a phone (WhatsApp) XOR an email.
ALTER TABLE "auth"."otp_challenge"
  ADD CONSTRAINT "otp_challenge_one_identifier_check" CHECK (("phone" IS NULL) <> ("email" IS NULL));

-- No grant changes: both tables stay in the "auth" schema owned by the existing "auth_svc" role.
