import { z } from 'zod';

export const CancelOrderBody = z.object({
  reason: z.string().trim().min(3).max(200),
  comment: z.string().trim().max(1000).optional(),
});
export type CancelOrderBody = z.infer<typeof CancelOrderBody>;

export const CancelRequestStatus = z.enum(['REQUESTED', 'APPROVED', 'REJECTED']);

export const ListCancelRequestsQuery = z.object({
  status: CancelRequestStatus.optional(),
  cursor: z.string().uuid().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});
export type ListCancelRequestsQuery = z.infer<typeof ListCancelRequestsQuery>;

export const ResolveCancelRequestBody = z.object({
  note: z.string().trim().max(1000).optional(),
});
export type ResolveCancelRequestBody = z.infer<typeof ResolveCancelRequestBody>;
