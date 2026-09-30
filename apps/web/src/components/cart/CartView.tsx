'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  CART_SHIPPING_TOTAL,
  cartTotals,
  defaultCheckoutAddress,
  type CartLine,
} from '@youmart/shared-client';
import { Notice } from '@/components/account/Notice';
import { TEXT_LINK } from '@/components/account/formStyles';
import { useAddresses } from '@/lib/addresses';
import { useCart, type CartNotice } from '@/lib/cart';
import { useProductImages } from '@/lib/product-images';
import { CartLines } from './CartLines';
import { CartTotals } from './CartTotals';

/** Live empty cart: "Your Cart is Empty" (Outfit 24/700) + a pill "Return to shop" button. */
export function EmptyCart() {
  return (
    <div className="mb-[25.6px] font-ui">
      <p className="mb-[15px] text-[24px] font-bold leading-[25.6px] text-black">
        Your Cart is Empty
      </p>
      <Link
        href="/"
        className="inline-flex h-[39.8px] items-center rounded-[30px] border-2 border-white bg-brand px-[36px] text-[14px] font-bold uppercase text-white transition-opacity hover:opacity-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2"
      >
        Return to shop
      </Link>
    </div>
  );
}

function StoreNotice({ notice, onDismiss }: { notice: CartNotice; onDismiss: () => void }) {
  return (
    <Notice tone={notice.tone}>
      {notice.message}
      {notice.details && notice.details.length > 0 && (
        <ul className="mt-[4px] list-disc pl-[18px]">
          {notice.details.map((detail) => (
            <li key={detail}>{detail}</li>
          ))}
        </ul>
      )}{' '}
      <button type="button" onClick={onDismiss} className={TEXT_LINK}>
        Dismiss
      </button>
    </Notice>
  );
}

export function CartView() {
  const { mode, cart, notice, setQuantity, remove, restore, dismissNotice, reload } = useCart();
  const { addresses } = useAddresses();
  const imageFor = useProductImages(cart?.items.map((line) => line.productSlug) ?? []);
  const [removed, setRemoved] = useState<{ line: CartLine; index: number } | null>(null);

  const storeNotice = notice && (
    <div className="mt-[20px]">
      <StoreNotice notice={notice} onDismiss={dismissNotice} />
    </div>
  );

  if (!cart) {
    // The account cart failed to load: say so and offer a retry (never an empty-looking cart).
    if (mode === 'account' && notice?.tone === 'error') {
      return (
        <div className="mt-[20px]">
          <Notice tone="error">
            {notice.message}{' '}
            <button type="button" onClick={reload} className={TEXT_LINK}>
              Try again
            </button>
          </Notice>
        </div>
      );
    }
    return <div aria-busy="true" aria-label="Loading your cart" className="min-h-[320px]" />;
  }

  // Only a signed-in customer has a saved default address to estimate delivery to.
  const destination =
    mode === 'account' && addresses ? (defaultCheckoutAddress(addresses)?.state ?? null) : null;

  const onRemove = (line: CartLine) => {
    setRemoved({ line, index: cart.items.findIndex((i) => i.cartItemId === line.cartItemId) });
    remove(line.cartItemId);
  };

  const undo = removed && (
    <Notice tone="success">
      &ldquo;{removed.line.title}&rdquo; removed.{' '}
      <button
        type="button"
        onClick={() => {
          restore(removed.line, removed.index);
          setRemoved(null);
        }}
        className={TEXT_LINK}
      >
        Undo?
      </button>
    </Notice>
  );

  if (cart.items.length === 0) {
    return (
      <>
        {storeNotice}
        {undo && <div className="mt-[20px]">{undo}</div>}
        <EmptyCart />
      </>
    );
  }

  return (
    <>
      {storeNotice}
      {undo && <div className="mt-[20px]">{undo}</div>}
      <CartLines
        items={cart.items}
        imageFor={(line) => imageFor(line.productSlug)}
        onQuantity={(line, quantity) => {
          setRemoved(null);
          setQuantity(line.cartItemId, quantity);
        }}
        onRemove={onRemove}
      />
      <CartTotals totals={cartTotals(cart, CART_SHIPPING_TOTAL)} destination={destination} />
    </>
  );
}
