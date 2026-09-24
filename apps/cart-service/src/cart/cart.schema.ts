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

// Ch7.2 hardening: this was previously read via a bare `typeof` check with
// no Zod schema - service-only (requireServiceAuth), but still worth
// validating consistently rather than trusting the caller's shape.
export const ConvertCartBody = z.object({
  userId: z.string().uuid(),
});
export type ConvertCartBody = z.infer<typeof ConvertCartBody>;
