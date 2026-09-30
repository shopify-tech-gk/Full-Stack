import Image from 'next/image';
import Link from 'next/link';
import type { ProductRail } from '@youmart/shared-client';
import { skipImageOptimizer } from '@/lib/images';

interface ProductRailsProps {
  rails: readonly ProductRail[];
}

// Live: 5-up grid >=1200px, 4-up 769-1199px, and a centred swipe carousel of 80%-wide cards
// (12px apart) at <=768px - the track's 10% side padding makes each full-width card 80%.
export function ProductRails({ rails }: ProductRailsProps) {
  return (
    <section aria-label="Product picks" className="px-[10px] pb-[10px] pt-[35px] lg:pt-[16px]">
      <ul className="scrollbar-none flex snap-x snap-mandatory gap-[12px] overflow-x-auto px-[10%] py-[10px] min-[769px]:grid min-[769px]:grid-cols-4 min-[769px]:gap-[16px] min-[769px]:overflow-visible min-[769px]:p-0 min-[1200px]:grid-cols-5">
        {rails.map((rail) => (
          <li
            key={rail.title}
            className="w-full shrink-0 snap-center rounded-rail-card border border-brand p-[16px] shadow-rail-card min-[769px]:w-auto"
          >
            <h2 className="mb-[12px] font-ui text-[13px] font-bold leading-[1.2] text-rail-title">
              {rail.title}
            </h2>
            <ul className="grid grid-cols-2 gap-[12px]">
              {rail.items.map((item) => (
                <li key={item.id}>
                  <Link href={item.href} className="flex flex-col items-center text-rail-title">
                    <span className="relative mb-[6px] block aspect-square w-full overflow-hidden rounded-rail-thumb bg-rail-thumb">
                      <Image
                        src={item.image}
                        alt=""
                        fill
                        unoptimized={skipImageOptimizer(item.image)}
                        sizes="(min-width: 1200px) 105px, (min-width: 769px) 20vw, 36vw"
                        className="object-cover"
                      />
                    </span>
                    <span className="w-full truncate text-left font-ui text-[12px] leading-[1.3]">
                      {item.title}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ul>
    </section>
  );
}
