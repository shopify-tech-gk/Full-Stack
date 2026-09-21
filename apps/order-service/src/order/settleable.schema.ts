import { z } from 'zod';

export const SettleableItemsQuery = z.object({
  sellerId: z.string().uuid(),
  from: z.string().datetime(),
  to: z.string().datetime(),
});
export type SettleableItemsQuery = z.infer<typeof SettleableItemsQuery>;
