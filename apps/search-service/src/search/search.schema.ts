import { z } from 'zod';

export const SearchSortEnum = z.enum(['relevance', 'price_asc', 'price_desc', 'newest']);

export const SearchProductsQuery = z.object({
  q: z.string().max(200).optional(),
  category: z.string().uuid().optional(),
  minPrice: z.coerce.number().nonnegative().optional(),
  maxPrice: z.coerce.number().nonnegative().optional(),
  brand: z.string().max(100).optional(),
  sort: SearchSortEnum.default('relevance'),
  page: z.coerce.number().int().min(1).default(1),
  perPage: z.coerce.number().int().min(1).max(100).default(20),
});
export type SearchProductsQuery = z.infer<typeof SearchProductsQuery>;

export const SuggestQuery = z.object({
  q: z.string().min(1).max(200),
  limit: z.coerce.number().int().min(1).max(20).default(8),
});
export type SuggestQuery = z.infer<typeof SuggestQuery>;
