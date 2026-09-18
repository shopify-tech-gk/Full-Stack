import { z } from 'zod';

export const AddItemBody = z.object({
  skuId: z.string().uuid(),
  quantity: z.number().int().positive(),
});
export type AddItemBody = z.infer<typeof AddItemBody>;

// quantity must be >= 1 here - PATCH never removes a line; use
// DELETE /cart/items/:cartItemId to remove one (documented choice, see
// 4.4b report).
export const UpdateItemBody = z.object({
  quantity: z.number().int().positive(),
});
export type UpdateItemBody = z.infer<typeof UpdateItemBody>;
