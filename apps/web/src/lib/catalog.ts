// Data seam for the listing, product, search and homepage routes - the real catalog/search APIs
// through the gateway (W3). Server-side only; the pages depend on these signatures.
import {
  ApiError,
  LISTING_PAGE_SIZE,
  PRODUCT_RAIL_TITLES,
  catalogQuery,
  createApiClient,
  resolveProductRails,
  searchResultToCardData,
  toCardData,
  toProductDetailData,
  type CategoryFilters,
  type CatalogSort,
  type ListingQuery,
  type PersonalRailFeed,
  type ProductCardData,
  type ProductDetailData,
  type ProductFilter,
  type ProductListItem,
  type ProductRail,
  type ProductRailSlider,
  type StoreCategory,
  type StoreSubcategory,
} from '@youmart/shared-client';
import { API_URL } from './api';
import { storeCategories } from './categories';

// Catalog data changes with every import/price update, so Next must never cache it.
const catalogApi = createApiClient({
  baseUrl: process.env.API_INTERNAL_URL ?? API_URL,
  fetchImpl: (input, init) => fetch(input, { ...init, cache: 'no-store' }),
});

const isNotFound = (err: unknown) => err instanceof ApiError && err.status === 404;

export interface CategoryNode {
  root: StoreCategory;
  /** Deepest matched node's display name. */
  name: string;
}

/** Resolves `/category/a/b/c` path segments against the storefront menu tree. */
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
  products: ProductCardData[];
  total: number;
  totalPages: number;
  /** The category's filter definition + facets; null for /shop or a category with no catalog data yet. */
  filters: CategoryFilters | null;
}

/**
 * One generic listing for EVERY category: products and the category's data-driven filters come
 * from the API; `path` only picks the category (its last segment is the catalog slug).
 */
export async function getCategoryListing(
  path: readonly string[],
  query: ListingQuery,
): Promise<CategoryListing> {
  const category = path[path.length - 1];
  const params = catalogQuery(query, { category });
  try {
    const [page, filters] = await Promise.all([
      catalogApi.catalog.listProducts(params),
      category ? catalogApi.catalog.getCategoryFilters(category, params) : Promise.resolve(null),
    ]);
    return {
      products: page.items.map(toCardData),
      total: page.total,
      totalPages: Math.max(1, Math.ceil(page.total / LISTING_PAGE_SIZE)),
      filters,
    };
  } catch (err) {
    // A storefront menu category the catalog doesn't hold yet: an empty listing, not an error.
    if (isNotFound(err)) {
      return { products: [], total: 0, totalPages: 1, filters: null };
    }
    throw err;
  }
}

export async function getProductDetail(slug: string): Promise<ProductDetailData | null> {
  if (!/^[a-z0-9-]{1,200}$/.test(slug)) return null;
  try {
    const detail = await catalogApi.catalog.getProduct(slug);
    const related = await catalogApi.catalog.listProducts({
      category: detail.category.slug,
      limit: 5,
    });
    return toProductDetailData(
      detail,
      related.items
        .filter((item) => item.id !== detail.id)
        .slice(0, 4)
        .map(toCardData),
    );
  } catch (err) {
    if (isNotFound(err)) return null;
    throw err;
  }
}

export async function searchProducts(q: string): Promise<ProductCardData[]> {
  if (!q.trim()) return [];
  const result = await catalogApi.search.products({ q: q.trim(), perPage: 50 });
  return result.results.map(searchResultToCardData);
}

export interface HomeProducts {
  rails: ProductRail[];
  /** Desktop (>= 1025px) rail sliders; `rails` stays the below-1025px live layout's data. */
  sliders: ProductRailSlider[];
  showcase: Record<ProductFilter, ProductCardData[]>;
}

/**
 * Homepage rails + showcase from three real catalog queries. There is no personalisation or
 * sales data yet, so "trending"/"recommended" use rating/reviews and "top deals" uses discount.
 * `personal` is the Step B seam: a per-user feed (recently viewed, recommendations) for the
 * desktop 'left-off' / 'recommended' sliders, which fall back to these catalog products.
 */
export async function getHomeProducts(personal?: PersonalRailFeed): Promise<HomeProducts> {
  const fetchSorted = (sort: CatalogSort) =>
    catalogApi.catalog
      .listProducts({ sort, limit: 12 })
      .then((page) => page.items)
      .catch(() => [] as ProductListItem[]);
  const [newestItems, topRatedItems, dealItems] = await Promise.all([
    fetchSorted('newest'),
    fetchSorted('rating'),
    fetchSorted('discount'),
  ]);
  const newest = newestItems.map(toCardData);
  const topRated = topRatedItems.map(toCardData);
  const deals = dealItems.map(toCardData);
  const popular = [...newestItems, ...topRatedItems, ...dealItems]
    .sort((a, b) => b.ratingCount - a.ratingCount || (b.rating ?? 0) - (a.rating ?? 0))
    .map(toCardData);
  const rail = (title: string, cards: ProductCardData[]): ProductRail => ({
    title,
    items: cards
      .slice(0, 4)
      .map(({ id, href, title: name, image }) => ({ id, href, title: name, image })),
  });
  // PRODUCT_RAIL_TITLES order: left-off, trending, top deals, recommended, more to explore.
  const [leftOff, trending, topDeals, recommended, explore] = PRODUCT_RAIL_TITLES;
  return {
    rails: [
      rail(leftOff, newest),
      rail(trending, topRated),
      rail(topDeals, deals),
      rail(recommended, topRated.slice(4)),
      rail(explore, newest.slice(4)),
    ].filter((r) => r.items.length > 0),
    sliders: await resolveProductRails({ newest, topRated, deals, popular }, personal),
    showcase: { new: newest, all: topRated, sale: deals },
  };
}
