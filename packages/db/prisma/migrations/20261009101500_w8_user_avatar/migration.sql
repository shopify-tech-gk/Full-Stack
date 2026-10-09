-- W8: the customer's profile photo, stored on the account (a small resized image data URL) so it
-- follows the customer across devices and sign-ins. Additive only - one nullable column.
ALTER TABLE "auth"."user" ADD COLUMN "avatar" TEXT;
