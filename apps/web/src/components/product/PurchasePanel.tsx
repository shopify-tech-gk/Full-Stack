'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import type { CartProduct } from '@youmart/shared-client';
import { useAddToCart } from '@/lib/cart';

interface PurchasePanelProps {
  /** The SKU the buttons buy (the product's cheapest); null = the product has none to sell. */
  product: CartProduct | null;
  title: string;
}

const MAX_QTY = 999;

// Live: joined -/qty/+ stepper (30/45/30 x 35) then full-width pill ADD TO CART / BUY NOW.
// Buy Now = add to cart, then straight to checkout (WooCommerce's usual buy-now flow).
export function PurchasePanel({ product, title }: PurchasePanelProps) {
  const router = useRouter();
  const addToCart = useAddToCart();
  const [qty, setQty] = useState(1);
  const [busy, setBusy] = useState<'add' | 'buy' | null>(null);
  const clamp = (value: number) => Math.min(MAX_QTY, Math.max(1, Math.round(value) || 1));

  const run = async (kind: 'add' | 'buy') => {
    if (!product || busy) return;
    setBusy(kind);
    try {
      const ok = await addToCart(product, qty);
      if (ok && kind === 'buy') router.push('/checkout');
    } finally {
      setBusy(null);
    }
  };

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    void run('add');
  };

  const step =
    'flex h-[35px] w-[30px] items-center justify-center border border-catalog-qtyBorder bg-brand font-sans text-[18px] font-semibold leading-none text-white disabled:opacity-60 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-1';
  const pill =
    'h-[35px] w-full rounded-full bg-brand px-[20px] font-sans text-[14px] font-semibold uppercase leading-none text-white transition-opacity hover:opacity-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60 aria-busy:cursor-wait';

  return (
    <form onSubmit={onSubmit}>
      <div className="mb-[10px] flex">
        <button
          type="button"
          onClick={() => setQty((q) => clamp(q - 1))}
          disabled={qty <= 1}
          aria-label="Decrease quantity"
          className={`${step} rounded-l-[4px]`}
        >
          -
        </button>
        <input
          type="number"
          inputMode="numeric"
          min={1}
          max={MAX_QTY}
          value={qty}
          onChange={(event) => setQty(clamp(Number(event.target.value)))}
          aria-label={`${title} quantity`}
          className="h-[35px] w-[45px] border border-brand bg-white text-center font-sans text-[15px] text-ink-input [appearance:textfield] focus:outline-none focus-visible:ring-2 focus-visible:ring-brand [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
        />
        <button
          type="button"
          onClick={() => setQty((q) => clamp(q + 1))}
          disabled={qty >= MAX_QTY}
          aria-label="Increase quantity"
          className={`${step} rounded-r-[4px]`}
        >
          +
        </button>
      </div>
      <button
        type="submit"
        disabled={!product}
        aria-busy={busy === 'add' || undefined}
        className={pill}
      >
        {busy === 'add' ? 'Adding…' : 'Add to cart'}
      </button>
      {/* Live pads the label 15px left, pushing it off-centre; centred here (flagged). */}
      <button
        type="button"
        disabled={!product}
        aria-busy={busy === 'buy' || undefined}
        onClick={() => void run('buy')}
        className={`${pill} my-[10px]`}
      >
        Buy Now
      </button>
      {!product && (
        <p className="mb-[10px] font-ui text-[14px] text-woo-error">
          This product is currently unavailable.
        </p>
      )}
    </form>
  );
}
