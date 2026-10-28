import { typesenseClient } from '../typesenseClient';
import { ATTR_STRING_PREFIX, PRODUCTS_ALIAS, type ProductDocument } from './collection';
import { paiseToMoney } from './money-paise';
import { CATEGORY_NAME_KEY, TEXT_PARAMS, browse } from './browse.service';
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
  /** v1.17 with `withFilters=1`: the filters these results offer, and their price range (rupees). */
  filters?: SearchFilterGroup[];
  price?: { min: number; max: number } | null;
}

interface TypesenseSearchResponse {
  hits?: Array<{ document: ProductDocument }>;
}

/**
 * v1.17 the attribute filters search results can offer ("More filters"), in display order. Shown
 * only when the current results carry the attribute (with 2+ values, or a yes/no one).
 */
const SEARCH_ATTRIBUTE_FILTERS: readonly { key: string; label: string; unit?: string }[] = [
  { key: 'product_type', label: 'Product Type' },
  { key: 'weight_band', label: 'Pack Weight' },
  { key: 'pack_sizes', label: 'Pack Size' },
  { key: 'form', label: 'Item Form' },
  { key: 'organic', label: 'Organic' },
  { key: 'ram', label: 'RAM', unit: 'GB' },
  { key: 'storage', label: 'Storage', unit: 'GB' },
  { key: 'network', label: 'Network' },
  { key: 'screen_size', label: 'Screen Size', unit: 'inch' },
  { key: 'rear_camera', label: 'Rear Camera', unit: 'MP' },
  { key: 'front_camera', label: 'Front Camera' },
  { key: 'battery_capacity', label: 'Battery', unit: 'mAh' },
  { key: 'operating_system', label: 'Operating System' },
  { key: 'processor', label: 'Processor' },
  { key: 'display', label: 'Display' },
  { key: 'sim_type', label: 'SIM Type' },
  { key: 'device_type', label: 'Device Type' },
  { key: 'headphone_type', label: 'Headphone Type' },
  { key: 'noise_cancellation', label: 'Noise Cancellation' },
  { key: 'connectivity', label: 'Connectivity' },
  { key: 'charger_type', label: 'Charger Type' },
  { key: 'fast_charging', label: 'Fast Charging' },
  { key: 'size', label: 'Size' },
  { key: 'age_group', label: 'Age Group' },
  { key: 'type', label: 'Type' },
  { key: 'capacity_ml', label: 'Capacity', unit: 'ml' },
  { key: 'insulated', label: 'Insulated' },
  { key: 'material', label: 'Material' },
  { key: 'color', label: 'Colour' },
  { key: 'warranty', label: 'Warranty' },
];
const YES_NO = new Set(['true', 'false']);

export interface SearchFilterGroup {
  /** `brand`, `category`, or an attribute key (sent back as `f_<key>`). */
  key: string;
  label: string;
  /** `boolean`: yes/no ("Organic", "Insulated") - its value is "true". */
  type: 'multi' | 'boolean';
  unit?: string;
  values: FacetCount[];
}

/** v1 `GET /search/products`, now a thin mapping over the generic browse engine (W3). */
export async function searchProducts(query: SearchProductsQuery): Promise<SearchProductsResult> {
  const list = (s?: string) =>
    (s ?? '')
      .split(',')
      .map((v) => v.trim())
      .filter(Boolean)
      .slice(0, 20);
  const brands = list(query.brand);
  const categories = list(query.categories);
  const withFilters = Boolean(query.withFilters);
  const result = await browse(
    {
      q: query.q,
      categoryId: query.category,
      filters: [
        ...(brands.length ? [{ key: 'brand', kind: 'values' as const, values: brands }] : []),
        ...Object.entries(query.attributes ?? {}).map(([key, values]) => ({
          key,
          kind: 'values' as const,
          values,
        })),
      ],
      minPrice: query.minPrice,
      maxPrice: query.maxPrice,
      minRating: query.minRating,
      ...(categories.length ? { categoryNames: categories } : {}),
      ...(query.minDiscount ? { minDiscount: query.minDiscount } : {}),
      facets: [
        { key: 'brand', kind: 'values' },
        ...(withFilters
          ? SEARCH_ATTRIBUTE_FILTERS.map((f) => ({ key: f.key, kind: 'values' as const }))
          : []),
      ],
      facetCategories: withFilters,
      includeStats: withFilters,
      sort: query.sort,
      page: query.page,
      perPage: query.perPage,
    },
    { priceBuckets: true },
  );

  const filters: SearchFilterGroup[] = [];
  if (withFilters) {
    const values = (key: string) => result.facets[key]?.values ?? [];
    const cats = values(CATEGORY_NAME_KEY);
    if (cats.length)
      filters.push({ key: 'category', label: 'Category', type: 'multi', values: cats });
    const brandValues = values('brand').filter((b) => !/^generic$/i.test(b.value));
    if (brandValues.length) {
      filters.push({ key: 'brand', label: 'Brand', type: 'multi', values: brandValues });
    }
    for (const f of SEARCH_ATTRIBUTE_FILTERS) {
      const vs = values(f.key);
      const selected = Boolean(query.attributes?.[f.key]);
      const yesNo = vs.length > 0 && vs.every((v) => YES_NO.has(v.value.toLowerCase()));
      // A filter needs a choice: 2+ values, or a yes/no attribute with some "yes".
      if (!selected && !(yesNo ? vs.some((v) => v.value === 'true') : vs.length >= 2)) continue;
      filters.push({
        key: f.key,
        label: f.label,
        type: yesNo ? 'boolean' : 'multi',
        ...(f.unit ? { unit: f.unit } : {}),
        values: yesNo ? vs.filter((v) => v.value === 'true') : vs,
      });
    }
  }

  return {
    ...(withFilters ? { filters, price: result.price ?? null } : {}),
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
