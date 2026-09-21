import { z } from 'zod';

export const SetStockBody = z.object({
  available: z.number().int().nonnegative(),
});
export type SetStockBody = z.infer<typeof SetStockBody>;

export const ReserveBody = z.object({
  quantity: z.number().int().positive(),
  orderId: z.string().uuid().optional(),
});
export type ReserveBody = z.infer<typeof ReserveBody>;
