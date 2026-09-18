import { z } from 'zod';
import { PaginationQuery } from '@youmart/shared-types';

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
