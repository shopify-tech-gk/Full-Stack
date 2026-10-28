import { z } from 'zod';

export const SearchSortEnum = z.enum(['relevance', 'price_asc', 'price_desc', 'newest']);

export const SearchProductsQuery = z.object({
  q: z.string().max(200).optional(),
  category: z.string().uuid().optional(),
  minPrice: z.coerce.number().nonnegative().optional(),
  maxPrice: z.coerce.number().nonnegative().optional(),
  /** One brand, or several comma-separated (v1.17). */
  brand: z.string().max(1000).optional(),
  /** v1.17 filters: category names (comma-separated), min stars, min % off. */
  categories: z.string().max(1000).optional(),
  minRating: z.coerce.number().min(1).max(5).optional(),
  minDiscount: z.coerce.number().int().min(1).max(99).optional(),
  /** v1.17 `1`: also return the filters these results offer (brands, categories, attributes...). */
  withFilters: z.enum(['1', 'true']).optional(),
  sort: SearchSortEnum.default('relevance'),
  page: z.coerce.number().int().min(1).default(1),
  perPage: z.coerce.number().int().min(1).max(100).default(20),
});
export type SearchProductsQuery = z.infer<typeof SearchProductsQuery> & {
  /** v1.17 attribute filters from `f_<key>=a,b` query params (key -> selected values). */
  attributes?: Record<string, string[]>;
};

/** `f_ram=8,12&f_color=Black` -> {ram: ['8','12'], color: ['Black']} (keys/values validated). */
export function attributeFilters(query: Record<string, unknown>): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const [param, raw] of Object.entries(query)) {
    if (!param.startsWith('f_') || typeof raw !== 'string') continue;
    const key = param.slice(2);
    if (!/^[a-z0-9_]{1,40}$/.test(key)) continue;
    const values = raw
      .split(',')
      .map((v) => v.trim())
      .filter((v) => v && v.length <= 100 && !v.includes('`'))
      .slice(0, 30);
    if (values.length) out[key] = values;
  }
  return out;
}

export const SuggestQuery = z.object({
  q: z.string().min(1).max(200),
  limit: z.coerce.number().int().min(1).max(20).default(8),
});
export type SuggestQuery = z.infer<typeof SuggestQuery>;
