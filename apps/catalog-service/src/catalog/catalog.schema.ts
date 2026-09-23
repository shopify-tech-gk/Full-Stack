import { z } from 'zod';
import { PaginationQuery, Money } from '@youmart/shared-types';

export const ListProductsQuery = PaginationQuery.extend({
  categoryId: z.string().uuid().optional(),
  // Numeric bounds compared against sku.selling_price - filter INPUT, not a
  // stored/returned money value, so a coerced number is fine here (Prisma
  // accepts number|string against a Decimal column equally).
  minPrice: z.coerce.number().nonnegative().optional(),
  maxPrice: z.coerce.number().nonnegative().optional(),
  q: z.string().min(1).max(200).optional(),
});
export type ListProductsQuery = z.infer<typeof ListProductsQuery>;

const AttributesRecord = z.record(z.string(), z.unknown());
const ProductStatusEnum = z.enum(['DRAFT', 'ACTIVE', 'ARCHIVED']);
// GST rate as a plain decimal string (e.g. "18.00"), not a coerced number -
// fed straight into @youmart/shared-utils' gstBackCalculate(), matching
// settlement-service's PercentString convention. Matches the Decimal(5,2)
// column (up to 3 integer digits, 2 decimal places).
const GstRatePercent = z
  .string()
  .regex(/^\d{1,3}(\.\d{1,2})?$/, 'gstRatePercent must be a decimal like "18.00"');

export const SkuInput = z.object({
  skuCode: z.string().min(1).max(100).optional(),
  mrp: Money,
  sellingPrice: Money,
  attributes: AttributesRecord.optional().default({}),
});
export type SkuInput = z.infer<typeof SkuInput>;

export const ImageInput = z.object({
  url: z.string().min(1).max(500),
  position: z.coerce.number().int().nonnegative().optional(),
});
export type ImageInput = z.infer<typeof ImageInput>;

export const CreateProductBody = z.object({
  title: z.string().min(1).max(300),
  description: z.string().max(5000).optional(),
  categoryId: z.string().uuid(),
  attributes: AttributesRecord.optional().default({}),
  skus: z.array(SkuInput).min(1),
  images: z.array(ImageInput).optional().default([]),
  status: ProductStatusEnum.optional().default('DRAFT'),
  // GST invoice fields (Ch6.4) - both optional/nullable; invoice-service
  // falls back to its configured DEFAULT_HSN_CODE/DEFAULT_GST_RATE_PERCENT
  // when unset, so every product invoices correctly from day one.
  hsnCode: z.string().min(1).max(20).optional(),
  gstRatePercent: GstRatePercent.optional(),
});
export type CreateProductBody = z.infer<typeof CreateProductBody>;

export const UpdateProductBody = z
  .object({
    title: z.string().min(1).max(300).optional(),
    description: z.string().max(5000).nullable().optional(),
    categoryId: z.string().uuid().optional(),
    attributes: AttributesRecord.optional(),
    status: ProductStatusEnum.optional(),
    hsnCode: z.string().min(1).max(20).nullable().optional(),
    gstRatePercent: GstRatePercent.nullable().optional(),
  })
  .refine((body) => Object.keys(body).length > 0, {
    message: 'At least one field must be provided',
  });
export type UpdateProductBody = z.infer<typeof UpdateProductBody>;

export const AddSkuBody = SkuInput;
export type AddSkuBody = z.infer<typeof AddSkuBody>;

export const UpdateSkuBody = z
  .object({
    mrp: Money.optional(),
    sellingPrice: Money.optional(),
    attributes: AttributesRecord.optional(),
  })
  .refine((body) => Object.keys(body).length > 0, {
    message: 'At least one field must be provided',
  });
export type UpdateSkuBody = z.infer<typeof UpdateSkuBody>;

export const AddImageBody = ImageInput;
export type AddImageBody = z.infer<typeof AddImageBody>;

export const CreateCategoryBody = z.object({
  name: z.string().min(1).max(200),
  parentId: z.string().uuid().optional(),
});
export type CreateCategoryBody = z.infer<typeof CreateCategoryBody>;

export const UpdateCategoryBody = z
  .object({
    name: z.string().min(1).max(200).optional(),
    parentId: z.string().uuid().nullable().optional(),
  })
  .refine((body) => Object.keys(body).length > 0, {
    message: 'At least one field must be provided',
  });
export type UpdateCategoryBody = z.infer<typeof UpdateCategoryBody>;
