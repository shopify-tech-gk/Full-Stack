'use client';

import { useEffect, useState } from 'react';
import { ChevronDown, Loader2, Tag, X } from 'lucide-react';
import {
  ApiError,
  formatMoney,
  type AvailableCoupon,
  type CouponQuote,
  type Money,
} from '@youmart/shared-client';
import { api } from '@/lib/api';
import { atLeast } from './PlacingOrderModal';

/**
 * Checkout coupon box (v1.13): type a code or pick one of the running offers - the ones that fit
 * this cart first with what they save; the rest say what's missing. The server validates the code
 * against the cart and the customer's past uses, and again when the order is placed.
 */
export function CouponBox({
  subtotal,
  cartItemIds,
  applied,
  onChange,
  disabled,
}: {
  subtotal: Money;
  cartItemIds?: readonly string[];
  applied: CouponQuote | null;
  onChange: (quote: CouponQuote | null) => void;
  disabled?: boolean;
}) {
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [offers, setOffers] = useState<AvailableCoupon[] | null>(null);

  useEffect(() => {
    if (!open) return;
    api.orders
      .coupons(subtotal)
      .then((r) => setOffers(r.items))
      .catch(() => setOffers([]));
  }, [open, subtotal]);

  const apply = async (value: string) => {
    const c = value.trim();
    if (!c) return;
    setBusy(c);
    setError(null);
    try {
      // A short "checking" beat so applying reads as a real check, not an instant swap.
      onChange(await atLeast(api.orders.quoteCoupon(c, cartItemIds), 900));
      setCode('');
      setOpen(false);
    } catch (failure) {
      setError(failure instanceof ApiError ? failure.message : 'Could not apply the coupon.');
    } finally {
      setBusy(null);
    }
  };

  if (applied) {
    return (
      <div className="mb-[16px] flex items-center gap-[10px] rounded-[10px] border border-woo-success bg-[#eefaf2] px-[14px] py-[10px] font-ui">
        <Tag aria-hidden="true" className="size-[18px] text-woo-success" />
        <div className="min-w-0 flex-1">
          <p className="text-[14.5px] font-semibold text-heading">{applied.coupon.code} applied</p>
          <p className="text-[13px] text-woo-success">You save {formatMoney(applied.discount)}</p>
        </div>
        <button
          type="button"
          onClick={() => onChange(null)}
          disabled={disabled}
          aria-label="Remove coupon"
          className="flex size-[30px] items-center justify-center rounded-full text-ink-muted hover:bg-white hover:text-woo-error"
        >
          <X aria-hidden="true" className="size-[16px]" />
        </button>
      </div>
    );
  }

  return (
    <div className="mb-[16px] rounded-[10px] border border-catalog-rule bg-white p-[12px] font-ui">
      <label
        htmlFor="coupon-code"
        className="mb-[6px] block text-[14px] font-semibold text-heading"
      >
        Have a coupon?
      </label>
      <div className="flex gap-[8px]">
        <input
          id="coupon-code"
          value={code}
          onChange={(e) => {
            setCode(e.target.value.toUpperCase());
            setError(null);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              void apply(code);
            }
          }}
          placeholder="Enter coupon code"
          disabled={disabled}
          className="h-[38px] min-w-0 flex-1 rounded-[8px] border border-catalog-rule px-[10px] text-[14px] uppercase tracking-[0.06em] focus:border-brand focus:outline-none"
        />
        <button
          type="button"
          onClick={() => void apply(code)}
          disabled={disabled || !code.trim() || busy !== null}
          className="h-[38px] rounded-[8px] bg-brand px-[16px] text-[14px] font-semibold text-white disabled:opacity-50"
        >
          {busy === code.trim() && code.trim() ? (
            <Loader2 aria-hidden="true" className="size-[16px] animate-spin" />
          ) : (
            'Apply'
          )}
        </button>
      </div>
      {error && <p className="mt-[6px] text-[13px] text-woo-error">{error}</p>}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="mt-[8px] flex items-center gap-[4px] text-[13.5px] font-semibold text-brand"
      >
        View available offers
        <ChevronDown
          aria-hidden="true"
          className={`size-[15px] transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>
      {open && (
        <ul className="mt-[8px] flex flex-col gap-[8px]">
          {!offers ? (
            <li className="text-[13px] text-ink-muted">Loading offers&hellip;</li>
          ) : offers.length === 0 ? (
            <li className="text-[13px] text-ink-muted">No offers right now.</li>
          ) : (
            offers.map((o) => (
              <li
                key={o.code}
                className={`rounded-[8px] border border-dashed p-[10px] ${
                  o.applicable ? 'border-brand' : 'border-catalog-rule opacity-75'
                }`}
              >
                <div className="flex items-center justify-between gap-[8px]">
                  <span className="rounded-[5px] bg-cart-headBg px-[8px] py-[2px] text-[12.5px] font-bold tracking-[0.06em] text-brand">
                    {o.code}
                  </span>
                  {o.applicable && (
                    <button
                      type="button"
                      onClick={() => void apply(o.code)}
                      disabled={disabled || busy !== null}
                      className="text-[13px] font-bold text-brand hover:underline"
                    >
                      {busy === o.code ? 'Applying…' : 'APPLY'}
                    </button>
                  )}
                </div>
                <p className="mt-[4px] text-[14px] font-semibold text-heading">{o.title}</p>
                {o.applicable ? (
                  <p className="text-[12.5px] font-semibold text-woo-success">
                    You save {formatMoney(o.discount)}
                  </p>
                ) : (
                  o.reason && <p className="text-[12.5px] text-[#c47f00]">{o.reason}</p>
                )}
                {o.description && <p className="text-[12.5px] text-ink-muted">{o.description}</p>}
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}
