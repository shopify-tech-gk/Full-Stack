'use client';

import { useState } from 'react';
import { Minus, Plus, Trash2 } from 'lucide-react';
import type { ProductCardData } from '@youmart/shared-client';
import { useAddToCart, useCart } from '@/lib/cart';

/**
 * The card's "Add" button: adds one of the card's SKU (the cheapest, as the price shown). Once that
 * SKU is in the cart it becomes a − qty + stepper in the same spot (Flipkart-style, as in the app);
 * at 1 the minus is a bin that removes the line.
 */
export function AddToCartButton({
  product,
  className,
}: {
  product: ProductCardData;
  className: string;
}) {
  const addToCart = useAddToCart();
  const { cart, setQuantity, remove } = useCart();
  const [adding, setAdding] = useState(false);
  const { skuId, slug } = product;
  const line = skuId ? cart?.items.find((item) => item.skuId === skuId) : undefined;

  const onClick = async () => {
    if (!skuId || !slug || adding) return;
    setAdding(true);
    try {
      await addToCart(
        {
          skuId,
          productId: product.id,
          productSlug: slug,
          title: product.title,
          price: product.sellingPrice,
          image: product.image,
        },
        1,
      );
    } finally {
      setAdding(false);
    }
  };

  if (line) {
    const step =
      'flex h-full w-[30px] shrink-0 items-center justify-center rounded-[6px] transition-colors hover:bg-white/20 focus:outline-none focus-visible:ring-2 focus-visible:ring-white';
    return (
      <div
        role="group"
        aria-label={`${product.title} in cart`}
        className={`${className} !justify-between !gap-0 !px-[2px] hover:!opacity-100`}
      >
        <button
          type="button"
          onClick={() =>
            line.quantity <= 1
              ? remove(line.cartItemId)
              : setQuantity(line.cartItemId, line.quantity - 1)
          }
          aria-label={line.quantity <= 1 ? 'Remove from cart' : 'Decrease quantity'}
          className={step}
        >
          {line.quantity <= 1 ? (
            <Trash2 aria-hidden="true" className="size-[14px]" />
          ) : (
            <Minus aria-hidden="true" className="size-[14px]" strokeWidth={3} />
          )}
        </button>
        <span aria-live="polite" className="min-w-[20px] text-center tabular-nums">
          {line.quantity}
        </span>
        <button
          type="button"
          onClick={() => setQuantity(line.cartItemId, line.quantity + 1)}
          aria-label="Increase quantity"
          className={step}
        >
          <Plus aria-hidden="true" className="size-[14px]" strokeWidth={3} />
        </button>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => void onClick()}
      disabled={!skuId}
      aria-busy={adding || undefined}
      title={skuId ? undefined : 'Currently unavailable'}
      className={`${className} disabled:cursor-not-allowed disabled:opacity-60 aria-busy:cursor-wait aria-busy:opacity-80`}
    >
      Add<span className="sr-only"> {product.title} to cart</span>
    </button>
  );
}
