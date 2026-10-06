import type {
  CatalogSort,
  Money,
  ProductDetail,
  ProductListItem,
  ProductListQuery,
  SearchResult,
} from './types';
import type { ProductCardData } from './storefront';
import { categoryHref } from './categories';
import { DEMO_PRODUCT_IMAGE } from './demo';

// Category listing: live WooCommerce query-string names, so links/bookmarks stay compatible.
export type ListingSort = 'default' | 'price' | 'price-desc' | 'date' | 'rating' | 'discount';

export const LISTING_SORT_OPTIONS: readonly { value: ListingSort; label: string }[] = [
  { value: 'default', label: 'Default sorting' },
  { value: 'price', label: 'Price: Low \u2192 High' },
  { value: 'price-desc', label: 'Price: High \u2192 Low' },
  { value: 'date', label: 'Sort by latest' },
  { value: 'rating', label: 'Sort by average rating' },
  // Not a live WooCommerce option: the brand-offer tiles land here (biggest discount first).
  { value: 'discount', label: 'Sort by discount' },
];

const SORT_TO_API: Record<ListingSort, CatalogSort> = {
  default: 'relevance',
  price: 'price_asc',
  'price-desc': 'price_desc',
  date: 'newest',
  rating: 'rating',
  discount: 'discount',
};

export const LISTING_RATING_OPTIONS: readonly { value: number; label: string }[] = [
  { value: 0, label: 'All Ratings' },
  { value: 4, label: '4\u2605 & above' },
  { value: 3, label: '3\u2605 & above' },
];

/** Price slider upper bound when the category's real price range is unknown (live: 0-100000). */
export const LISTING_PRICE_FALLBACK_LIMIT = 100000;
export const LISTING_PAGE_SIZE = 56;

export interface ListingQuery {
  sort: ListingSort;
  minPrice: number | null;
  maxPrice: number | null;
  minRating: number;
  page: number;
  /**
   * Attribute filters exactly as they appear in the URL (`brand=Samsung,LG`, `screen_size_min=6`).
   * Which keys mean anything is decided by the category's filter definition on the server.
   */
  filters: Record<string, string>;
}

type SearchParams = Record<string, string | string[] | undefined>;

// Universal params (live names) + API names that must never be read as attribute filters.
const RESERVED_PARAMS = new Set([
  'orderby',
  'min_price',
  'max_price',
  'rating_filter',
  'q',
  'page',
  'category',
  'sort',
  'rating',
  'limit',
  'cursor',
]);
const FILTER_PARAM = /^[a-z0-9_]{1,48}$/;

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function optionalInt(value: string | undefined, min: number): number | null {
  const parsed = Number.parseInt(value ?? '', 10);
  return Number.isFinite(parsed) ? Math.max(min, parsed) : null;
}

export function parseListingQuery(params: SearchParams): ListingQuery {
  const orderby = first(params.orderby);
  const page = optionalInt(first(params.page), 1) ?? 1;
  const minPrice = optionalInt(first(params.min_price), 0);
  const maxPrice = optionalInt(first(params.max_price), minPrice ?? 0);
  const filters: Record<string, string> = {};
  for (const key of Object.keys(params).sort()) {
    const value = first(params[key])?.trim();
    if (
      !RESERVED_PARAMS.has(key) &&
      FILTER_PARAM.test(key) &&
      value &&
      value.length <= 500 &&
      !value.includes('`')
    ) {
      filters[key] = value;
    }
  }
  const rating = Number.parseInt(first(params.rating_filter) ?? '', 10);
  return {
    sort: LISTING_SORT_OPTIONS.some((o) => o.value === orderby)
      ? (orderby as ListingSort)
      : 'default',
    minPrice: minPrice && minPrice > 0 ? minPrice : null,
    maxPrice,
    minRating: Number.isFinite(rating) ? Math.min(5, Math.max(0, rating)) : 0,
    page: Math.max(1, page),
    filters,
  };
}

/** Query string for a listing URL; defaults are omitted (the page number is added separately). */
export function listingQueryString(query: Omit<ListingQuery, 'page'>): string {
  const params = new URLSearchParams();
  if (query.sort !== 'default') params.set('orderby', query.sort);
  if (query.minPrice !== null && query.minPrice > 0)
    params.set('min_price', String(query.minPrice));
  if (query.maxPrice !== null) params.set('max_price', String(query.maxPrice));
  if (query.minRating > 0) params.set('rating_filter', String(query.minRating));
  for (const key of Object.keys(query.filters).sort()) {
    params.set(key, query.filters[key]!);
  }
  const text = params.toString();
  return text ? `?${text}` : '';
}

/** A listing page URL: page 1 is the bare listing; later pages add `page=N` to the filters. */
export function listingPageHref(basePath: string, queryString: string, page: number): string {
  if (page <= 1) return `${basePath}${queryString}`;
  return `${basePath}${queryString ? `${queryString}&` : '?'}page=${page}`;
}

/** The catalog API query for a listing (`GET /api/catalog/products`, `.../filters`). */
export function catalogQuery(
  query: ListingQuery,
  extra: { category?: string; limit?: number } = {},
): ProductListQuery {
  return {
    ...query.filters,
    ...(extra.category ? { category: extra.category } : {}),
    sort: SORT_TO_API[query.sort],
    ...(query.minPrice !== null ? { min_price: query.minPrice } : {}),
    ...(query.maxPrice !== null ? { max_price: query.maxPrice } : {}),
    ...(query.minRating > 0 ? { rating: query.minRating } : {}),
    page: query.page,
    limit: extra.limit ?? LISTING_PAGE_SIZE,
  };
}

/** Values currently selected for a multi/single-select or boolean filter. */
export function selectedValues(query: Pick<ListingQuery, 'filters'>, key: string): string[] {
  return (query.filters[key] ?? '')
    .split(',')
    .map((v) => v.trim())
    .filter(Boolean);
}

/** Returns `filters` with `key` set to `value`, or removed when `value` is empty. */
export function withFilter(
  filters: Record<string, string>,
  key: string,
  value: string | null,
): Record<string, string> {
  const next = { ...filters };
  if (value) next[key] = value;
  else delete next[key];
  return next;
}

/** A catalog listing item as the storefront card renders it. */
export function toCardData(item: ProductListItem): ProductCardData {
  return {
    id: item.id,
    href: `/product/${item.slug}`,
    title: item.title,
    image: item.imageUrl ?? DEMO_PRODUCT_IMAGE,
    mrp: item.mrp,
    sellingPrice: item.price,
    rating: item.rating ?? 0,
    slug: item.slug,
    ...(item.skuId ? { skuId: item.skuId } : {}),
  };
}

export function searchResultToCardData(result: SearchResult): ProductCardData {
  return {
    id: result.id,
    href: `/product/${result.slug}`,
    title: result.title,
    image: result.primaryImageUrl ?? DEMO_PRODUCT_IMAGE,
    mrp: result.mrp ?? result.price,
    sellingPrice: result.price,
    rating: result.rating ?? 0,
    slug: result.slug,
    ...(result.skuId ? { skuId: result.skuId } : {}),
  };
}

export type PaginationItem = number | 'dots';

/**
 * Live progress bar (listing, cart, checkout): step 1 is the category name or "Shop".
 * Live links step 1 to /shop; we have no all-products page yet, so it goes home.
 */
export const CHECKOUT_STEPS: readonly { label: string | null; href: string }[] = [
  { label: null, href: '/' },
  { label: 'Cart', href: '/cart' },
  { label: 'Checkout', href: '/checkout' },
];

export const SAFE_CHECKOUT_LABEL = 'Guaranteed Safe Checkout';
export const SAFE_CHECKOUT_METHODS = [
  'Visa',
  'Mastercard',
  'American Express',
  'Discover',
] as const;

/** Live listing titles are cut to ~35 characters with a "See more" hint; we cut on a word. */
export function truncateTitle(title: string, limit = 35): { text: string; truncated: boolean } {
  if (title.length <= limit) {
    return { text: title, truncated: false };
  }
  const cut = title.slice(0, limit);
  const space = cut.lastIndexOf(' ');
  return { text: (space > limit / 2 ? cut.slice(0, space) : cut).trimEnd(), truncated: true };
}

/** WooCommerce paginate_links with end_size 3 / mid_size 3, as live renders "1 2 3 4 … 8 9 10". */
export function paginationItems(current: number, total: number, size = 3): PaginationItem[] {
  const items: PaginationItem[] = [];
  for (let page = 1; page <= total; page += 1) {
    if (page <= size || page > total - size || Math.abs(page - current) <= size) {
      items.push(page);
    } else if (items[items.length - 1] !== 'dots') {
      items.push('dots');
    }
  }
  return items;
}

// Product detail page view model. Written reviews load separately (GET .../:slug/reviews);
// rating/ratingCount are the catalog aggregate, which includes them.
export interface ProductDetailData {
  id: string;
  slug: string;
  title: string;
  rating: number;
  ratingCount: number;
  shortDescription: string;
  description: string;
  mrp: Money;
  sellingPrice: Money;
  /** The SKU "Add to cart" / "Buy Now" buy (the cheapest); null when the product has none. */
  skuId: string | null;
  images: readonly string[];
  categories: readonly { name: string; href: string }[];
  /** Labelled attribute rows (labels/units from the category's filter definition). */
  specifications: readonly { label: string; value: string }[];
  related: readonly ProductCardData[];
}

/** First sentence of the description, for the short summary under the rating. */
function firstSentence(text: string): string {
  const match = /^.{20,300}?[.!?](\s|$)/s.exec(text.trim());
  return (match ? match[0] : text.slice(0, 200)).trim();
}

/** Maps `GET /api/catalog/products/:slug` onto the product page. The cheapest SKU sets the price. */
export function toProductDetailData(
  detail: ProductDetail,
  related: readonly ProductCardData[],
): ProductDetailData {
  const sku = [...detail.skus].sort((a, b) => Number(a.sellingPrice) - Number(b.sellingPrice))[0];
  const description = detail.description ?? '';
  return {
    id: detail.id,
    slug: detail.slug,
    title: detail.title,
    rating: detail.rating ?? 0,
    ratingCount: detail.ratingCount,
    shortDescription: firstSentence(description),
    description,
    mrp: sku?.mrp ?? '0.00',
    sellingPrice: sku?.sellingPrice ?? '0.00',
    skuId: sku?.id ?? null,
    images: detail.images.length > 0 ? detail.images.map((i) => i.url) : [DEMO_PRODUCT_IMAGE],
    categories: detail.categoryPath.map((category, index) => ({
      name: category.name,
      href: categoryHref(...detail.categoryPath.slice(0, index + 1).map((c) => c.slug)),
    })),
    specifications: detail.specifications.map((row) => ({
      label: row.label,
      value: row.unit ? `${row.value} ${row.unit}` : row.value,
    })),
    related,
  };
}
