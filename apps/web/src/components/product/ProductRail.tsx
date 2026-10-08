'use client';

import { useRef } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { ProductCardData } from '@youmart/shared-client';
import { ProductCard } from '@/components/product/ProductCard';

const ARROW =
  'flex size-[36px] items-center justify-center rounded-full border border-card-border bg-white text-brand shadow-carousel-arrow transition-colors hover:bg-brand hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-brand';

/** A sideways-scrolling (swipeable) finite product rail with prev/next arrows, e.g. "Similar products". */
export function ProductRail({
  title,
  products,
}: {
  title: string;
  products: readonly ProductCardData[];
}) {
  const ref = useRef<HTMLUListElement>(null);
  if (products.length === 0) return null;

  const scroll = (dir: 1 | -1) =>
    ref.current?.scrollBy({ left: dir * ref.current.clientWidth * 0.8, behavior: 'smooth' });

  return (
    <section className="mt-[28px]">
      <div className="mb-[14px] flex items-center justify-between gap-[16px]">
        <h2 className="flex items-center gap-[12px] font-ui text-[18px] font-bold text-heading lg:text-[24px]">
          <span aria-hidden className="h-[4px] w-[30px] rounded-full bg-brand" />
          {title}
        </h2>
        <div className="hidden items-center gap-[10px] lg:flex">
          <button type="button" aria-label="Previous" className={ARROW} onClick={() => scroll(-1)}>
            <ChevronLeft aria-hidden className="size-[18px]" strokeWidth={2.5} />
          </button>
          <button type="button" aria-label="Next" className={ARROW} onClick={() => scroll(1)}>
            <ChevronRight aria-hidden className="size-[18px]" strokeWidth={2.5} />
          </button>
        </div>
      </div>
      <ul
        ref={ref}
        className="flex snap-x gap-[16px] overflow-x-auto pb-[8px] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {products.map((product) => (
          <li
            key={product.id}
            className="w-[46%] shrink-0 snap-start sm:w-[220px] md:w-[200px] lg:w-[220px]"
          >
            <ProductCard product={product} variant="listing" />
          </li>
        ))}
      </ul>
    </section>
  );
}
