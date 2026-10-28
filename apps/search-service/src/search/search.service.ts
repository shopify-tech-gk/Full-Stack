import { typesenseClient } from '../typesenseClient';
import { ATTR_STRING_PREFIX, PRODUCTS_ALIAS, type ProductDocument } from './collection';
import { paiseToMoney } from './money-paise';
import { TEXT_PARAMS, browse } from './browse.service';
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
  /** v1.3 additive: what a product card also needs. */
  mrp: string;
  /** W4: cheapest SKU, for "Add to cart" from a result card. */
  skuId: string | null;
  rating: number | null;
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

interface TypesenseSearchResponse {
  hits?: Array<{ document: ProductDocument }>;
}

/** v1 `GET /search/products`, now a thin mapping over the generic browse engine (W3). */
export async function searchProducts(query: SearchProductsQuery): Promise<SearchProductsResult> {
  const result = await browse(
    {
      q: query.q,
      categoryId: query.category,
      filters: query.brand ? [{ key: 'brand', kind: 'values', values: [query.brand] }] : [],
      minPrice: query.minPrice,
      maxPrice: query.maxPrice,
      facets: [{ key: 'brand', kind: 'values' }],
      includeStats: false,
      sort: query.sort,
      page: query.page,
      perPage: query.perPage,
    },
    { priceBuckets: true },
  );

  return {
    results: result.items.map((item) => ({
      id: item.id,
      title: item.title,
      slug: item.slug,
      price: item.price,
      mrp: item.mrp,
      skuId: item.skuId,
      rating: item.rating,
      primaryImageUrl: item.imageUrl,
      categoryName: item.category.name,
    })),
    facets: {
      category: result.categories ?? [],
      brand: result.facets.brand?.values ?? [],
      price: result.priceBuckets ?? [],
    },
    found: result.found,
    page: result.page,
    perPage: result.perPage,
  };
}

function toSuggestItem(doc: ProductDocument): SearchResultItem {
  return {
    id: doc.id,
    title: doc.title,
    slug: doc.slug,
    price: paiseToMoney(doc.pricePaise),
    mrp: paiseToMoney(doc.mrpPaise || doc.pricePaise),
    skuId: doc.skuId || null,
    rating: doc.rating > 0 ? doc.rating : null,
    primaryImageUrl: doc.primaryImageUrl || null,
    categoryName: doc.categoryName,
  };
}

export interface SuggestResult {
  /** Best matching products - same whole-word + semantic relevance as the results page. */
  items: SearchResultItem[];
  /** Query completions from product titles: "vermi" -> "vermicompost", "ugaoo pot" -> "ugaoo potting". */
  completions: string[];
  /** Brands whose name starts with what was typed (or a word of it), with product counts. */
  brands: FacetCount[];
  /** Categories the matching products are in. */
  categories: FacetCount[];
}

interface TypesenseFacetResponse extends TypesenseSearchResponse {
  facet_counts?: Array<{ field_name: string; counts: Array<{ value: string; count: number }> }>;
}

const MAX_COMPLETIONS = 5;
const MAX_SUGGEST_FACETS = 6;

/** Words in `titles` that complete the last typed word, as whole queries ("ugaoo pot" -> "ugaoo potting"). */
function completionsFor(q: string, titles: string[]): string[] {
  const words = q.toLowerCase().trim().split(/\s+/);
  const last = words.pop() ?? '';
  if (last.length < 2) return [];
  const head = words.join(' ');
  const counts = new Map<string, number>();
  for (const title of titles) {
    for (const raw of title.toLowerCase().split(/[^a-z0-9]+/)) {
      if (raw.length > last.length && raw.startsWith(last) && !/^\d+$/.test(raw)) {
        counts.set(raw, (counts.get(raw) ?? 0) + 1);
      }
    }
  }
  return [...counts]
    .sort((a, b) => b[1] - a[1] || a[0].length - b[0].length)
    .slice(0, MAX_COMPLETIONS)
    .map(([word]) => (head ? `${head} ${word}` : word));
}

/**
 * v1.17 typing suggestions. Three searches in one round trip:
 *  1. products - the results page's hybrid relevance (whole words + meaning), so a suggestion is
 *     never a look-alike ("car" doesn't suggest a carpet), with their categories;
 *  2. a prefix pass over titles - only to complete the word being typed ("vermi" -> vermicompost);
 *  3. brands whose name starts with the typed text.
 */
export async function suggest(query: SuggestQuery): Promise<SuggestResult> {
  const q = query.q.trim();
  const lastWord = q.split(/\s+/).pop() ?? q;
  const searches = [
    {
      collection: PRODUCTS_ALIAS,
      q,
      ...TEXT_PARAMS,
      facet_by: 'categoryName',
      max_facet_values: MAX_SUGGEST_FACETS,
      per_page: query.limit,
    },
    {
      collection: PRODUCTS_ALIAS,
      q,
      query_by: 'title',
      prefix: 'true',
      num_typos: '0',
      include_fields: 'title',
      per_page: 50,
    },
    {
      collection: PRODUCTS_ALIAS,
      q: '*',
      query_by: 'title',
      facet_by: `${ATTR_STRING_PREFIX}brand`,
      facet_query: `${ATTR_STRING_PREFIX}brand:${lastWord}`,
      max_facet_values: MAX_SUGGEST_FACETS,
      per_page: 0,
    },
  ];
  const response = (await typesenseClient.multiSearch.perform(
    { searches } as never,
    {},
  )) as unknown as { results: TypesenseFacetResponse[] };
  const [products, prefix, brandFacets] = response.results;
  const facet = (r: TypesenseFacetResponse | undefined, field: string) =>
    (r?.facet_counts?.find((f) => f.field_name === field)?.counts ?? []).map((c) => ({
      value: c.value,
      count: c.count,
    }));

  const items = (products?.hits ?? []).map((hit) => toSuggestItem(hit.document));
  const typed = q.toLowerCase();
  const compact = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '');
  return {
    items,
    // Completing a word nothing real matches ("car" -> "care") would bring back the look-alikes.
    completions: items.length
      ? completionsFor(
          q,
          (prefix?.hits ?? []).map((hit) => hit.document.title),
        )
      : [],
    // A brand must START with what was typed ("ugao" -> UGAOO), or have it as a whole word -
    // not just contain a word starting with it ("car" must not offer "WASTE CARE...").
    brands: facet(brandFacets, `${ATTR_STRING_PREFIX}brand`).filter(
      (b) =>
        !/^generic$/i.test(b.value) &&
        (compact(b.value).startsWith(compact(q)) ||
          b.value
            .toLowerCase()
            .split(/[^a-z0-9]+/)
            .includes(typed)),
    ),
    categories: facet(products, 'categoryName'),
  };
}
