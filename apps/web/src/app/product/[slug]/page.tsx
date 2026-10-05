import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  SAFE_CHECKOUT_LABEL,
  SAFE_CHECKOUT_METHODS,
  discountPercent,
  formatMoney,
} from '@youmart/shared-client';
import { CategoryBar } from '@/components/category/CategoryBar';
import { ProductCard } from '@/components/product/ProductCard';
import { ProductGallery } from '@/components/product/ProductGallery';
import { ProductTabs } from '@/components/product/ProductTabs';
import { PurchasePanel } from '@/components/product/PurchasePanel';
import { ProductViewTracker } from '@/components/product/ProductViewTracker';
import { ShareButtons } from '@/components/product/ShareButtons';
import { StarRating } from '@/components/product/StarRating';
import { getProductDetail } from '@/lib/catalog';
import { WishlistButton } from '@/components/product/WishlistButton';
import { categoryBarMains } from '@/lib/category-taxonomy';

interface ProductPageProps {
  params: { slug: string };
}

const CARD_ICONS: Record<(typeof SAFE_CHECKOUT_METHODS)[number], string> = {
  Visa: '/placeholders/card-visa.svg',
  Mastercard: '/placeholders/card-mastercard.svg',
  'American Express': '/placeholders/card-amex.svg',
  Discover: '/placeholders/card-discover.svg',
};

const STRIKE =
  "relative no-underline text-black before:absolute before:inset-x-0 before:top-[0.56em] before:h-[2px] before:rotate-[18deg] before:bg-price-strike before:content-[''] after:absolute after:inset-x-0 after:top-[0.56em] after:h-[2px] after:-rotate-[18deg] after:bg-price-strike after:content-['']";

export async function generateMetadata({ params }: ProductPageProps): Promise<Metadata> {
  const product = await getProductDetail(params.slug);
  return product ? { title: `${product.title} - You Mart` } : {};
}

export default async function ProductPage({ params }: ProductPageProps) {
  const product = await getProductDetail(params.slug);
  if (!product) {
    notFound();
  }
  const off = discountPercent(product.mrp, product.sellingPrice);
  const reviewCount = product.ratingCount;

  return (
    <>
      <ProductViewTracker productId={product.id} />
      <CategoryBar mains={categoryBarMains()} />
      <div className="mx-auto mt-[10px] max-w-[1240px] px-[20px] lg:my-[64px]">
        <div className="lg:flex lg:items-start lg:justify-between">
          <ProductGallery images={product.images} title={product.title} />

          <div className="mb-[32px] lg:w-[552px]">
            {/* Live renders the title at 13px on mobile (smaller than body text); 20px is the flagged fix. */}
            <h1 className="font-ui text-[20px] font-semibold leading-[1.3] text-heading md:text-[25px] lg:text-[34px]">
              {product.title}
            </h1>

            <div className="mb-[8px] flex items-center font-sans leading-[32px]">
              <span className="mr-[4px]">
                <StarRating rating={product.rating} variant="woo" size={16} />
              </span>
              <a href="#reviews" className="font-ui text-[16px] text-brand hover:underline">
                (<span>{reviewCount}</span> customer review{reviewCount === 1 ? '' : 's'})
              </a>
            </div>

            <p className="mb-[16px] font-ui text-[16px] leading-[25.6px] text-ink-body">
              {product.shortDescription}
            </p>

            <p className="mb-[3.2px] font-sans text-[16px] font-bold leading-[25.6px] text-ink-body">
              <span className="mr-[4px] text-price-label">MRP: </span>
              {off > 0 ? (
                <>
                  <del className={STRIKE}>
                    <span className="sr-only">Original price was </span>
                    {formatMoney(product.mrp)}
                  </del>{' '}
                  <ins className="no-underline">
                    <span className="sr-only">Current price is </span>
                    {formatMoney(product.sellingPrice)}
                  </ins>{' '}
                  <span className="text-price-discount">{off}% OFF</span>
                </>
              ) : (
                formatMoney(product.sellingPrice)
              )}
            </p>

            <PurchasePanel
              title={product.title}
              product={
                product.skuId
                  ? {
                      skuId: product.skuId,
                      productId: product.id,
                      productSlug: product.slug,
                      title: product.title,
                      price: product.sellingPrice,
                      image: product.images[0],
                    }
                  : null
              }
            />

            <div className="mb-[11.52px] border-t border-catalog-rule pt-[7.2px] font-sans text-[14.4px] font-medium leading-[25.6px] text-ink-body">
              Categories:{' '}
              {product.categories.map((category, index) => (
                <span key={category.href}>
                  {index > 0 && ', '}
                  <Link
                    href={category.href}
                    className="font-ui font-normal text-brand hover:underline"
                  >
                    {category.name}
                  </Link>
                </span>
              ))}
            </div>

            <fieldset className="mb-[16px] rounded-[4px] border border-catalog-rule px-[20px] pb-[18px] pt-[13px]">
              <legend className="mx-auto px-[8px] font-sans text-[16px] font-semibold leading-[25.6px] text-ink-body">
                {SAFE_CHECKOUT_LABEL}
              </legend>
              <ul className="flex flex-wrap justify-center">
                {SAFE_CHECKOUT_METHODS.map((method) => (
                  <li key={method} className="mx-[8px] mb-[8px]">
                    <Image
                      src={CARD_ICONS[method]}
                      alt={method}
                      width={48}
                      height={30}
                      unoptimized
                    />
                  </li>
                ))}
              </ul>
            </fieldset>

            <div className="mb-[4px] pt-[7px]">
              <WishlistButton
                variant="button"
                product={
                  product.skuId
                    ? {
                        skuId: product.skuId,
                        productId: product.id,
                        productSlug: product.slug,
                        title: product.title,
                        price: product.sellingPrice,
                        mrp: product.mrp,
                      }
                    : null
                }
              />
            </div>
            {/* Live's back-in-stock "Notify" button is left out until a stock-alert API exists
                (W6 deferred) - a button that does nothing would be demo UI. */}

            <ShareButtons title={product.title} />
          </div>
        </div>

        <div id="reviews">
          <ProductTabs
            slug={product.slug}
            description={product.description}
            specifications={product.specifications}
            title={product.title}
          />
        </div>

        {product.related.length > 0 && (
          <section aria-labelledby="related-products">
            {/* Live: 13px on mobile like the title; matched to the title fix. */}
            <h2
              id="related-products"
              className="font-ui text-[20px] font-semibold leading-[1.3] text-heading md:text-[25px] lg:text-[34px]"
            >
              Related products
            </h2>
            <ul className="mb-[16px] grid grid-cols-2 gap-x-[10px] md:grid-cols-3 md:gap-x-[20px] lg:grid-cols-4">
              {product.related.map((item) => (
                <li key={item.id} className="mb-[10px]">
                  <ProductCard product={item} variant="listing" shadow={false} />
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </>
  );
}
