'use client';

import { useState, type FormEvent } from 'react';

interface PurchasePanelProps {
  productId: string;
  title: string;
}

const MAX_QTY = 999;

// Live: joined -/qty/+ stepper (30/45/30 x 35) then full-width pill ADD TO CART / BUY NOW.
// DEMO: not wired to the cart yet.
export function PurchasePanel({ productId, title }: PurchasePanelProps) {
  const [qty, setQty] = useState(1);
  const clamp = (value: number) => Math.min(MAX_QTY, Math.max(1, Math.round(value) || 1));

  const onSubmit = (event: FormEvent) => event.preventDefault();

  const step =
    'flex h-[35px] w-[30px] items-center justify-center border border-catalog-qtyBorder bg-brand font-sans text-[18px] font-semibold leading-none text-white disabled:opacity-60 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-1';
  const pill =
    'h-[35px] w-full rounded-full bg-brand px-[20px] font-sans text-[14px] font-semibold uppercase leading-none text-white transition-opacity hover:opacity-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2';

  return (
    <form onSubmit={onSubmit} data-product-id={productId}>
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
      <button type="submit" className={pill}>
        Add to cart
      </button>
      {/* Live pads the label 15px left, pushing it off-centre; centred here (flagged). */}
      <button type="button" className={`${pill} my-[10px]`}>
        Buy Now
      </button>
    </form>
  );
}
