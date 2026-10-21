'use client';

import { useState } from 'react';
import { Bookmark } from 'lucide-react';
import type { WishlistProduct } from '@youmart/shared-client';
import { showCartToast } from '@/lib/cart-toast';
import { WISHLIST_TOAST_ACTION, useWishlist, useWishlistItem } from '@/lib/wishlist';

interface WishlistButtonProps {
  /** null when the product has no purchasable SKU. */
  product: WishlistProduct | null;
  /** `button`: live's product-page "Add to wishlist". `icon`: heart on a product card (flagged). */
  variant: 'button' | 'icon';
}

/** Saves / un-saves one SKU (guest list or account wishlist - see lib/wishlist.ts). */
export function WishlistButton({ product, variant }: WishlistButtonProps) {
  const wishlist = useWishlist();
  const saved = useWishlistItem(product?.skuId);
  const [busy, setBusy] = useState(false);
  // Bumped on every save so the pop + ring animation replays (keyed elements remount).
  const [popKey, setPopKey] = useState(0);
  const disabled = !product || wishlist.mode === 'loading' || busy;

  const toggle = async () => {
    if (!product || disabled) return;
    setBusy(true);
    try {
      if (saved) {
        if (await wishlist.remove(saved.wishlistItemId)) {
          showCartToast({
            tone: 'success',
            message: `"${product.title}" was removed from your Favourites.`,
            action: WISHLIST_TOAST_ACTION,
          });
        }
      } else if (await wishlist.add(product)) {
        setPopKey((k) => k + 1);
        showCartToast({
          tone: 'success',
          message: `"${product.title}" was saved to your Favourites.`,
          action: WISHLIST_TOAST_ACTION,
        });
      }
    } finally {
      setBusy(false);
    }
  };

  const label = saved ? 'Remove from Favourites' : 'Save to Favourites';

  if (variant === 'icon') {
    return (
      <button
        type="button"
        onClick={() => void toggle()}
        disabled={disabled}
        aria-pressed={Boolean(saved)}
        aria-label={product ? `${label}: ${product.title}` : label}
        title={label}
        className="relative flex size-[34px] items-center justify-center rounded-full bg-white/90 text-brand shadow-[0_1px_4px_rgba(0,0,0,0.15)] transition-transform hover:scale-110 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand disabled:cursor-not-allowed disabled:opacity-60 motion-reduce:transition-none"
      >
        {popKey > 0 && saved && (
          <span key={`ring-${popKey}`} aria-hidden="true" className="ym-save-ring" />
        )}
        <Bookmark
          key={popKey}
          aria-hidden="true"
          className={`size-[18px] ${popKey > 0 && saved ? 'ym-save-pop' : ''}`}
          strokeWidth={2.25}
          fill={saved ? 'currentColor' : 'none'}
        />
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={() => void toggle()}
      disabled={disabled}
      aria-pressed={Boolean(saved)}
      className="flex items-center gap-[5px] rounded-[5px] bg-brand px-[10px] py-[6px] font-sans text-[14.4px] font-semibold leading-[16.56px] text-white hover:opacity-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
    >
      <Bookmark
        key={popKey}
        aria-hidden="true"
        className={`size-[22px] ${popKey > 0 && saved ? 'ym-save-pop' : ''}`}
        fill={saved ? 'currentColor' : 'none'}
      />
      {saved ? 'Saved to Favourites' : 'Save to Favourites'}
    </button>
  );
}
