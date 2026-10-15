'use client';

import { useEffect, useState } from 'react';
import { Check, Loader2, ShoppingBag } from 'lucide-react';

/** Waits at least `ms` - paired with real work so the steps never flash by. */
export const atLeast = <T,>(work: Promise<T>, ms: number): Promise<T> =>
  Promise.all([work, new Promise((r) => setTimeout(r, ms))]).then(([value]) => value);

export const PLACING_STEP_MS = 850;

/**
 * "Placing your order" (same as the app): each step ticks off in turn while the real requests run
 * underneath (see `atLeast`); an error closes it straight away.
 */
export function PlacingOrderModal({ open, steps }: { open: boolean; steps: string[] }) {
  const [done, setDone] = useState(0);
  const count = steps.length;

  useEffect(() => {
    if (!open) {
      setDone(0);
      return;
    }
    const timers = Array.from({ length: count }, (_, i) =>
      setTimeout(() => setDone(i + 1), PLACING_STEP_MS * (i + 1)),
    );
    return () => timers.forEach(clearTimeout);
  }, [open, count]);

  if (!open) return null;
  return (
    <div
      role="alertdialog"
      aria-modal="true"
      aria-label="Placing your order"
      className="fixed inset-0 z-[1500] flex items-center justify-center bg-[rgba(8,24,56,0.55)] p-[20px]"
    >
      <div className="w-full max-w-[380px] rounded-[22px] bg-white p-[26px] text-center font-ui shadow-2xl">
        <span className="mx-auto mb-[10px] flex size-[60px] items-center justify-center rounded-full bg-brand text-white">
          <ShoppingBag aria-hidden="true" className="size-[28px]" />
        </span>
        <p className="text-[19px] font-semibold text-heading">Placing your order</p>
        <p className="text-[13px] text-ink-muted">Please don&rsquo;t close this page</p>
        <ul className="mt-[20px] flex flex-col gap-[14px] text-left">
          {steps.map((label, i) => {
            const state = i < done ? 'done' : i === done ? 'active' : 'todo';
            return (
              <li key={label} className="flex items-center gap-[12px]">
                <span
                  className={`flex size-[26px] shrink-0 items-center justify-center rounded-full border-2 ${
                    state === 'done'
                      ? 'border-woo-success bg-woo-success text-white'
                      : 'border-catalog-rule'
                  }`}
                >
                  {state === 'done' ? (
                    <Check aria-hidden="true" className="size-[14px]" strokeWidth={3} />
                  ) : state === 'active' ? (
                    <Loader2 aria-hidden="true" className="size-[15px] animate-spin text-brand" />
                  ) : null}
                </span>
                <span
                  className={`text-[14.5px] font-semibold ${state === 'todo' ? 'text-ink-muted' : 'text-heading'}`}
                >
                  {label}
                </span>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
