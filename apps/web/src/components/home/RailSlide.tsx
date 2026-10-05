import type { ProductCardData } from '@youmart/shared-client';
import { ProductCard } from '@/components/product/ProductCard';

/** One card in a desktop rail slider - the same markup for server (fallback) and client (personal). */
export function RailSlide({ product }: { product: ProductCardData }) {
  return (
    <li className="w-[calc((100%-56px)/5)] shrink-0 snap-start pb-[6px] pt-[4px] transition-transform duration-300 hover:-translate-y-[4px] motion-reduce:transition-none motion-reduce:hover:translate-y-0 min-[1280px]:w-[calc((100%-70px)/6)]">
      <ProductCard product={product} />
    </li>
  );
}
