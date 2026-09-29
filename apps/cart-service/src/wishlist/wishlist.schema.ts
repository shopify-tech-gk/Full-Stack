import { z } from 'zod';

export const AddWishlistItemBody = z.object({
  skuId: z.string().uuid(),
});
export type AddWishlistItemBody = z.infer<typeof AddWishlistItemBody>;
