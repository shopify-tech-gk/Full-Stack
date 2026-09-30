import { typesenseClient } from '../typesenseClient';
import { PRODUCTS_ALIAS, type ProductDocument } from './collection';
import { paiseToMoney } from './money-paise';
import { browse } from './browse.service';
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

export async function suggest(query: SuggestQuery): Promise<{ items: SearchResultItem[] }> {
  const response = (await typesenseClient.collections(PRODUCTS_ALIAS).documents().search({
    q: query.q,
    query_by: 'title',
    prefix: 'true',
    num_typos: '1',
    per_page: query.limit,
  })) as unknown as TypesenseSearchResponse;

  return { items: (response.hits ?? []).map((hit) => toSuggestItem(hit.document)) };
}
