'use client';

import { useRef } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { CATEGORY_TILE_PLACEHOLDER } from '@youmart/shared-client';
import type { BestCategoryItem } from '@/lib/category-taxonomy';

interface BestCategoriesCarouselProps {
  title: string;
  items: readonly BestCategoryItem[];
}

const GAP = 16;

// Below 1025px only (desktop: BestCategoriesShowcase). Live: 3-column grid on mobile; from 769px a
// single scrollable row of 200px cards with round arrow buttons that scroll two cards at a time.
export function BestCategoriesCarousel({ title, items }: BestCategoriesCarouselProps) {
  const track = useRef<HTMLUListElement>(null);

  const scroll = (direction: 1 | -1) => {
    const el = track.current;
    const card = el?.querySelector('li');
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    el?.scrollBy({
      left: direction * ((card?.offsetWidth ?? 200) + GAP) * 2,
      behavior: reduce ? 'auto' : 'smooth',
    });
  };

  const arrow =
    'absolute top-1/2 z-[5] hidden size-[38px] -translate-y-1/2 items-center justify-center rounded-full border border-category-card-arrowBorder bg-white text-ink-body shadow-carousel-arrow focus:outline-none focus-visible:ring-2 focus-visible:ring-brand min-[769px]:flex';

  return (
    <section aria-labelledby="best-categories" className="p-[10px] lg:hidden">
      <div className="mx-auto my-[30px] max-w-[1200px] px-[15px]">
        <h2
          id="best-categories"
          className="text-center font-ui text-[13px] font-bold leading-[1.3] tracking-[0.3px] text-heading min-[769px]:mb-[18.2px] min-[769px]:text-[26px]"
        >
          {title}
        </h2>
        <div className="relative">
          <button
            type="button"
            aria-label="Previous categories"
            onClick={() => scroll(-1)}
            className={`${arrow} -left-[10px]`}
          >
            <ChevronLeft aria-hidden="true" className="size-[18px]" strokeWidth={3} />
          </button>
          <ul
            ref={track}
            className="grid grid-cols-3 gap-[12px] min-[769px]:scrollbar-none min-[769px]:flex min-[769px]:gap-[16px] min-[769px]:overflow-x-auto min-[769px]:scroll-smooth min-[769px]:pb-[6px]"
          >
            {items.map((item) => {
              const img = item.image ?? CATEGORY_TILE_PLACEHOLDER;
              return (
                <li key={item.slug} className="min-[769px]:w-[200px] min-[769px]:shrink-0">
                  <Link
                    href={item.href}
                    className="relative block aspect-[2/3] overflow-hidden rounded-category-card bg-brand-popup-bg min-[769px]:shadow-category-card"
                  >
                    <Image
                      src={img}
                      alt=""
                      fill
                      unoptimized={img.endsWith('.svg')}
                      sizes="(min-width: 769px) 200px, 30vw"
                      className="object-cover"
                    />
                    <span className="absolute inset-x-[8px] bottom-[8px] rounded-[8px] bg-white/85 px-[4px] py-[8px] text-center font-ui text-[13px] font-bold capitalize leading-[1.2] text-category-card-label">
                      {item.name}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
          <button
            type="button"
            aria-label="Next categories"
            onClick={() => scroll(1)}
            className={`${arrow} -right-[10px]`}
          >
            <ChevronRight aria-hidden="true" className="size-[18px]" strokeWidth={3} />
          </button>
        </div>
      </div>
    </section>
  );
}
