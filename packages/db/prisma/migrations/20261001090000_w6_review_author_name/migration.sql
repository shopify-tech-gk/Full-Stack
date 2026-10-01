-- W6: storefront reviews. The author's display name is captured at submit time (catalog-service
-- can't read the auth schema), and a customer has at most one live review per product.
ALTER TABLE "reviews"."review" ADD COLUMN "author_name" VARCHAR(100);

CREATE UNIQUE INDEX "review_product_id_user_id_key"
  ON "reviews"."review" ("product_id", "user_id")
  WHERE "deleted_at" IS NULL;
