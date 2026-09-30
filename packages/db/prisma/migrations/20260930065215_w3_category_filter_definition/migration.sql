-- AlterTable
ALTER TABLE "catalog"."category" ADD COLUMN     "filter_definition" JSONB;

-- AlterTable
ALTER TABLE "catalog"."product" ADD COLUMN     "rating" DECIMAL(2,1),
ADD COLUMN     "rating_count" INTEGER NOT NULL DEFAULT 0;

-- Hand-written (not expressible in Prisma): a definition is a JSON array of filters; a rating is 1-5.
ALTER TABLE "catalog"."category"
  ADD CONSTRAINT "category_filter_definition_array_check"
  CHECK ("filter_definition" IS NULL OR jsonb_typeof("filter_definition") = 'array');
ALTER TABLE "catalog"."product"
  ADD CONSTRAINT "product_rating_range_check" CHECK ("rating" IS NULL OR "rating" BETWEEN 1 AND 5);
-- No grant changes: both columns live on existing catalog tables owned by the "catalog_svc" role.
