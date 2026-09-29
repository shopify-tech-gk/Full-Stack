'use client';

import { useState } from 'react';
import Image from 'next/image';
import {
  PRODUCT_FILTER_TABS,
  type ProductCardData,
  type ProductFilter,
} from '@youmart/shared-client';
import { ProductCard } from '@/components/product/ProductCard';

interface ProductShowcaseProps {
  /** Products per filter tab; the catalog API replaces the demo sets later. */
  productsFor: Record<ProductFilter, readonly ProductCardData[]>;
}

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
          className="mb-[20px] flex items-center justify-center gap-[6px] min-[769px]:gap-[10px]"
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

        <ul className="grid grid-cols-2 gap-[10px] md:grid-cols-3 md:gap-[12px] lg:mx-[10px] lg:grid-cols-4 lg:gap-[18px]">
          {products.map((product) => (
            <li key={product.id}>
              <ProductCard product={product} />
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
