import { z } from 'zod';

export const Uuid = z.string().uuid();
export type Uuid = z.infer<typeof Uuid>;

// Money is always a decimal string with exactly 2 places (e.g. "1299.00"), never a JS number -
// floating point cannot represent currency exactly, which causes rounding errors in arithmetic.
export const Money = z
  .string()
  .regex(
    /^\d+\.\d{2}$/,
    'Money must be a decimal string with exactly 2 decimal places, e.g. "1299.00"',
  );
export type Money = z.infer<typeof Money>;

export const Timestamp = z.string().datetime();
export type Timestamp = z.infer<typeof Timestamp>;

export function Paginated<T extends z.ZodTypeAny>(itemSchema: T) {
  return z.object({
    items: z.array(itemSchema),
    nextCursor: z.string().nullable(),
  });
}
