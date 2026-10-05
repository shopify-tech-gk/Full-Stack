// Homepage product rails as DESKTOP sliders: which products each rail shows, and the seam where
// per-user data (Step B) replaces them. See docs/desktop-redesign/product-rails-data-seam.md.
//
// Every rail always has heading-matched REAL catalog products (the fallback). The two personal
// rails ('left-off', 'recommended') take a per-user feed first when one is supplied and non-empty.
import { discountPercent } from './money';
import { ROUTES } from './routes';
import { PRODUCT_RAIL_TITLES, type ProductCardData } from './storefront';

export type ProductRailKey = 'left-off' | 'trending' | 'top-deals' | 'recommended' | 'explore';
/** Rails a per-user feed may fill: recently viewed / recommendations (Step B). */
export type PersonalRailKey = Extract<ProductRailKey, 'left-off' | 'recommended'>;

export interface ProductRailDefinition {
  key: ProductRailKey;
  /** The live heading (PRODUCT_RAIL_TITLES). */
  title: (typeof PRODUCT_RAIL_TITLES)[number];
  /** The desktop design splits the live heading into a name + offer badge. */
  heading: string;
  /** Show "Up to N% off", N being the real maximum discount among the rail's products. */
  discountBadge: boolean;
  viewAllHref: string;
  personal: boolean;
}

const [LEFT_OFF, TRENDING, TOP_DEALS, RECOMMENDED, EXPLORE] = PRODUCT_RAIL_TITLES;

export const PRODUCT_RAIL_DEFINITIONS: readonly ProductRailDefinition[] = [
  {
    key: 'left-off',
    title: LEFT_OFF,
    heading: 'Pick up where you left off',
    discountBadge: false,
    viewAllHref: `${ROUTES.shop}?orderby=date`,
    personal: true,
  },
  {
    key: 'trending',
    title: TRENDING,
    heading: 'Trending Products',
    discountBadge: true,
    viewAllHref: `${ROUTES.shop}?orderby=rating`,
    personal: false,
  },
  {
    key: 'top-deals',
    title: TOP_DEALS,
    heading: 'Top Deals',
    discountBadge: true,
    viewAllHref: ROUTES.shop,
    personal: false,
  },
  {
    key: 'recommended',
    title: RECOMMENDED,
    heading: 'Recommended for You',
    discountBadge: false,
    viewAllHref: `${ROUTES.shop}?orderby=rating`,
    personal: true,
  },
  {
    key: 'explore',
    title: EXPLORE,
    heading: 'More Items to Explore',
    discountBadge: false,
    viewAllHref: ROUTES.shop,
    personal: false,
  },
];

/** Products per desktop slider. */
export const PRODUCT_RAIL_SLIDER_SIZE = 12;
/** Below this best discount a rail's badge is dropped ("Up to 2% off" isn't an offer). */
export const RAIL_BADGE_MIN_DISCOUNT = 5;

/** Catalog lists the fallbacks are drawn from (each already sorted by the API or the caller). */
export interface RailCatalogPools {
  newest: readonly ProductCardData[];
  topRated: readonly ProductCardData[];
  /** Sorted by discount, highest first. */
  deals: readonly ProductCardData[];
  /** Most-reviewed first. */
  popular: readonly ProductCardData[];
}

/**
 * THE SEAM: a per-user source for a personal rail. Resolve to that user's products (e.g. recently
 * viewed for 'left-off'); null or [] = no history, so the rail shows its heading-matched fallback.
 */
export type PersonalRailFeed = (key: PersonalRailKey) => Promise<readonly ProductCardData[] | null>;

export interface ProductRailSlider extends ProductRailDefinition {
  products: ProductCardData[];
  /** Where `products` came from: the per-user feed, or the heading-matched catalog fallback. */
  source: 'personal' | 'fallback';
  /** e.g. "Up to 38% off", computed from `products`; null = no badge. */
  badge: string | null;
}

/** "Up to N% off" for the products' real best discount, or null below RAIL_BADGE_MIN_DISCOUNT. */
export function railDiscountBadge(products: readonly ProductCardData[]): string | null {
  const best = Math.max(0, ...products.map((p) => discountPercent(p.mrp, p.sellingPrice)));
  return best >= RAIL_BADGE_MIN_DISCOUNT ? `Up to ${best}% off` : null;
}

function uniqueById(products: readonly ProductCardData[]): ProductCardData[] {
  const seen = new Set<string>();
  return products.filter((p) => !seen.has(p.id) && seen.add(p.id));
}

/** Heading-matched real products for every rail, used whenever there is no per-user data. */
export function fallbackRailProducts(
  pools: RailCatalogPools,
  size = PRODUCT_RAIL_SLIDER_SIZE,
): Record<ProductRailKey, ProductCardData[]> {
  const take = (list: readonly ProductCardData[]) => uniqueById(list).slice(0, size);
  const leftOff = take(pools.newest);
  const trending = take(pools.topRated);
  const topDeals = take(pools.deals.filter((p) => discountPercent(p.mrp, p.sellingPrice) > 0));
  const recommended = take(pools.popular);
  // "More to explore": what the other rails don't show first, then the rest of the catalog pool.
  const shown = new Set([...leftOff, ...trending, ...topDeals, ...recommended].map((p) => p.id));
  const pool = uniqueById([...pools.newest, ...pools.topRated, ...pools.deals, ...pools.popular]);
  const explore = take([
    ...pool.filter((p) => !shown.has(p.id)),
    ...[...pool].reverse().filter((p) => shown.has(p.id)),
  ]);
  return {
    'left-off': leftOff,
    trending,
    'top-deals': topDeals,
    recommended,
    explore,
  };
}

/** The desktop sliders: per-user data where supplied and non-empty, else the fallback; never empty. */
export async function resolveProductRails(
  pools: RailCatalogPools,
  personal?: PersonalRailFeed,
): Promise<ProductRailSlider[]> {
  const fallback = fallbackRailProducts(pools);
  const rails = await Promise.all(
    PRODUCT_RAIL_DEFINITIONS.map(async (definition): Promise<ProductRailSlider> => {
      const mine =
        definition.personal && personal
          ? await personal(definition.key as PersonalRailKey).catch(() => null)
          : null;
      const [products, source] =
        mine && mine.length > 0
          ? [uniqueById(mine).slice(0, PRODUCT_RAIL_SLIDER_SIZE), 'personal' as const]
          : [fallback[definition.key], 'fallback' as const];
      const badge = definition.discountBadge ? railDiscountBadge(products) : null;
      return { ...definition, products, source, badge };
    }),
  );
  return rails.filter((rail) => rail.products.length > 0);
}
