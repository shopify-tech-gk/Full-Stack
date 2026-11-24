'use client';

import { useMemo, useState } from 'react';
import { BadgeCheck, Star, Truck } from 'lucide-react';
import { FREE_DELIVERY_MIN, discountPercent, formatMoney, type ProductDetailData } from '@youmart/shared-client';
import { ProductGallery } from './ProductGallery';
import { PurchasePanel } from './PurchasePanel';
import { VariantPicker } from './VariantPicker';

/**
 * The top of the product page: gallery on the left; title, rating, price, the option picker and the
 * buy buttons on the right. Picking an option switches the photos, price and what Add / Buy buy.
 * `children` is the rest of the right column (assurance, categories, share...).
 */
export function ProductHero({
  product,
  reviewCount,
  children,
}: {
  product: ProductDetailData;
  reviewCount: number;
  children?: React.ReactNode;
}) {
  const [skuId, setSkuId] = useState<string | null>(product.skuId);
  const variant = product.variants.find((v) => v.skuId === skuId) ?? null;
  const mrp = variant?.mrp ?? product.mrp;
  const price = variant?.sellingPrice ?? product.sellingPrice;
  const off = discountPercent(mrp, price);
  const images = useMemo(() => {
    if (variant?.images.length) return variant.images;
    if (variant?.image) return [variant.image, ...product.images.filter((i) => i !== variant.image)];
    return product.images;
  }, [variant, product.images]);
  const title = variant?.title ?? product.title;

  return (
    <div className="lg:flex lg:items-start lg:justify-between lg:gap-[40px]">
      <div className="lg:sticky lg:top-[96px]">
        <ProductGallery key={images.join('|')} images={images} title={title} />
      </div>

      <div className="mb-[32px] min-w-0 font-ui lg:w-[560px] lg:shrink-0">
        <h1 className="text-[20px] font-semibold leading-[1.3] text-heading md:text-[24px] lg:text-[28px]">{title}</h1>

        <div className="mt-[10px] flex flex-wrap items-center gap-[10px]">
          {product.rating > 0 ? (
            <span className="inline-flex items-center gap-[4px] rounded-[6px] bg-[#15803d] px-[8px] py-[2px] text-[13px] font-semibold text-white">
              {product.rating.toFixed(1)} <Star aria-hidden="true" className="size-[12px] fill-white" />
            </span>
          ) : null}
          <a href="#reviews" className="text-[14px] text-brand hover:underline">
            {reviewCount > 0 ? `${reviewCount} review${reviewCount === 1 ? '' : 's'}` : 'Be the first to review'}
          </a>
        </div>

        <div className="mt-[16px] rounded-[16px] border border-catalog-rule bg-white p-[18px] shadow-rail-card">
          <div className="flex flex-wrap items-end gap-x-[12px] gap-y-[4px]">
            {off > 0 ? <span className="text-[22px] font-light text-[#e11d48]">-{off}%</span> : null}
            <span className="text-[32px] font-bold leading-none tracking-tight text-heading">
              <span className="sr-only">Price </span>
              {formatMoney(price)}
            </span>
          </div>
          {off > 0 ? (
            <p className="mt-[6px] text-[13.5px] text-ink-muted">
              M.R.P.: <del>{formatMoney(mrp)}</del>{' '}
              <span className="font-semibold text-[#15803d]">You save {formatMoney((Number(mrp) - Number(price)).toFixed(2) as typeof price)}</span>
            </p>
          ) : null}
          <p className="mt-[2px] text-[12.5px] text-ink-muted">Inclusive of all taxes</p>
          <div className="mt-[12px] flex flex-wrap gap-[14px] border-t border-dashed border-catalog-rule pt-[12px] text-[13px] text-ink-body">
            <span className="inline-flex items-center gap-[6px]">
              <Truck aria-hidden="true" className="size-[16px] text-brand" />
              Free delivery on orders over {formatMoney(FREE_DELIVERY_MIN).replace(/\.00$/, '')}
            </span>
            <span className="inline-flex items-center gap-[6px]">
              <BadgeCheck aria-hidden="true" className="size-[16px] text-[#15803d]" />
              100% genuine
            </span>
          </div>
        </div>

        {product.shortDescription ? (
          <p className="mt-[16px] text-[15px] leading-[1.6] text-ink-body">{product.shortDescription}</p>
        ) : null}

        <div className="mt-[18px]">
          {product.variants.length > 1 ? (
            <VariantPicker prod={product} selectedSkuId={skuId} onSelect={setSkuId} />
          ) : null}
          <PurchasePanel
            key={skuId ?? 'none'}
            title={title}
            product={
              skuId
                ? {
                    skuId,
                    productId: product.id,
                    productSlug: product.slug,
                    title: variant ? `${product.title}${variant.label ? ` (${variant.label})` : ''}` : product.title,
                    price,
                    image: images[0],
                  }
                : null
            }
          />
        </div>

        {product.highlights.length ? (
          <div className="mt-[18px] rounded-[14px] bg-[#f6f8fb] p-[16px]">
            <p className="mb-[8px] text-[15px] font-semibold text-heading">About this item</p>
            <ul className="list-disc space-y-[6px] pl-[18px] text-[14px] leading-[1.55] text-ink-body">
              {product.highlights.map((h) => (
                <li key={h}>{h}</li>
              ))}
            </ul>
          </div>
        ) : null}

        <div className="mt-[16px]">{children}</div>
      </div>
    </div>
  );
}
