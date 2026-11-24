import Image from 'next/image';
import Link from 'next/link';
import { Star } from 'lucide-react';
import { discountPercent, formatMoney, type ProductCardData } from '@youmart/shared-client';
import { skipImageOptimizer } from '@/lib/images';
import { AddToCartButton } from './AddToCartButton';
import { WishlistButton } from './WishlistButton';

interface ProductCardProps {
  product: ProductCardData;
  /** Set for above-the-fold cards. */
  priority?: boolean;
  /** `grid`: homepage rails / showcase. `listing`: category, search, related and account lists. */
  variant?: 'grid' | 'listing';
  /** Kept for callers; the card always has its soft resting shadow now. */
  shadow?: boolean;
}

// A wishlist heart on every card (top right).
function CardHeart({ product }: { product: ProductCardData }) {
  const { skuId, slug } = product;
  return (
    <div className="absolute right-[8px] top-[8px] z-[2]">
      <WishlistButton
        variant="icon"
        product={
          skuId && slug
            ? {
                skuId,
                productId: product.id,
                productSlug: slug,
                title: product.title,
                price: product.sellingPrice,
                mrp: product.mrp,
              }
            : null
        }
      />
    </div>
  );
}

/** "★ 4.3" for rated products; nothing (same height) for products without reviews yet. */
function Rating({ rating }: { rating: number }) {
  if (!rating || rating <= 0) return <div aria-hidden="true" className="h-[20px]" />;
  const tone = rating >= 4 ? 'bg-[#15803d]' : rating >= 3 ? 'bg-[#65a30d]' : 'bg-[#d97706]';
  return (
    <div className="h-[20px]">
      <span
        className={`inline-flex items-center gap-[3px] rounded-[6px] px-[6px] py-[1px] font-ui text-[12px] font-semibold text-white ${tone}`}
        aria-label={`Rated ${rating.toFixed(1)} out of 5`}
      >
        {rating.toFixed(1)}
        <Star aria-hidden="true" className="size-[11px] fill-white" />
      </span>
    </div>
  );
}

/**
 * The storefront product card (home rails, category / search grids, related products): a clean
 * white card with the photo on white, a discount tag, the title in two lines, rating when there is
 * one, a bold price over the struck MRP, and a full-width Add button that turns into a quantity
 * stepper once the item is in the cart. Lifts softly on hover.
 */
export function ProductCard({ product, priority, variant = 'grid' }: ProductCardProps) {
  const off = discountPercent(product.mrp, product.sellingPrice);
  const listing = variant === 'listing';

  return (
    <article className="group relative flex h-full flex-col overflow-hidden rounded-[14px] border border-[#e3e9f2] bg-white shadow-[0_1px_3px_rgba(15,23,42,0.06)] transition-[box-shadow,transform,border-color] duration-200 hover:-translate-y-[2px] hover:border-[#c9d8f2] hover:shadow-[0_12px_28px_rgba(15,23,42,0.10)] motion-reduce:transition-none motion-reduce:hover:translate-y-0">
      <CardHeart product={product} />
      {off > 0 ? (
        <span className="absolute left-[8px] top-[8px] z-[2] rounded-[6px] bg-[#e11d48] px-[7px] py-[2px] font-ui text-[11.5px] font-bold text-white shadow-sm">
          {off}% OFF
        </span>
      ) : null}
      <Link
        href={product.href}
        tabIndex={-1}
        aria-hidden="true"
        className={`relative block shrink-0 overflow-hidden bg-white ${listing ? 'h-[150px] md:h-[200px]' : 'h-[160px] md:h-[150px] lg:h-[200px]'}`}
      >
        <Image
          src={product.image}
          alt=""
          width={400}
          height={400}
          priority={priority}
          unoptimized={skipImageOptimizer(product.image)}
          sizes="(min-width: 1025px) 280px, (min-width: 768px) 33vw, 50vw"
          className="size-full object-contain p-[10px] transition-transform duration-[450ms] group-hover:scale-[1.06] motion-reduce:transition-none motion-reduce:group-hover:scale-100"
        />
      </Link>

      <div className="flex flex-1 flex-col border-t border-[#eef2f7] px-[10px] pb-[10px] pt-[9px] lg:px-[12px] lg:pb-[12px]">
        <h3 className="min-h-[2.7em] font-ui text-[13.5px] font-medium leading-[1.35] lg:text-[14.5px]">
          <Link href={product.href} title={product.title} className="line-clamp-2 text-heading transition-colors hover:text-brand">
            {product.title}
          </Link>
        </h3>

        <div className="mt-[6px]">
          <Rating rating={product.rating} />
        </div>

        <p className="mt-[6px] flex flex-wrap items-baseline gap-x-[7px] font-ui leading-[1.2]">
          <ins className="text-[17px] font-bold text-heading no-underline lg:text-[18px]">
            <span className="sr-only">Price </span>
            {formatMoney(product.sellingPrice)}
          </ins>
          {off > 0 ? (
            <del className="text-[12.5px] text-ink-muted lg:text-[13px]">
              <span className="sr-only">MRP was </span>
              {formatMoney(product.mrp)}
            </del>
          ) : null}
        </p>

        <div className="mt-auto pt-[10px]">
          <AddToCartButton
            product={product}
            className="flex h-[36px] w-full items-center justify-center gap-[6px] rounded-[10px] bg-brand px-[10px] font-ui text-[13.5px] font-semibold text-white transition-[background-color,box-shadow] hover:bg-[#0a3a8f] hover:shadow-brand-button focus:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2"
          />
        </div>
      </div>
    </article>
  );
}
