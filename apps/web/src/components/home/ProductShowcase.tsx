'use client';

import { useState } from 'react';
import Image from 'next/image';
import { BadgePercent, Check, Flame, Sparkles, type LucideIcon } from 'lucide-react';
import {
  PRODUCT_FILTER_TABS,
  type ProductCardData,
  type ProductFilter,
} from '@youmart/shared-client';
import { ProductCard } from '@/components/product/ProductCard';

interface ProductShowcaseProps {
  /** Products per filter tab, from the catalog API (lib/catalog getHomeProducts). */
  productsFor: Record<ProductFilter, readonly ProductCardData[]>;
}

interface DesktopTab {
  icon: LucideIcon;
  lead: string;
  word: string;
  note: string;
  card: string;
  leadTone: string;
  wordTone: string;
  ring: string;
}

/** Desktop tab cards: each keeps its live graphic's identity (colours, two-tone wording). */
const DESKTOP_TABS: Record<ProductFilter, DesktopTab> = {
  new: {
    icon: Sparkles,
    lead: 'New',
    word: 'Arrival',
    note: 'Fresh in store',
    card: 'bg-brand text-white shadow-[0_14px_30px_-14px_rgba(1,66,170,0.8)]',
    leadTone: 'text-feature-expertise',
    wordTone: 'text-white',
    ring: 'ring-brand',
  },
  all: {
    icon: Flame,
    lead: 'Hot',
    word: 'Sale',
    note: 'Trending right now',
    card: 'bg-star-filled text-heading shadow-[0_14px_30px_-14px_rgba(255,51,0,0.7)]',
    leadTone: 'text-price-discount',
    wordTone: 'text-price-discount',
    ring: 'ring-offer-outer',
  },
  sale: {
    icon: BadgePercent,
    lead: 'Best',
    word: 'Offer',
    note: 'Biggest savings',
    card: 'bg-heading text-white shadow-[0_14px_30px_-14px_rgba(15,23,42,0.85)]',
    leadTone: 'text-white',
    wordTone: 'text-offer-outer',
    ring: 'ring-heading',
  },
};

// Live: three graphic filter tabs (New Arrival / Hot Sale / Best Offer) over a 4/3/2-up grid.
export function ProductShowcase({ productsFor }: ProductShowcaseProps) {
  const [filter, setFilter] = useState<ProductFilter>('new');
  const products = productsFor[filter];

  return (
    <section aria-label="Products" className="px-[10px] py-[10px]">
      <div className="mx-auto max-w-[1200px]">
        <div
          role="group"
          aria-label="Filter products"
          className="mb-[20px] flex items-center justify-center gap-[6px] min-[769px]:gap-[10px] lg:hidden"
        >
          {PRODUCT_FILTER_TABS.map((tab) => {
            const active = tab.key === filter;
            return (
              <button
                key={tab.key}
                type="button"
                aria-pressed={active}
                onClick={() => setFilter(tab.key)}
                className="shrink focus:outline-none focus-visible:ring-2 focus-visible:ring-brand"
              >
                <Image
                  src={tab.image}
                  alt={tab.label}
                  width={300}
                  height={180}
                  unoptimized={tab.image.endsWith('.svg')}
                  className={`block size-[90px] rounded-button border-2 object-contain min-[481px]:h-[100px] min-[481px]:w-[130px] min-[769px]:aspect-[5/3] min-[769px]:h-auto min-[769px]:w-[min(300px,calc((100vw-60px)/3))] max-[768px]:border-[1.5px] ${
                    active ? 'border-tab-active' : 'border-transparent'
                  }`}
                />
              </button>
            );
          })}
        </div>

        <div
          role="group"
          aria-label="Filter products"
          className="mx-[10px] mb-[26px] mt-[10px] hidden grid-cols-3 gap-[18px] lg:grid"
        >
          {PRODUCT_FILTER_TABS.map((tab) => {
            const active = tab.key === filter;
            const t = DESKTOP_TABS[tab.key];
            const Icon = t.icon;
            return (
              <button
                key={tab.key}
                type="button"
                aria-pressed={active}
                onClick={() => setFilter(tab.key)}
                className={`group/tab relative flex items-center gap-[16px] overflow-hidden rounded-[22px] px-[22px] py-[18px] text-left transition-[transform,box-shadow,opacity] duration-300 focus:outline-none focus-visible:ring-4 focus-visible:ring-offset-2 motion-reduce:transition-none ${t.card} ${t.ring} ${
                  active
                    ? '-translate-y-[3px] ring-4 ring-offset-[3px] ring-offset-page'
                    : 'opacity-80 hover:-translate-y-[2px] hover:opacity-100'
                }`}
              >
                <span
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-0 bg-gradient-to-br from-white/25 via-transparent to-black/10"
                />
                <Icon
                  aria-hidden="true"
                  className="pointer-events-none absolute -bottom-[22px] right-[14px] size-[96px] opacity-[0.14] transition-transform duration-500 group-hover/tab:-rotate-6 group-hover/tab:scale-110 motion-reduce:transition-none"
                  strokeWidth={1.75}
                />
                <span className="relative flex size-[52px] shrink-0 items-center justify-center rounded-[16px] bg-white/20 ring-1 ring-white/30 backdrop-blur-sm">
                  <Icon aria-hidden="true" className="size-[26px]" strokeWidth={2.25} />
                </span>
                <span className="relative min-w-0 flex-1">
                  <span className="block font-ui text-[24px] font-extrabold uppercase leading-[1.05] tracking-[0.02em]">
                    <span className={t.leadTone}>{t.lead}</span>{' '}
                    <span className={t.wordTone}>{t.word}</span>
                  </span>
                  <span className="mt-[4px] block font-sans text-[13px] font-medium opacity-85">
                    {t.note} &middot; {productsFor[tab.key].length} products
                  </span>
                </span>
                <span
                  aria-hidden="true"
                  className={`relative flex size-[26px] shrink-0 items-center justify-center rounded-full bg-white text-heading shadow transition-[opacity,transform] duration-300 ${
                    active ? 'scale-100 opacity-100' : 'scale-75 opacity-0'
                  }`}
                >
                  <Check className="size-[15px]" strokeWidth={3} />
                </span>
              </button>
            );
          })}
        </div>

        <ul
          key={filter}
          className="grid grid-cols-2 gap-[10px] md:grid-cols-3 md:gap-[12px] lg:mx-[10px] lg:grid-cols-4 lg:gap-[18px]"
        >
          {products.map((product, index) => (
            <li
              key={product.id}
              className="lg:animate-rise-in lg:motion-reduce:animate-none"
              style={{ animationDelay: `${Math.min(index, 8) * 40}ms` }}
            >
              <ProductCard product={product} />
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
