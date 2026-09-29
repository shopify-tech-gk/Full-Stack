'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  DEMO_SHIPPING_TOTAL,
  cartTotals,
  demoCartLineImage,
  type CartLine,
} from '@youmart/shared-client';
import { Notice } from '@/components/account/Notice';
import { FIELD_HINT, TEXT_LINK } from '@/components/account/formStyles';
import { useCart } from '@/lib/cart';
import { CartLines } from './CartLines';
import { CartTotals } from './CartTotals';

/** Live empty cart: "Your Cart is Empty" (Outfit 24/700) + a pill "Return to shop" button. */
export function EmptyCart({ onRestoreDemo }: { onRestoreDemo?: () => void }) {
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
      {onRestoreDemo && (
        // DEMO only - remove when the cart API is wired.
        <p className={`${FIELD_HINT} mt-[16px]`}>
          Demo:{' '}
          <button type="button" onClick={onRestoreDemo} className={TEXT_LINK}>
            restore the sample cart
          </button>
          .
        </p>
      )}
    </div>
  );
}

interface CartViewProps {
  destination: string | null;
}

export function CartView({ destination }: CartViewProps) {
  const { cart, setQuantity, remove, restore, reset } = useCart();
  const [removed, setRemoved] = useState<{ line: CartLine; index: number } | null>(null);

  if (!cart) {
    return <div aria-busy="true" className="min-h-[320px]" />;
  }

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
        {undo}
        <EmptyCart onRestoreDemo={reset} />
      </>
    );
  }

  return (
    <>
      {undo && <div className="mt-[20px]">{undo}</div>}
      <CartLines
        items={cart.items}
        imageFor={demoCartLineImage}
        onQuantity={(line, quantity) => {
          setRemoved(null);
          setQuantity(line.cartItemId, quantity);
        }}
        onRemove={onRemove}
      />
      <CartTotals totals={cartTotals(cart, DEMO_SHIPPING_TOTAL)} destination={destination} />
    </>
  );
}
