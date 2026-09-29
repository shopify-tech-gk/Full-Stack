// Data seam for the listing + product routes. DEMO data today; swap each body for the catalog API
// (`api.catalog.*`) later - the pages only depend on these signatures.
import {
  DEMO_BRANDS,
  DEMO_LISTING_PRODUCTS,
  LISTING_PAGE_SIZE,
  applyListingQuery,
  demoProductDetail,
  type ListingBrand,
  type ListingProduct,
  type ListingQuery,
  type ProductDetailData,
  type StoreCategory,
  type StoreSubcategory,
} from '@youmart/shared-client';
import { storeCategories } from './categories';

export interface CategoryNode {
  root: StoreCategory;
  /** Deepest matched node's display name. */
  name: string;
}

/** Resolves `/product-category/a/b/c` path segments against the category tree. */
export function resolveCategoryPath(segments: readonly string[]): CategoryNode | null {
  const [rootSlug, ...rest] = segments;
  const root = storeCategories.find((c) => c.slug === rootSlug);
  if (!root || rest.length > 2) {
    return null;
  }
  let name = root.name;
  let level: readonly StoreSubcategory[] = root.subcategories;
  for (const slug of rest) {
    const node = level.find((s) => s.slug === slug);
    if (!node) {
      return null;
    }
    name = node.name;
    level = node.children;
  }
  return { root, name };
}

export interface CategoryListing {
  products: ListingProduct[];
  total: number;
  totalPages: number;
  brands: readonly ListingBrand[];
}

export async function getCategoryListing(
  _path: readonly string[],
  query: ListingQuery,
): Promise<CategoryListing> {
  const filtered = applyListingQuery(DEMO_LISTING_PRODUCTS, query);
  const start = (query.page - 1) * LISTING_PAGE_SIZE;
  return {
    products: filtered.slice(start, start + LISTING_PAGE_SIZE),
    total: filtered.length,
    totalPages: Math.max(1, Math.ceil(filtered.length / LISTING_PAGE_SIZE)),
    brands: DEMO_BRANDS,
  };
}

export async function getProductDetail(slug: string): Promise<ProductDetailData | null> {
  return /^[a-z0-9-]+$/.test(slug) ? demoProductDetail(slug) : null;
}

/** DEMO title match. Wiring: api.search.products({ q }) (search-service). */
export async function searchProducts(q: string): Promise<ListingProduct[]> {
  const needle = q.trim().toLowerCase();
  if (!needle) return [];
  return DEMO_LISTING_PRODUCTS.filter((p) => p.title.toLowerCase().includes(needle)).slice(
    0,
    LISTING_PAGE_SIZE,
  );
}
