import type { ProductCardData, ProductRailSlider } from '@youmart/shared-client';
import { RailSlide } from './RailSlide';
import { RailTabs } from './RailTabs';

/**
 * DESKTOP ONLY (>= 1025px): the five homepage rails as premium horizontal sliders behind one tabbed
 * heading. The server renders the heading-matched products (getHomeProducts().sliders); a personal
 * rail then swaps in the shopper's own products in the browser (lib/recently-viewed.ts), since
 * only the browser knows who is signed in. Below 1025px ProductRails is unchanged.
 */
export function ProductRailSliders({ rails }: { rails: readonly ProductRailSlider[] }) {
  if (rails.length === 0) return null;
  const personalFallback: Partial<Record<string, ProductCardData[]>> = Object.fromEntries(
    rails.filter((rail) => rail.personal).map((rail) => [rail.key, rail.products]),
  );
  return (
    <RailTabs
      tabs={rails.map(({ key, heading, badge, discountBadge, viewAllHref, source }) => ({
        key,
        heading,
        badge,
        discountBadge,
        viewAllHref,
        source,
      }))}
      personalFallback={personalFallback}
      panels={rails.map((rail) =>
        rail.products.map((product) => <RailSlide key={product.id} product={product} />),
      )}
    />
  );
}
