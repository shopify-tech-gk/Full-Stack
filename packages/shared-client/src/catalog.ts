import type { Money } from './types';
import { toPaise } from './money';
import type { ProductCardData } from './storefront';

// Category listing: live WooCommerce query-string names, so links/bookmarks stay compatible.
export type ListingSort = 'default' | 'price' | 'price-desc';

export const LISTING_SORT_OPTIONS: readonly { value: ListingSort; label: string }[] = [
  { value: 'default', label: 'Default sorting' },
  { value: 'price', label: 'Price: Low \u2192 High' },
  { value: 'price-desc', label: 'Price: High \u2192 Low' },
];

export const LISTING_RATING_OPTIONS: readonly { value: number; label: string }[] = [
  { value: 0, label: 'All Ratings' },
  { value: 4, label: '4\u2605 & above' },
  { value: 3, label: '3\u2605 & above' },
];

/** Price slider bounds (live: range 0-100000, default upper handle 99,999). */
export const LISTING_PRICE_LIMIT = 100000;
export const LISTING_PRICE_DEFAULT_MAX = 99999;
export const LISTING_PAGE_SIZE = 56;

export interface ListingQuery {
  sort: ListingSort;
  minPrice: number;
  maxPrice: number;
  minRating: number;
  brand: string | null;
  page: number;
}

export interface ListingBrand {
  slug: string;
  name: string;
  logo: string;
}

export interface ListingProduct extends ProductCardData {
  brand: string;
}

type SearchParams = Record<string, string | string[] | undefined>;

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function clampInt(value: string | undefined, min: number, max: number, fallback: number): number {
  const parsed = Number.parseInt(value ?? '', 10);
  return Number.isFinite(parsed) ? Math.min(max, Math.max(min, parsed)) : fallback;
}

export function parseListingQuery(params: SearchParams, page = 1): ListingQuery {
  const orderby = first(params.orderby);
  const minPrice = clampInt(first(params.min_price), 0, LISTING_PRICE_LIMIT, 0);
  const maxPrice = clampInt(
    first(params.max_price),
    minPrice,
    LISTING_PRICE_LIMIT,
    LISTING_PRICE_DEFAULT_MAX,
  );
  const brand = first(params.brand);
  return {
    sort: orderby === 'price' || orderby === 'price-desc' ? orderby : 'default',
    minPrice,
    maxPrice,
    minRating: clampInt(first(params.rating_filter), 0, 5, 0),
    brand: brand && /^[a-z0-9-]+$/.test(brand) ? brand : null,
    page: Math.max(1, page),
  };
}

/** Query string for a listing URL; defaults are omitted. `page` lives in the path (live: /page/N). */
export function listingQueryString(query: Omit<ListingQuery, 'page'>): string {
  const params = new URLSearchParams();
  if (query.sort !== 'default') params.set('orderby', query.sort);
  if (query.minPrice > 0) params.set('min_price', String(query.minPrice));
  if (query.maxPrice !== LISTING_PRICE_DEFAULT_MAX) params.set('max_price', String(query.maxPrice));
  if (query.minRating > 0) params.set('rating_filter', String(query.minRating));
  if (query.brand) params.set('brand', query.brand);
  const text = params.toString();
  return text ? `?${text}` : '';
}

/** Filters + sorts a product list the way the listing API will. */
export function applyListingQuery<T extends ListingProduct>(
  products: readonly T[],
  query: ListingQuery,
): T[] {
  const min = query.minPrice * 100;
  const max = query.maxPrice * 100;
  const result = products.filter((product) => {
    const price = toPaise(product.sellingPrice);
    return (
      price >= min &&
      price <= max &&
      product.rating >= query.minRating &&
      (!query.brand || product.brand === query.brand)
    );
  });
  if (query.sort !== 'default') {
    const direction = query.sort === 'price' ? 1 : -1;
    result.sort((a, b) => direction * (toPaise(a.sellingPrice) - toPaise(b.sellingPrice)));
  }
  return result;
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

// Product detail page view model; the catalog API maps into this later.
export interface ProductReviewData {
  id: string;
  author: string;
  /** ISO date. */
  date: string;
  rating: number;
  text: string;
  verified: boolean;
}

export interface ProductDetailData {
  id: string;
  slug: string;
  title: string;
  rating: number;
  shortDescription: string;
  description: string;
  mrp: Money;
  sellingPrice: Money;
  images: readonly string[];
  categories: readonly { name: string; href: string }[];
  reviews: readonly ProductReviewData[];
  related: readonly ProductCardData[];
}
