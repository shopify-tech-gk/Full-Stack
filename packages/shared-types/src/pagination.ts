import { z } from 'zod';

// limit is coerced since it arrives as a query string on the wire, e.g. "?limit=50"
export const PaginationQuery = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});
export type PaginationQuery = z.infer<typeof PaginationQuery>;
