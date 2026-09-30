'use client';

import { useState } from 'react';
import type { ProductCardData } from '@youmart/shared-client';
import { useAddToCart } from '@/lib/cart';

/** The card's "Add" button: adds one of the card's SKU (the cheapest, as the price shown). */
export function AddToCartButton({
  product,
  className,
}: {
  product: ProductCardData;
  className: string;
}) {
  const addToCart = useAddToCart();
  const [adding, setAdding] = useState(false);
  const { skuId, slug } = product;

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
