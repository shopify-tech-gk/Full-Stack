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

export const RestockBody = z.object({
  quantity: z.number().int().positive(),
  reason: z.string().min(1).max(500).optional(),
});
export type RestockBody = z.infer<typeof RestockBody>;
