'use client';

import Image from 'next/image';
import Link from 'next/link';
import { Trash2 } from 'lucide-react';
import {
  ROUTES,
  formatMoney,
  loginHref,
  productHref,
  type WishlistItem,
} from '@youmart/shared-client';
import { Notice } from '@/components/account/Notice';
import { TEXT_LINK } from '@/components/account/formStyles';
import { useAddToCart } from '@/lib/cart';
import { skipImageOptimizer } from '@/lib/images';
import { useProductImages } from '@/lib/product-images';
import { useWishlist } from '@/lib/wishlist';

const TH =
  'border-b border-catalog-rule px-[12px] py-[11.2px] text-left font-ui text-[14.6px] font-bold text-ink-body lg:text-[16px]';
const TD = 'px-[12px] py-[10px] align-middle max-md:py-[4px]';
// Below 768px each row stacks like WooCommerce's responsive shop_table.
const STACK =
  'max-md:flex max-md:items-center max-md:justify-between max-md:gap-[12px] max-md:before:font-bold max-md:before:content-[attr(data-title)]';

/** Live YITH wishlist table backed by the guest list or /api/wishlist (lib/wishlist.ts). */
export function WishlistTable() {
  const wishlist = useWishlist();
  const addToCart = useAddToCart();
  const items = wishlist.view?.items ?? [];
  const imageFor = useProductImages(items.flatMap((item) => item.productSlug ?? []));

  if (wishlist.failed) {
    return (
      <Notice tone="error">
        We could not load your wishlist.{' '}
        <button type="button" onClick={() => void wishlist.reload()} className={TEXT_LINK}>
          Try again
        </button>
      </Notice>
    );
  }
  if (!wishlist.view) {
    return <div aria-busy="true" aria-label="Loading your wishlist" className="min-h-[200px]" />;
  }

  const moveToCart = async (item: WishlistItem) => {
    if (!item.productSlug || !item.title || !item.sellingPrice) return;
    await addToCart(
      {
        skuId: item.skuId,
        productId: item.productId,
        productSlug: item.productSlug,
        title: item.title,
        price: item.sellingPrice,
        image: imageFor(item.productSlug),
      },
      1,
    );
  };

  return (
    <>
      {wishlist.mode === 'guest' && items.length > 0 && (
        <Notice tone="info">
          Your wishlist is saved on this device.{' '}
          <Link href={loginHref(ROUTES.wishlist)} className={TEXT_LINK}>
            Log in
          </Link>{' '}
          to keep it in your account.
        </Notice>
      )}
      <table className="w-full border-separate border-spacing-0 rounded-[10px] border border-catalog-rule bg-white font-ui text-[14.6px] text-ink-body lg:text-[16px]">
        <thead className={items.length > 0 ? 'max-md:sr-only' : undefined}>
          <tr>
            {['Picture', 'Product Name', 'Price', 'Action'].map((title) => (
              <th key={title} scope="col" className={TH}>
                {title}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {items.length === 0 ? (
            <tr>
              <td colSpan={4} className="px-[12px] py-[16px] text-center">
                No products added to the wishlist
              </td>
            </tr>
          ) : (
            items.map((item) => {
              const href = item.productSlug ? productHref(item.productSlug) : null;
              const title = item.title ?? 'Product no longer available';
              return (
                <tr
                  key={item.wishlistItemId}
                  className="max-md:block max-md:border-t max-md:border-catalog-rule max-md:py-[8px] max-md:first:border-t-0"
                >
                  <td data-title="Picture" className={`${TD} ${STACK} w-[96px]`}>
                    {item.productSlug && (
                      <Image
                        src={imageFor(item.productSlug)}
                        alt=""
                        width={72}
                        height={72}
                        unoptimized={skipImageOptimizer(imageFor(item.productSlug))}
                        className="size-[72px] rounded-[6px] object-contain"
                      />
                    )}
                  </td>
                  <th
                    scope="row"
                    data-title="Product"
                    className={`${TD} ${STACK} text-left font-normal`}
                  >
                    {href ? (
                      <Link href={href} className={TEXT_LINK}>
                        {title}
                      </Link>
                    ) : (
                      <span className="text-ink-muted">{title}</span>
                    )}
                  </th>
                  <td
                    data-title="Price"
                    className={`${TD} ${STACK} whitespace-nowrap font-sans font-bold tabular-nums`}
                  >
                    {item.sellingPrice ? formatMoney(item.sellingPrice) : '\u2014'}
                    {!item.available && (
                      <span className="ml-[8px] font-ui text-[13px] font-normal text-woo-error">
                        Out of stock
                      </span>
                    )}
                  </td>
                  <td data-title="Action" className={`${TD} ${STACK}`}>
                    <span className="flex items-center gap-[10px]">
                      <button
                        type="button"
                        onClick={() => void moveToCart(item)}
                        disabled={!item.available || !item.sellingPrice}
                        className="h-[34px] whitespace-nowrap rounded-[6px] bg-brand px-[15px] font-sans text-[14px] font-semibold leading-none text-white hover:opacity-85 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        Add to cart
                      </button>
                      <button
                        type="button"
                        onClick={() => void wishlist.remove(item.wishlistItemId)}
                        aria-label={`Remove ${title} from wishlist`}
                        className="flex size-[34px] items-center justify-center rounded-[6px] text-woo-error hover:bg-[#fdf0f0] focus:outline-none focus-visible:ring-2 focus-visible:ring-brand"
                      >
                        <Trash2 aria-hidden="true" className="size-[18px]" />
                      </button>
                    </span>
                  </td>
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </>
  );
}
