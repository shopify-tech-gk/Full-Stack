import { request } from '../http';
import { mintCallerServiceToken, type ServiceAuthOptions } from '../serviceAuth';

/** W3: attribute filter applied by the generic browse engine. Keys are attribute keys
 * (`brand`, `ram`, ...), never per-category code. */
export type BrowseFilter =
  | { key: string; kind: 'values'; values: string[] }
  | { key: string; kind: 'range'; min?: number; max?: number };

export type BrowseSort =
  'relevance' | 'newest' | 'price_asc' | 'price_desc' | 'rating' | 'discount';

export interface BrowseRequest {
  q?: string;
  /** Matches the category AND its descendants. */
  categoryId?: string;
  filters?: BrowseFilter[];
  /** Rupees. */
  minPrice?: number;
  maxPrice?: number;
  minRating?: number;
  /** Attribute keys to return facets for. Selected filters don't narrow their own facet. */
  facets?: { key: string; kind: 'values' | 'range' }[];
  /** Also return the price min/max and category facets. */
  includeStats?: boolean;
  sort?: BrowseSort;
  page?: number;
  perPage?: number;
}

export interface BrowseItem {
  id: string;
  title: string;
  slug: string;
  price: string;
  mrp: string;
  /** Cheapest SKU; null for a product indexed before W4 or without SKUs. */
  skuId: string | null;
  imageUrl: string | null;
  rating: number | null;
  ratingCount: number;
  category: { id: string; name: string; slug: string };
}

export interface BrowseFacet {
  values?: { value: string; count: number }[];
  min?: number;
  max?: number;
}

export interface BrowseResult {
  items: BrowseItem[];
  found: number;
  page: number;
  perPage: number;
  facets: Record<string, BrowseFacet>;
  /** Rupees, only with `includeStats`. */
  price?: { min: number; max: number } | null;
  categories?: { value: string; count: number }[];
}

export interface CreateSearchClientOptions {
  baseUrl: string;
  timeoutMs?: number;
  serviceAuth: ServiceAuthOptions;
}

export interface SearchClient {
  browse(body: BrowseRequest): Promise<BrowseResult>;
}

/** Backed by search-service's SERVICE-ONLY `POST /search/internal/browse`. */
export function createSearchClient({
  baseUrl,
  timeoutMs,
  serviceAuth,
}: CreateSearchClientOptions): SearchClient {
  return {
    browse(body) {
      return request<BrowseResult>({
        baseUrl,
        path: '/search/internal/browse',
        method: 'POST',
        body,
        authToken: mintCallerServiceToken(serviceAuth),
        timeoutMs,
      });
    },
  };
}
