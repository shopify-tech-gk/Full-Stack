import { typesenseClient } from '../typesenseClient';
import { PRODUCTS_ALIAS, type ProductDocument } from './collection';
import { paiseToMoney, moneyToPaise } from './money-paise';
import type { SearchProductsQuery, SuggestQuery } from './search.schema';

export interface SearchResultItem {
  id: string;
  title: string;
  slug: string;
  /** Money string ("1299.00") - converted from Typesense's `pricePaise`
   * (see money-paise.ts). This price is for DISPLAY/browse only; the
   * authoritative, re-derived price is checkout's (Ch4.5b's
   * `catalogClient.getSku`), never this search result. */
  price: string;
  primaryImageUrl: string | null;
  categoryName: string;
}

export interface FacetCount {
  value: string;
  count: number;
}

export interface SearchProductsResult {
  results: SearchResultItem[];
  facets: {
    category: FacetCount[];
    brand: FacetCount[];
    price: FacetCount[];
  };
  found: number;
  page: number;
  perPage: number;
}

// --- Minimal shapes for what we actually read off Typesense's search
// response - avoids fighting the client library's exact generic overloads
// (typesense@3.0.6) while still being fully typed at our own boundary.
interface TypesenseHit {
  document: ProductDocument;
}
interface TypesenseFacetCount {
  field_name: string;
  counts: Array<{ value: string; count: number }>;
}
interface TypesenseSearchResponse {
  hits?: TypesenseHit[];
  facet_counts?: TypesenseFacetCount[];
  found?: number;
}

/**
 * Field weights (title >> description) and typo/prefix tuning - Amazon-feel
 * relevance, entirely Typesense config, NO ML:
 *   - `query_by_weights: "4,1"` - a title match counts 4x a description
 *     match of the same strength, so a product whose TITLE matches ranks
 *     above one that only matches in its description.
 *   - `prefix: "true,false"` - search-as-you-type (partial-token matching)
 *     is enabled on title only; description requires complete tokens.
 *   - `num_typos: "2,1"` - up to 2 typos tolerated in title, 1 in
 *     description (Typesense's built-in typo correction).
 */
const QUERY_BY = 'title,description';
const QUERY_BY_WEIGHTS = '4,1';
const PREFIX = 'true,false';
const NUM_TYPOS = '2,1';

// Range-facet buckets (Typesense's `facet_by=field(label:[min,max])` syntax)
// - fixed, pragmatic launch buckets in whole rupees (converted to paise).
const PRICE_RANGE_FACET =
  'pricePaise(under_500:[0,50000],500_to_1500:[50000,150000],1500_to_5000:[150000,500000],above_5000:[500000,999999999])';

function buildFilterBy(query: SearchProductsQuery): string | undefined {
  const clauses: string[] = [];
  if (query.category) {
    clauses.push(`categoryId:=${query.category}`);
  }
  if (query.brand) {
    clauses.push(`brand:=${query.brand}`);
  }
  if (query.minPrice !== undefined || query.maxPrice !== undefined) {
    const minPaise = query.minPrice !== undefined ? moneyToPaise(query.minPrice.toFixed(2)) : 0;
    const maxPaise =
      query.maxPrice !== undefined ? moneyToPaise(query.maxPrice.toFixed(2)) : 999_999_999;
    clauses.push(`pricePaise:[${minPaise}..${maxPaise}]`);
  }
  return clauses.length > 0 ? clauses.join(' && ') : undefined;
}

function buildSortBy(sort: SearchProductsQuery['sort']): string | undefined {
  switch (sort) {
    case 'price_asc':
      return 'pricePaise:asc';
    case 'price_desc':
      return 'pricePaise:desc';
    case 'newest':
      return 'createdAt:desc';
    case 'relevance':
    default:
      // Omitting sort_by defaults to Typesense's own text-match relevance
      // score - THE "relevance" ranking, not a custom formula.
      return undefined;
  }
}

function toFacetCounts(facet: TypesenseFacetCount | undefined): FacetCount[] {
  return facet ? facet.counts.map((c) => ({ value: c.value, count: c.count })) : [];
}

function toResultItem(doc: ProductDocument): SearchResultItem {
  return {
    id: doc.id,
    title: doc.title,
    slug: doc.slug,
    price: paiseToMoney(doc.pricePaise),
    primaryImageUrl: doc.primaryImageUrl || null,
    categoryName: doc.categoryName,
  };
}

export async function searchProducts(query: SearchProductsQuery): Promise<SearchProductsResult> {
  const sortBy = buildSortBy(query.sort);

  const response = (await typesenseClient
    .collections(PRODUCTS_ALIAS)
    .documents()
    .search({
      q: query.q && query.q.length > 0 ? query.q : '*',
      query_by: QUERY_BY,
      query_by_weights: QUERY_BY_WEIGHTS,
      prefix: PREFIX,
      num_typos: NUM_TYPOS,
      ...(buildFilterBy(query) ? { filter_by: buildFilterBy(query) } : {}),
      ...(sortBy ? { sort_by: sortBy } : {}),
      facet_by: `categoryName,brand,${PRICE_RANGE_FACET}`,
      page: query.page,
      per_page: query.perPage,
    })) as unknown as TypesenseSearchResponse;

  const facetCounts = response.facet_counts ?? [];

  return {
    results: (response.hits ?? []).map((hit) => toResultItem(hit.document)),
    facets: {
      category: toFacetCounts(facetCounts.find((f) => f.field_name === 'categoryName')),
      brand: toFacetCounts(facetCounts.find((f) => f.field_name === 'brand')),
      price: toFacetCounts(facetCounts.find((f) => f.field_name === 'pricePaise')),
    },
    found: response.found ?? 0,
    page: query.page,
    perPage: query.perPage,
  };
}

export async function suggest(query: SuggestQuery): Promise<{ items: SearchResultItem[] }> {
  const response = (await typesenseClient.collections(PRODUCTS_ALIAS).documents().search({
    q: query.q,
    query_by: 'title',
    prefix: 'true',
    num_typos: '1',
    per_page: query.limit,
  })) as unknown as TypesenseSearchResponse;

  return { items: (response.hits ?? []).map((hit) => toResultItem(hit.document)) };
}
