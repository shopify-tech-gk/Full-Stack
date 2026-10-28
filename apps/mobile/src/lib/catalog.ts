// RN catalog data layer — mirrors apps/web/src/lib/catalog.ts but using the mobile api client.
// Reuses shared-client mappers/logic (toCardData, resolveProductRails, toProductDetailData,
// catalogQuery) — NO new backend, NO duplicated logic. Real data through the gateway.
import {
  ApiError,
  bestCategories,
  catalogQuery,
  discountPercent,
  resolveProductRails,
  resolveStoreCategories,
  searchResultToCardData,
  toCardData,
  toProductDetailData,
  type ApiCategory,
  type CatalogSort,
  type SearchFilterGroup,
  type SearchSort,
  type CategoryFilters,
  type ListingQuery,
  type PersonalRailFeed,
  type ProductCardData,
  type ProductDetailData,
  type ProductFilter,
  type ProductListItem,
  type ProductRailKey,
  type ProductRailSlider,
  type StoreSubcategory,
} from '@youmart/shared-client';
import { api } from '@/lib/api';
import { clearGuestViews, loadGuestViews } from '@/stores/recently-viewed';
import { getSession } from '@/stores/session';

const isNotFound = (err: unknown) => err instanceof ApiError && err.status === 404;

/** The personal-rail seam (shared with web): signed-in -> server history; guest -> local ids
 * resolved to fresh cards. Empty/failure -> null, so the rail uses the heading-matched fallback. */
const recentlyViewedFeed: PersonalRailFeed = async (key) => {
  if (key !== 'left-off') return null;
  try {
    if (getSession().status === 'authenticated') {
      const { items } = await api.catalog.recentlyViewed();
      return items.length > 0 ? items.map(toCardData) : null;
    }
    const views = await loadGuestViews();
    if (views.length === 0) return null;
    const { items } = await api.catalog.productCards(views.map((v) => v.productId));
    return items.map(toCardData);
  } catch {
    return null;
  }
};

/** Account > Recently viewed: the full history (signed in: the account's; guest: this device's). */
export async function getRecentlyViewed(): Promise<ProductCardData[]> {
  if (getSession().status === 'authenticated') {
    const { items } = await api.catalog.recentlyViewed();
    return items.map(toCardData);
  }
  const views = await loadGuestViews();
  if (views.length === 0) return [];
  const { items } = await api.catalog.productCards(views.map((v) => v.productId));
  return items.map(toCardData);
}

export async function clearRecentlyViewed(): Promise<void> {
  if (getSession().status === 'authenticated') await api.catalog.clearRecentlyViewed();
  else await clearGuestViews();
}

export interface HomeData {
  categories: ApiCategory[];
  rails: ProductRailSlider[];
  showcase: Record<ProductFilter, ProductCardData[]>;
  best: { title: string; items: readonly (StoreSubcategory & { href: string })[] } | null;
}

/** Home: real category list + product rails (recently-viewed personalization + heading-matched
 * fallback), plus the showcase grid and the best-categories carousel (same logic as web). */
export async function getHome(): Promise<HomeData> {
  // 21 = "Shop our picks" fills 7 rows of 3 (components/ProductShowcase.tsx); rails take 4.
  const fetchSorted = (sort: CatalogSort) =>
    api.catalog
      .listProducts({ sort, limit: 21 })
      .then((page) => page.items)
      .catch(() => [] as ProductListItem[]);
  const [categories, newestItems, topRatedItems, dealItems] = await Promise.all([
    api.catalog
      .listCategories()
      .then((r) => r.items)
      .catch(() => [] as ApiCategory[]),
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
  const rails = await resolveProductRails({ newest, topRated, deals, popular }, recentlyViewedFeed);
  return {
    categories,
    rails,
    showcase: { new: newest, all: topRated, sale: deals },
    best: bestCategories(resolveStoreCategories()),
  };
}

/** Each home rail's "View all" list: the catalog sort its products come from. */
// (Each a different order, so no two "View all" lists look the same.)
const RAIL_SORT: Record<ProductRailKey, CatalogSort> = {
  'left-off': 'newest',
  trending: 'rating',
  'top-deals': 'discount',
  recommended: 'price_asc',
  explore: 'price_desc',
};
const RAIL_PAGE_SIZE = 24;

/**
 * One page of a home rail's full list (the "View all" screen). Page 1 of "Pick up where you left
 * off" starts with the shopper's own recently viewed products; Top Deals keeps discounted ones only.
 */
export async function getRailPage(
  key: ProductRailKey,
  page: number,
): Promise<{ products: ProductCardData[]; hasMore: boolean }> {
  const res = await api.catalog.listProducts({
    sort: RAIL_SORT[key],
    limit: RAIL_PAGE_SIZE,
    page,
  });
  let products = res.items.map(toCardData);
  if (key === 'top-deals') {
    products = products.filter((p) => discountPercent(p.mrp, p.sellingPrice) > 0);
  }
  if (key === 'left-off' && page === 1) {
    const mine = (await recentlyViewedFeed('left-off')) ?? [];
    const ids = new Set(mine.map((p) => p.id));
    products = [...mine, ...products.filter((p) => !ids.has(p.id))];
  }
  const hasMore = res.items.length === RAIL_PAGE_SIZE && page * RAIL_PAGE_SIZE < res.total;
  return { products, hasMore };
}

export interface Listing {
  products: ProductCardData[];
  total: number;
  filters: CategoryFilters | null;
}

/** One generic listing for every category (attribute-driven filters, W3) via shared-client. */
export async function getListing(category: string, query: ListingQuery): Promise<Listing> {
  const params = catalogQuery(query, { category });
  try {
    const [page, filters] = await Promise.all([
      api.catalog.listProducts(params),
      api.catalog.getCategoryFilters(category, params).catch(() => null),
    ]);
    return { products: page.items.map(toCardData), total: page.total, filters };
  } catch (err) {
    if (isNotFound(err)) return { products: [], total: 0, filters: null };
    throw err;
  }
}

/** Products-only fetch for infinite scroll "load more" — skips the (unchanged) filter definition. */
export async function listMoreProducts(
  category: string,
  query: ListingQuery,
): Promise<{ products: ProductCardData[]; total: number }> {
  try {
    const page = await api.catalog.listProducts(catalogQuery(query, { category }));
    return { products: page.items.map(toCardData), total: page.total };
  } catch (err) {
    if (isNotFound(err)) return { products: [], total: 0 };
    throw err;
  }
}

export async function getProduct(slug: string): Promise<ProductDetailData | null> {
  if (!/^[a-z0-9-]{1,200}$/.test(slug)) return null;
  try {
    const detail = await api.catalog.getProduct(slug);
    const related = await api.catalog
      .listProducts({ category: detail.category.slug, limit: 6 })
      .catch(() => ({ items: [] as ProductListItem[] }));
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

/** Search a page of products (infinite scroll). `found` is the total match count. */
export async function searchProductsPage(
  q: string,
  page: number,
  perPage = 50,
  brand?: string,
  /** Keep only hits filed under one of these categories (a taxonomy node and its parents), so
   * a node the catalog doesn't hold yet never shows another category's products. One page. */
  inCategories?: readonly string[],
  /** v1.17 results order (default: relevance). */
  sort?: SearchSort,
): Promise<{ products: ProductCardData[]; total: number }> {
  if (!q.trim()) return { products: [], total: 0 };
  const result = await api.search.products({
    q: q.trim(),
    page,
    perPage,
    ...(brand ? { brand } : {}),
    ...(sort && sort !== 'relevance' ? { sort } : {}),
  });
  if (!inCategories) {
    return { products: result.results.map(searchResultToCardData), total: result.found };
  }
  const allowed = new Set(inCategories.map((n) => n.trim().toLowerCase()));
  const products = result.results
    .filter((r) => allowed.has((r.categoryName ?? '').trim().toLowerCase()))
    .map(searchResultToCardData);
  return { products, total: products.length };
}

/** v1.17 what the search results' filter sheet has selected. */
export interface SearchFilters {
  brands: string[];
  categories: string[];
  minPrice: number | null;
  maxPrice: number | null;
  minRating: number;
  minDiscount: number;
  /** attribute key -> selected values ("ram" -> ["8", "12"]). */
  attributes: Record<string, string[]>;
}

export const emptySearchFilters = (): SearchFilters => ({
  brands: [],
  categories: [],
  minPrice: null,
  maxPrice: null,
  minRating: 0,
  minDiscount: 0,
  attributes: {},
});

/** How many filters are on (the "Filters (3)" badge). */
export function countSearchFilters(f: SearchFilters): number {
  return (
    f.brands.length +
    f.categories.length +
    (f.minPrice != null || f.maxPrice != null ? 1 : 0) +
    (f.minRating ? 1 : 0) +
    (f.minDiscount ? 1 : 0) +
    Object.values(f.attributes).reduce((n, v) => n + v.length, 0)
  );
}

/** v1.17 one page of search results with filters applied, plus the filters on offer (page 1). */
export async function searchFiltered(
  q: string,
  page: number,
  perPage: number,
  sort: SearchSort,
  f: SearchFilters,
): Promise<{
  products: ProductCardData[];
  total: number;
  filters: SearchFilterGroup[];
  price: { min: number; max: number } | null;
}> {
  const attrs = Object.fromEntries(
    Object.entries(f.attributes)
      .filter(([, v]) => v.length)
      .map(([k, v]) => [`f_${k}`, v.join(',')]),
  );
  const result = await api.search.products({
    q: q.trim(),
    page,
    perPage,
    ...(sort !== 'relevance' ? { sort } : {}),
    ...(f.brands.length ? { brand: f.brands.join(',') } : {}),
    ...(f.categories.length ? { categories: f.categories.join(',') } : {}),
    ...(f.minPrice != null ? { minPrice: f.minPrice } : {}),
    ...(f.maxPrice != null ? { maxPrice: f.maxPrice } : {}),
    ...(f.minRating ? { minRating: f.minRating } : {}),
    ...(f.minDiscount ? { minDiscount: f.minDiscount } : {}),
    ...(page === 1 ? { withFilters: '1' as const } : {}),
    ...attrs,
  });
  return {
    products: result.results.map(searchResultToCardData),
    total: result.found,
    filters: result.filters ?? [],
    price: result.price ?? null,
  };
}

/** A fresh, default listing query (overridden by the filter sheet). */
export function emptyListingQuery(): ListingQuery {
  return { sort: 'default', minPrice: null, maxPrice: null, minRating: 0, page: 1, filters: {} };
}
