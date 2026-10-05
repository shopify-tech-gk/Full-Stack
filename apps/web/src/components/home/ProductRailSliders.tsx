import type { ProductRailSlider } from '@youmart/shared-client';
import { ProductCard } from '@/components/product/ProductCard';
import { RailTabs } from './RailTabs';

/**
 * DESKTOP ONLY (>= 1025px): the five homepage rails as premium horizontal sliders behind one tabbed
 * heading. Data comes from getHomeProducts().sliders - heading-matched catalog products, or a
 * per-user feed for the personal rails (see packages/shared-client/src/product-rails.ts).
 * Below 1025px ProductRails is unchanged.
 */
export function ProductRailSliders({ rails }: { rails: readonly ProductRailSlider[] }) {
  if (rails.length === 0) return null;
  return (
    <RailTabs
      tabs={rails.map(({ key, heading, badge, viewAllHref, source }) => ({
        key,
        heading,
        badge,
        viewAllHref,
        source,
      }))}
      panels={rails.map((rail) =>
        rail.products.map((product) => (
          <li
            key={product.id}
            className="w-[calc((100%-56px)/5)] shrink-0 snap-start pb-[6px] pt-[4px] transition-transform duration-300 hover:-translate-y-[4px] motion-reduce:transition-none motion-reduce:hover:translate-y-0 min-[1280px]:w-[calc((100%-70px)/6)]"
          >
            <ProductCard product={product} />
          </li>
        )),
      )}
    />
  );
}
