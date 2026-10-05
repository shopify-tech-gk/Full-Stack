import {
  PRODUCT_RAIL_DEFINITIONS,
  type PersonalRailKey,
  type ProductRail,
} from '@youmart/shared-client';
import { PersonalRailThumbs } from './PersonalRailThumbs';
import { RailThumbs } from './RailThumbs';

interface ProductRailsProps {
  rails: readonly ProductRail[];
}

// Below 1025px only (desktop: ProductRailSliders). Live: 4-up grid 769-1024px, and a centred swipe
// carousel of 80%-wide cards (12px apart) at <=768px - the track's 10% side padding makes each
// full-width card 80%. View tracking only changes the DATA of the personal card(s), never layout.
export function ProductRails({ rails }: ProductRailsProps) {
  return (
    <section aria-label="Product picks" className="px-[10px] pb-[10px] pt-[35px] lg:hidden">
      <ul className="scrollbar-none flex snap-x snap-mandatory gap-[12px] overflow-x-auto px-[10%] py-[10px] min-[769px]:grid min-[769px]:grid-cols-4 min-[769px]:gap-[16px] min-[769px]:overflow-visible min-[769px]:p-0 min-[1200px]:grid-cols-5">
        {rails.map((rail) => {
          const definition = PRODUCT_RAIL_DEFINITIONS.find((d) => d.title === rail.title);
          return (
            <li
              key={rail.title}
              className="w-full shrink-0 snap-center rounded-rail-card border border-brand p-[16px] shadow-rail-card min-[769px]:w-auto"
            >
              <h2 className="mb-[12px] font-ui text-[13px] font-bold leading-[1.2] text-rail-title">
                {rail.title}
              </h2>
              {definition?.personal ? (
                <PersonalRailThumbs
                  railKey={definition.key as PersonalRailKey}
                  items={rail.items}
                />
              ) : (
                <RailThumbs items={rail.items} />
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
