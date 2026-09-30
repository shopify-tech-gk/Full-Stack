import { z } from 'zod';

/** Attribute keys are data (docs/catalog/IMPORT-SPEC.md) - lower_snake_case, never code. */
export const AttributeKey = z.string().regex(/^[a-z0-9_]{1,40}$/, 'Invalid attribute key');
// Backticks delimit values in Typesense filter syntax, so they can never appear inside one.
const FilterValue = z
  .string()
  .min(1)
  .max(100)
  .regex(/^[^`]*$/, 'Invalid filter value');

const BrowseFilter = z.discriminatedUnion('kind', [
  z.object({
    key: AttributeKey,
    kind: z.literal('values'),
    values: z.array(FilterValue).min(1).max(50),
  }),
  z.object({
    key: AttributeKey,
    kind: z.literal('range'),
    min: z.number().finite().optional(),
    max: z.number().finite().optional(),
  }),
]);

export const BrowseSortEnum = z.enum([
  'relevance',
  'newest',
  'price_asc',
  'price_desc',
  'rating',
  'discount',
]);

export const BrowseRequestBody = z.object({
  q: z.string().max(200).optional(),
  categoryId: z.string().uuid().optional(),
  filters: z.array(BrowseFilter).max(30).default([]),
  minPrice: z.number().nonnegative().optional(),
  maxPrice: z.number().nonnegative().optional(),
  minRating: z.number().min(0).max(5).optional(),
  facets: z
    .array(z.object({ key: AttributeKey, kind: z.enum(['values', 'range']) }))
    .max(30)
    .default([]),
  includeStats: z.boolean().default(false),
  sort: BrowseSortEnum.default('relevance'),
  // Deep pages are capped: listing UIs never need them and Typesense cost grows with depth.
  page: z.number().int().min(1).max(500).default(1),
  perPage: z.number().int().min(0).max(100).default(20),
});
export type BrowseRequestBody = z.infer<typeof BrowseRequestBody>;
