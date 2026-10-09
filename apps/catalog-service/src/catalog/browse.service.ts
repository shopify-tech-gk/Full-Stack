import type { BrowseFilter, BrowseResult, BrowseSort } from '@youmart/service-client';
import type { Money } from '@youmart/shared-types';
import { AppError } from '@youmart/errors';
import { z } from 'zod';
import { prisma } from '../db';
import { searchClient } from '../serviceClients';
import { FilterDefinition, type FilterDefinitionEntry } from './catalog.schema';

// W3: THE attribute-driven listing. Nothing here knows any category or attribute by name - a
// category's `filter_definition` (data) decides which query params become which filters.

export const BrowseQuery = z.object({
  category: z
    .string()
    .regex(/^[a-z0-9-]{1,200}$/)
    .optional(),
  categoryId: z.string().uuid().optional(),
  q: z.string().trim().min(1).max(200).optional(),
  min_price: z.coerce.number().nonnegative().optional(),
  max_price: z.coerce.number().nonnegative().optional(),
  // v1 names, still accepted.
  minPrice: z.coerce.number().nonnegative().optional(),
  maxPrice: z.coerce.number().nonnegative().optional(),
  rating: z.coerce.number().min(0).max(5).optional(),
  sort: z.enum(['relevance', 'newest', 'price_asc', 'price_desc', 'rating', 'discount']).optional(),
  page: z.coerce.number().int().min(1).max(500).optional(),
  // Opaque page token since v1.3 (was a product id).
  cursor: z
    .string()
    .regex(/^\d{1,3}$/, 'Invalid cursor')
    .optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});
type BrowseQuery = z.infer<typeof BrowseQuery>;

type RawQuery = Record<string, unknown>;

export interface CategoryPathItem {
  id: string;
  name: string;
  slug: string;
}

interface ResolvedCategory {
  id: string;
  name: string;
  slug: string;
  parentId: string | null;
  /** Root -> this category. */
  path: CategoryPathItem[];
  definition: FilterDefinitionEntry[];
  /** Slug of the category whose definition applies (itself or the nearest ancestor). */
  definitionFrom: string | null;
}

/** Stored definitions are validated on write; anything unreadable here counts as "none". */
function readDefinition(value: unknown): FilterDefinitionEntry[] | null {
  if (value === null || value === undefined) return null;
  const parsed = FilterDefinition.safeParse(value);
  return parsed.success
    ? [...parsed.data].sort((a, b) => (a.order ?? 1000) - (b.order ?? 1000))
    : null;
}

export async function resolveCategory(
  where: { slug: string } | { id: string },
): Promise<ResolvedCategory> {
  const category = await prisma.category.findFirst({ where: { ...where, deletedAt: null } });
  if (!category) {
    throw new AppError('NOT_FOUND', 404, 'Category not found');
  }
  const chain = [category];
  for (let parentId = category.parentId; parentId && chain.length < 10;) {
    const parent = await prisma.category.findFirst({ where: { id: parentId, deletedAt: null } });
    if (!parent) break;
    chain.push(parent);
    parentId = parent.parentId;
  }
  const owner = chain.find((node) => readDefinition(node.filterDefinition));
  const definition = owner ? readDefinition(owner.filterDefinition)! : [];
  // `brand` is the one conventional attribute (IMPORT-SPEC.md): every category can filter by it,
  // including top-level categories that declare no definition of their own.
  if (!definition.some((entry) => entry.key === 'brand')) {
    definition.unshift({ key: 'brand', label: 'Brand', type: 'multi_select', order: 0 });
  }
  return {
    id: category.id,
    name: category.name,
    slug: category.slug,
    parentId: category.parentId,
    path: chain
      .slice()
      .reverse()
      .map((node) => ({ id: node.id, name: node.name, slug: node.slug })),
    definition,
    definitionFrom: owner?.slug ?? null,
  };
}

function firstString(value: unknown): string | undefined {
  const one = Array.isArray(value) ? value[0] : value;
  return typeof one === 'string' ? one : undefined;
}

function numberParam(raw: RawQuery, name: string): number | undefined {
  const text = firstString(raw[name]);
  if (text === undefined || text.trim() === '') return undefined;
  const value = Number(text);
  if (!Number.isFinite(value)) {
    throw new AppError('VALIDATION_ERROR', 400, `${name} must be a number`);
  }
  return value;
}

/** Only keys the category's definition declares become filters - stray params are ignored. */
export function attributeFilters(
  raw: RawQuery,
  definition: FilterDefinitionEntry[],
): BrowseFilter[] {
  const filters: BrowseFilter[] = [];
  for (const entry of definition) {
    if (entry.type === 'range') {
      const min = numberParam(raw, `${entry.key}_min`);
      const max = numberParam(raw, `${entry.key}_max`);
      if (min !== undefined || max !== undefined)
        filters.push({ key: entry.key, kind: 'range', min, max });
      continue;
    }
    const text = firstString(raw[entry.key]);
    if (!text) continue;
    const values = text
      .split(',')
      .map((v) => v.trim())
      .filter(Boolean);
    if (values.length === 0) continue;
    if (values.length > 50 || values.some((v) => v.length > 100 || v.includes('`'))) {
      throw new AppError('VALIDATION_ERROR', 400, `Invalid value for filter "${entry.key}"`);
    }
    filters.push({
      key: entry.key,
      kind: 'values',
      values: entry.type === 'multi_select' ? values : values.slice(0, 1),
    });
  }
  return filters;
}

function pageOf(query: BrowseQuery): number {
  return query.page ?? (query.cursor ? Number(query.cursor) : 1);
}

function baseRequest(query: BrowseQuery, category: ResolvedCategory | null, raw: RawQuery) {
  return {
    q: query.q,
    categoryId: category?.id,
    filters: category ? attributeFilters(raw, category.definition) : [],
    minPrice: query.min_price ?? query.minPrice,
    maxPrice: query.max_price ?? query.maxPrice,
    minRating: query.rating || undefined,
  };
}

async function categoryFor(query: BrowseQuery): Promise<ResolvedCategory | null> {
  if (query.category) return resolveCategory({ slug: query.category });
  if (query.categoryId) return resolveCategory({ id: query.categoryId });
  return null;
}

export interface ListingItem {
  id: string;
  title: string;
  slug: string;
  price: Money;
  mrp: Money;
  skuId: string | null;
  imageUrl: string | null;
  rating: number | null;
  ratingCount: number;
  category: CategoryPathItem;
}

export interface ListingPage {
  items: ListingItem[];
  nextCursor: string | null;
  total: number;
  page: number;
  perPage: number;
}

/** GET /catalog/products - generic filtered/sorted/paginated listing (Typesense-backed). */
export async function listProducts(raw: RawQuery): Promise<ListingPage> {
  const query = BrowseQuery.parse(raw);
  const category = await categoryFor(query);
  const page = pageOf(query);
  const result = await searchClient.browse({
    ...baseRequest(query, category, raw),
    sort: (query.sort ?? 'relevance') as BrowseSort,
    page,
    perPage: query.limit,
  });
  const totalPages = Math.ceil(result.found / query.limit);
  return {
    items: result.items as ListingItem[],
    nextCursor: page < Math.min(totalPages, 500) ? String(page + 1) : null,
    total: result.found,
    page,
    perPage: query.limit,
  };
}

export interface FilterView extends FilterDefinitionEntry {
  /** multi_select / single_select / boolean: values present in the current result, with counts. */
  values?: { value: string; count: number }[];
  /** range: bounds of the values present. */
  min?: number | null;
  max?: number | null;
}

export interface CategoryFilters {
  category: CategoryPathItem & { parentId: string | null };
  path: CategoryPathItem[];
  definitionFrom: string | null;
  total: number;
  /** Universal price filter bounds (rupees), for every category. */
  price: { min: number; max: number } | null;
  filters: FilterView[];
}

/** GET /catalog/categories/:slug/filters - the category's definition + live facet values/counts. */
export async function getCategoryFilters(slug: string, raw: RawQuery): Promise<CategoryFilters> {
  const query = BrowseQuery.parse(raw);
  const category = await resolveCategory({ slug });
  const result: BrowseResult = await searchClient.browse({
    ...baseRequest(query, category, raw),
    facets: category.definition.map((entry) => ({
      key: entry.key,
      kind: entry.type === 'range' ? 'range' : 'values',
    })),
    includeStats: true,
    sort: 'relevance',
    page: 1,
    perPage: 0,
  });

  return {
    category: {
      id: category.id,
      name: category.name,
      slug: category.slug,
      parentId: category.parentId,
    },
    path: category.path,
    definitionFrom: category.definitionFrom,
    total: result.found,
    price: result.price ?? null,
    filters: category.definition.map((entry) => {
      const facet = result.facets[entry.key];
      return entry.type === 'range'
        ? { ...entry, min: facet?.min ?? null, max: facet?.max ?? null }
        : { ...entry, values: facet?.values ?? [] };
    }),
  };
}
