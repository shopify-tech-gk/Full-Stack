'use client';

import { useEffect, useState } from 'react';
import { MIN_LINE_QUANTITY } from '@youmart/shared-client';

interface QuantityStepperProps {
  title: string;
  quantity: number;
  onChange: (quantity: number) => void;
}

const BUTTON =
  'flex w-[28px] min-w-[28px] items-center justify-center bg-brand text-[16px] font-bold leading-none text-white transition-colors hover:bg-cart-brandDark focus:outline-none focus-visible:bg-cart-brandDark active:bg-cart-brandDark disabled:cursor-not-allowed disabled:opacity-40';

// Live .ymc-qbox: 100x34, 2px brand border, radius 8, brand -/+ buttons. The number is
// typeable here (live's is readonly); removal stays on the trash button.
// POLISH (W4, flagged): soft resting shadow, a light brand focus halo while typing, tabular digits.
export function QuantityStepper({ title, quantity, onChange }: QuantityStepperProps) {
  const [draft, setDraft] = useState(String(quantity));
  useEffect(() => setDraft(String(quantity)), [quantity]);

  const commit = () => {
    const value = Number.parseInt(draft, 10);
    if (Number.isInteger(value) && value >= MIN_LINE_QUANTITY) {
      if (value !== quantity) onChange(value);
    } else {
      setDraft(String(quantity));
    }
  };

  return (
    <div className="inline-flex h-[34px] w-[100px] overflow-hidden rounded-[8px] border-2 border-brand bg-white font-system shadow-rail-card focus-within:ring-2 focus-within:ring-cart-border">
      <button
        type="button"
        onClick={() => onChange(quantity - 1)}
        disabled={quantity <= MIN_LINE_QUANTITY}
        aria-label={`Decrease quantity of ${title}`}
        className={BUTTON}
      >
        &minus;
      </button>
      <input
        type="text"
        inputMode="numeric"
        pattern="[0-9]*"
        value={draft}
        onChange={(event) => setDraft(event.target.value.replace(/\D/g, '').slice(0, 3))}
        onBlur={commit}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            event.preventDefault();
            commit();
          }
        }}
        aria-label={`Quantity of ${title}`}
        className="h-full w-[32px] min-w-0 flex-1 bg-white p-0 text-center text-[13px] font-bold tabular-nums text-cart-ink focus:outline-none focus-visible:bg-cart-rowHover"
      />
      <button
        type="button"
        onClick={() => onChange(quantity + 1)}
        aria-label={`Increase quantity of ${title}`}
        className={BUTTON}
      >
        +
      </button>
    </div>
  );
}
