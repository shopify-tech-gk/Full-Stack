// RN catalog data layer — mirrors apps/web/src/lib/catalog.ts but using the mobile api client.
// Reuses shared-client mappers/logic (toCardData, resolveProductRails, toProductDetailData,
// catalogQuery) — NO new backend, NO duplicated logic. Real data through the gateway.
import {
  ApiError,
  bestCategories,
  catalogQuery,
  resolveProductRails,
  resolveStoreCategories,
  searchResultToCardData,
  toCardData,
  toProductDetailData,
  type ApiCategory,
  type CatalogSort,
  type CategoryFilters,
  type ListingQuery,
  type PersonalRailFeed,
  type ProductCardData,
  type ProductDetailData,
  type ProductFilter,
  type ProductListItem,
  type ProductRailSlider,
  type StoreSubcategory,
} from '@youmart/shared-client';
import { api } from '@/lib/api';
import { loadGuestViews } from '@/stores/recently-viewed';
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

export interface HomeData {
  categories: ApiCategory[];
  rails: ProductRailSlider[];
  showcase: Record<ProductFilter, ProductCardData[]>;
  best: { title: string; items: readonly (StoreSubcategory & { href: string })[] } | null;
}

/** Home: real category list + product rails (recently-viewed personalization + heading-matched
 * fallback), plus the showcase grid and the best-categories carousel (same logic as web). */
export async function getHome(): Promise<HomeData> {
  const fetchSorted = (sort: CatalogSort) =>
    api.catalog
      .listProducts({ sort, limit: 12 })
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
): Promise<{ products: ProductCardData[]; total: number }> {
  if (!q.trim()) return { products: [], total: 0 };
  const result = await api.search.products({ q: q.trim(), page, perPage });
  return { products: result.results.map(searchResultToCardData), total: result.found };
}

/** A fresh, default listing query (overridden by the filter sheet). */
export function emptyListingQuery(): ListingQuery {
  return { sort: 'default', minPrice: null, maxPrice: null, minRating: 0, page: 1, filters: {} };
}
