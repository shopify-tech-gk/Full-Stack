import type { BrowseItem, BrowseResult, BrowseFacet } from '@youmart/service-client';
import { typesenseClient } from '../typesenseClient';
import {
  ATTR_NUMBER_PREFIX,
  ATTR_STRING_PREFIX,
  PRODUCTS_ALIAS,
  currentPhysicalCollectionName,
  type ProductDocument,
} from './collection';
import { moneyToPaise, paiseToMoney } from './money-paise';
import type { BrowseRequestBody } from './browse.schema';

// Title >> description relevance, search-as-you-type on title, typo tolerance (Ch6.3 tuning).
const TEXT_PARAMS = {
  query_by: 'title,description',
  query_by_weights: '4,1',
  prefix: 'true,false',
  num_typos: '2,1',
};
const MAX_FACET_VALUES = 100;
const PRICE_FIELD = 'pricePaise';
const PRICE_KEY = '__price';

// Legacy v1 `GET /api/search/products` price buckets (whole rupees -> paise).
export const PRICE_BUCKET_FACET =
  'pricePaise(under_500:[0,50000],500_to_1500:[50000,150000],1500_to_5000:[150000,500000],above_5000:[500000,999999999])';

interface TypesenseFacetCount {
  field_name: string;
  counts: Array<{ value: string; count: number }>;
  stats?: { min?: number; max?: number };
}
interface TypesenseResult {
  hits?: Array<{ document: ProductDocument }>;
  facet_counts?: TypesenseFacetCount[];
  found?: number;
  error?: string;
  code?: number;
}

// Attribute fields only exist in Typesense once some product carries them (wildcard schema);
// filtering/faceting on an absent field is an error there, so absent keys are handled here.
let fieldCache: { names: Set<string>; at: number } | null = null;
const FIELD_CACHE_MS = 15_000;

async function indexedFields(): Promise<Set<string>> {
  if (fieldCache && Date.now() - fieldCache.at < FIELD_CACHE_MS) {
    return fieldCache.names;
  }
  const name = await currentPhysicalCollectionName();
  const schema = name ? await typesenseClient.collections(name).retrieve() : null;
  fieldCache = { names: new Set((schema?.fields ?? []).map((f) => f.name)), at: Date.now() };
  return fieldCache.names;
}

const quote = (value: string) => `\`${value}\``;

/** float32 stats back to the number as written (6.099999904632568 -> 6.1). */
const clean = (value: number | undefined) =>
  value === undefined ? undefined : Number(value.toPrecision(7));

function rangeClause(field: string, min?: number, max?: number): string | null {
  if (min !== undefined && max !== undefined) return `${field}:[${min}..${max}]`;
  if (min !== undefined) return `${field}:>=${min}`;
  if (max !== undefined) return `${field}:<=${max}`;
  return null;
}

function sortBy(sort: BrowseRequestBody['sort'], hasText: boolean): string | undefined {
  switch (sort) {
    case 'newest':
      return 'createdAt:desc';
    case 'price_asc':
      return `${PRICE_FIELD}:asc`;
    case 'price_desc':
      return `${PRICE_FIELD}:desc`;
    case 'rating':
      return 'rating:desc,ratingCount:desc';
    case 'discount':
      return 'discountPct:desc,createdAt:desc';
    default:
      // Text relevance when searching; otherwise the collection default (newest first).
      return hasText ? undefined : 'createdAt:desc';
  }
}

function toItem(doc: ProductDocument): BrowseItem {
  return {
    id: doc.id,
    title: doc.title,
    slug: doc.slug,
    price: paiseToMoney(doc.pricePaise),
    mrp: paiseToMoney(doc.mrpPaise || doc.pricePaise),
    imageUrl: doc.primaryImageUrl || null,
    rating: doc.rating > 0 ? doc.rating : null,
    ratingCount: doc.ratingCount ?? 0,
    category: { id: doc.categoryId, name: doc.categoryName, slug: doc.categorySlug },
  };
}

function emptyResult(body: BrowseRequestBody): BrowseResult {
  return { items: [], found: 0, page: body.page, perPage: body.perPage, facets: {} };
}

/**
 * THE generic browse engine (W3): one code path for every category, driven only by attribute
 * keys. Multi-select facets are DISJUNCTIVE - a selected filter doesn't narrow its own counts,
 * so "Brand: Samsung (3), LG (2)" stays visible after picking Samsung. All searches for one
 * request go to Typesense in a single multi_search round trip.
 */
export async function browse(
  body: BrowseRequestBody,
  options: { priceBuckets?: boolean } = {},
): Promise<BrowseResult & { priceBuckets?: { value: string; count: number }[] }> {
  const fields = await indexedFields();

  // One clause per filter key, so each facet can be recomputed without its own clause.
  const clauses = new Map<string, string>();
  if (body.categoryId) clauses.set('__category', `categoryIds:=${quote(body.categoryId)}`);
  const price = rangeClause(
    PRICE_FIELD,
    body.minPrice !== undefined ? moneyToPaise(body.minPrice.toFixed(2)) : undefined,
    body.maxPrice !== undefined ? moneyToPaise(body.maxPrice.toFixed(2)) : undefined,
  );
  if (price) clauses.set(PRICE_KEY, price);
  if (body.minRating) clauses.set('__rating', `rating:>=${body.minRating}`);

  for (const filter of body.filters) {
    const field =
      filter.kind === 'values'
        ? `${ATTR_STRING_PREFIX}${filter.key}`
        : `${ATTR_NUMBER_PREFIX}${filter.key}`;
    const clause =
      filter.kind === 'values'
        ? `${field}:=[${filter.values.map(quote).join(',')}]`
        : // Typesense floats are 32-bit: 6.1 is stored as 6.0999999, so bounds are compared the same way.
          rangeClause(
            field,
            filter.min !== undefined ? Math.fround(filter.min) : undefined,
            filter.max !== undefined ? Math.fround(filter.max) : undefined,
          );
    if (!clause) continue;
    if (!fields.has(field)) {
      // No product has this attribute at all, so nothing can match the filter.
      return emptyResult(body);
    }
    clauses.set(filter.key, clause);
  }

  const facetFields = new Map<string, string>();
  for (const facet of body.facets) {
    const field =
      facet.kind === 'values'
        ? `${ATTR_STRING_PREFIX}${facet.key}`
        : `${ATTR_NUMBER_PREFIX}${facet.key}`;
    if (fields.has(field)) facetFields.set(facet.key, field);
  }
  if (body.includeStats) facetFields.set(PRICE_KEY, PRICE_FIELD);

  const filterWithout = (skip?: string) =>
    [...clauses]
      .filter(([key]) => key !== skip)
      .map(([, clause]) => clause)
      .join(' && ');
  const selectedFacets = [...facetFields.keys()].filter((key) => clauses.has(key));
  const openFacets = [...facetFields]
    .filter(([key]) => !clauses.has(key))
    .map(([, field]) => field);
  if (body.includeStats || options.priceBuckets) openFacets.push('categoryName');
  if (options.priceBuckets) openFacets.push(PRICE_BUCKET_FACET);

  const hasText = Boolean(body.q && body.q.trim());
  const common = { q: hasText ? body.q!.trim() : '*', ...TEXT_PARAMS };
  const sort = sortBy(body.sort, hasText);
  const searches: Record<string, unknown>[] = [
    {
      collection: PRODUCTS_ALIAS,
      ...(clauses.size ? { filter_by: filterWithout() } : {}),
      ...(sort ? { sort_by: sort } : {}),
      ...(openFacets.length
        ? { facet_by: openFacets.join(','), max_facet_values: MAX_FACET_VALUES }
        : {}),
      page: body.page,
      per_page: body.perPage,
    },
    ...selectedFacets.map((key) => {
      const filter = filterWithout(key);
      return {
        collection: PRODUCTS_ALIAS,
        ...(filter ? { filter_by: filter } : {}),
        facet_by: facetFields.get(key),
        max_facet_values: MAX_FACET_VALUES,
        per_page: 0,
      };
    }),
  ];

  const response = (await typesenseClient.multiSearch.perform(
    { searches } as never,
    common as never,
  )) as unknown as { results: TypesenseResult[] };
  const failed = response.results.find((result) => result.error);
  if (failed) {
    throw new Error(`typesense search failed: ${failed.error}`);
  }

  const [main, ...disjunctive] = response.results as [TypesenseResult, ...TypesenseResult[]];
  const facetCounts = [
    ...(main.facet_counts ?? []),
    ...disjunctive.flatMap((result) => result.facet_counts ?? []),
  ];

  const facets: Record<string, BrowseFacet> = {};
  let priceStats: BrowseResult['price'] = null;
  for (const [key, field] of facetFields) {
    const counts = facetCounts.find((f) => f.field_name === field);
    if (key === PRICE_KEY) {
      if (counts?.stats?.min !== undefined && counts.stats.max !== undefined) {
        priceStats = {
          min: Math.floor(counts.stats.min / 100),
          max: Math.ceil(counts.stats.max / 100),
        };
      }
      continue;
    }
    facets[key] = field.startsWith(ATTR_NUMBER_PREFIX)
      ? { min: clean(counts?.stats?.min), max: clean(counts?.stats?.max) }
      : { values: (counts?.counts ?? []).map((c) => ({ value: c.value, count: c.count })) };
  }

  const bucketCounts = options.priceBuckets
    ? facetCounts.find((f) => f.field_name === PRICE_FIELD)
    : undefined;
  const categoryCounts = (
    facetCounts.find((f) => f.field_name === 'categoryName')?.counts ?? []
  ).map((c) => ({ value: c.value, count: c.count }));
  return {
    items: (main.hits ?? []).map((hit) => toItem(hit.document)),
    found: main.found ?? 0,
    page: body.page,
    perPage: body.perPage,
    facets,
    ...(body.includeStats ? { price: priceStats } : {}),
    ...(body.includeStats || options.priceBuckets ? { categories: categoryCounts } : {}),
    ...(options.priceBuckets
      ? {
          priceBuckets: (bucketCounts?.counts ?? []).map((c) => ({
            value: c.value,
            count: c.count,
          })),
        }
      : {}),
  };
}
