-- CreateTable
CREATE TABLE "catalog"."product_extra_category" (
    "product_id" TEXT NOT NULL,
    "category_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "product_extra_category_pkey" PRIMARY KEY ("product_id","category_id")
);

-- CreateIndex
CREATE INDEX "product_extra_category_category_id_idx" ON "catalog"."product_extra_category"("category_id");

-- AddForeignKey
ALTER TABLE "catalog"."product_extra_category" ADD CONSTRAINT "product_extra_category_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "catalog"."product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "catalog"."product_extra_category" ADD CONSTRAINT "product_extra_category_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "catalog"."category"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

