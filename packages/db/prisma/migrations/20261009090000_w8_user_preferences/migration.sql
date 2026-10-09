-- W8: per-customer storefront preferences (e.g. the home "Shop by category" order the customer
-- arranged by drag-and-drop). A single nullable JSONB blob on the existing auth.user row -
-- additive only, no change to any other table.
ALTER TABLE "auth"."user" ADD COLUMN "preferences" JSONB;
