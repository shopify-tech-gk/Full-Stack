import Image from 'next/image';
import Link from 'next/link';
import {
  discountPercent,
  formatMoney,
  truncateTitle,
  type ProductCardData,
} from '@youmart/shared-client';
import { StarRating } from './StarRating';

interface ProductCardProps {
  product: ProductCardData;
  /** Set for above-the-fold cards. */
  priority?: boolean;
  /** `grid`: homepage product grid. `listing`: category/related WooCommerce loop card. */
  variant?: 'grid' | 'listing';
  /** Listing variant only; live drops it on related products. */
  shadow?: boolean;
}

// Live MRP strike: two red lines crossed at +/-18deg over the struck price.
const STRIKE =
  "relative no-underline text-black before:absolute before:inset-x-0 before:top-[0.56em] before:h-[2px] before:rotate-[18deg] before:bg-price-strike before:content-[''] after:absolute after:inset-x-0 after:top-[0.56em] after:h-[2px] after:-rotate-[18deg] after:bg-price-strike after:content-['']";

/** Measured from the live youmartshop.com product grid (rtsb grid layout 1 + site overrides). */
export function ProductCard({
  product,
  priority,
  variant = 'grid',
  shadow = true,
}: ProductCardProps) {
  if (variant === 'listing') {
    return <ListingCard product={product} priority={priority} shadow={shadow} />;
  }
  const off = discountPercent(product.mrp, product.sellingPrice);
  const mrp = formatMoney(product.mrp);
  const price = formatMoney(product.sellingPrice);

  return (
    <article className="group flex h-full flex-col justify-between overflow-hidden rounded-product-card border-2 border-card-border bg-white shadow-product-card">
      <Link
        href={product.href}
        tabIndex={-1}
        aria-hidden="true"
        className="block h-[160px] overflow-hidden md:h-[140px] lg:h-[200px]"
      >
        <Image
          src={product.image}
          alt=""
          width={400}
          height={400}
          priority={priority}
          unoptimized={product.image.endsWith('.svg')}
          sizes="(min-width: 1025px) 280px, (min-width: 768px) 33vw, 50vw"
          className="size-full object-cover transition-transform duration-[450ms] group-hover:scale-110 motion-reduce:transition-none motion-reduce:group-hover:scale-100"
        />
      </Link>

      <div className="flex flex-col px-[8px] pb-[10px] pt-[8px] md:px-[10px] lg:px-[12px] lg:pb-[12px] lg:pt-[10px]">
        <h3 className="min-h-[38px] md:min-h-0">
          <Link
            href={product.href}
            className="line-clamp-2 font-ui text-[14.6px] font-semibold leading-[1.2] text-black hover:text-brand md:text-[15.5px] lg:text-[17px]"
          >
            {product.title}
          </Link>
        </h3>

        <p className="mt-[12px] font-sans text-[14px] leading-[23.35px] text-ink-body md:text-[14.6px] lg:text-[16px] lg:leading-[25.6px]">
          <span className="mr-[4px] font-bold text-price-label">MRP: </span>
          {off > 0 ? (
            <>
              <del className={STRIKE}>
                <span className="sr-only">Original price was </span>
                {mrp}
              </del>{' '}
              <ins className="no-underline">
                <span className="sr-only">Current price is </span>
                {price}
              </ins>{' '}
              <span className="m-[3px] inline-block rounded-[10px] p-[3.5px] font-bold text-price-discount">
                {off}% OFF
              </span>
            </>
          ) : (
            price
          )}
        </p>

        <div className="mb-[2px] mt-[4px] h-[30.5px]">
          <StarRating rating={product.rating} />
        </div>

        <div className="flex h-[36px] items-center justify-center">
          <button
            type="button"
            data-product-id={product.id}
            className="flex h-[32px] w-full max-w-[105px] items-center justify-center rounded-button bg-brand px-[10px] font-sans text-[12px] font-bold leading-[1.15] tracking-[0.8px] text-white transition-opacity hover:opacity-85 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 md:max-w-[120px] md:px-[12px] md:text-[13px] lg:h-[34px] lg:px-[15px] lg:text-[14px]"
          >
            Add<span className="sr-only"> {product.title} to cart</span>
          </button>
        </div>
      </div>
    </article>
  );
}

/** Live category/related loop card (Astra WooCommerce template + YouMart overrides). */
function ListingCard({ product, priority, shadow }: Omit<ProductCardProps, 'variant'>) {
  const off = discountPercent(product.mrp, product.sellingPrice);
  const { text, truncated } = truncateTitle(product.title);

  return (
    <article
      className={`flex h-full flex-col overflow-hidden rounded-[10px] border border-catalog-rule bg-white ${
        shadow ? 'shadow-listing-card' : ''
      }`}
    >
      <Link
        href={product.href}
        tabIndex={-1}
        aria-hidden="true"
        className="block h-[140px] shrink-0 md:h-[200px]"
      >
        <Image
          src={product.image}
          alt=""
          width={400}
          height={400}
          priority={priority}
          unoptimized={product.image.endsWith('.svg')}
          sizes="(min-width: 1025px) 285px, (min-width: 768px) 33vw, 40vw"
          className="size-full object-contain"
        />
      </Link>

      <div className="mb-[5px] px-[7px]">
        <h3 className="mb-[7px] font-ui text-[13px] font-semibold leading-[1.3] text-heading md:mb-[15px] md:text-[16px]">
          <Link href={product.href} className="hover:text-brand" title={product.title}>
            {text}
            {truncated && (
              <span className="font-normal text-catalog-muted text-[12px]"> See more</span>
            )}
          </Link>
        </h3>

        <p className="font-sans text-[14.4px] font-bold leading-[1.3] text-ink-body">
          <span className="mr-[4px] text-price-label">MRP: </span>
          {off > 0 ? (
            <>
              <del className={STRIKE}>
                <span className="sr-only">Original price was </span>
                {formatMoney(product.mrp)}
              </del>{' '}
              <ins className="text-[18px] font-black text-black no-underline">
                <span className="sr-only">Current price is </span>
                {formatMoney(product.sellingPrice)}
              </ins>
            </>
          ) : (
            formatMoney(product.sellingPrice)
          )}
        </p>

        <div className="mt-[7.2px] h-[19.2px]">
          <StarRating rating={product.rating} variant="woo" size={19.2} />
        </div>

        <div className="mt-[12px] flex h-[36px] items-center justify-center">
          <button
            type="button"
            data-product-id={product.id}
            className="h-[34px] w-full max-w-[120px] rounded-[6px] bg-brand px-[15px] font-sans text-[14px] font-semibold leading-[1.15] text-white transition-opacity hover:opacity-85 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2"
          >
            Add<span className="sr-only"> {product.title} to cart</span>
          </button>
        </div>
      </div>
    </article>
  );
}
