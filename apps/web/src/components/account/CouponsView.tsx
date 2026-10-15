'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Check, Copy } from 'lucide-react';
import type { AvailableCoupon } from '@youmart/shared-client';
import { api } from '@/lib/api';
import { useSession } from '@/lib/session';
import { Notice } from './Notice';
import { BODY_TEXT, TEXT_LINK } from './formStyles';

const until = (iso: string | null) =>
  iso
    ? `Valid till ${new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}`
    : null;

/** Coupons / My offers: every public coupon running now, with a copy button for the code. */
export function CouponsView() {
  const session = useSession();
  const [items, setItems] = useState<AvailableCoupon[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  useEffect(() => {
    if (session.status === 'loading') return;
    api.orders
      .coupons()
      .then((r) => setItems(r.items))
      .catch(() => setFailed(true));
  }, [session.status]);

  if (failed) return <Notice tone="error">We could not load the offers. Please try again.</Notice>;
  if (!items) return <div aria-busy="true" className="min-h-[240px]" />;
  if (items.length === 0) {
    return <p className={BODY_TEXT}>No offers right now - check back soon.</p>;
  }

  return (
    <>
      <p className="mb-[14px] font-ui text-[14px] text-ink-muted">
        Use a code at checkout under &ldquo;Have a coupon?&rdquo; - the best one for your cart shows
        first there.
      </p>
      <ul className="grid gap-[12px] md:grid-cols-2">
        {items.map((c) => (
          <li
            key={c.code}
            className="flex overflow-hidden rounded-[12px] border border-catalog-rule bg-white font-ui"
          >
            <div className="flex w-[84px] shrink-0 flex-col items-center justify-center bg-brand py-[14px] text-white">
              <span className="text-[20px] font-bold leading-none">
                {c.discountType === 'PERCENT'
                  ? `${Number(c.discountValue)}%`
                  : `₹${Number(c.discountValue)}`}
              </span>
              <span className="mt-[2px] text-[11px] font-semibold tracking-[0.1em] text-[#cfe3ff]">
                OFF
              </span>
            </div>
            <div className="min-w-0 flex-1 p-[12px]">
              <p className="text-[15px] font-semibold text-heading">{c.title}</p>
              {c.description && <p className="text-[13px] text-ink-body">{c.description}</p>}
              <div className="mt-[8px] flex flex-wrap items-center gap-[10px]">
                <button
                  type="button"
                  onClick={() => {
                    void navigator.clipboard?.writeText(c.code).then(() => {
                      setCopied(c.code);
                      setTimeout(() => setCopied(null), 1500);
                    });
                  }}
                  className="inline-flex items-center gap-[6px] rounded-[6px] border-[1.5px] border-dashed border-brand px-[10px] py-[2px] text-[13.5px] font-bold tracking-[0.08em] text-brand hover:bg-cart-headBg"
                  aria-label={`Copy code ${c.code}`}
                >
                  {c.code}
                  {copied === c.code ? (
                    <Check aria-hidden="true" className="size-[14px] text-woo-success" />
                  ) : (
                    <Copy aria-hidden="true" className="size-[13px]" />
                  )}
                </button>
                {until(c.endsAt) && (
                  <span className="text-[12px] text-ink-muted">{until(c.endsAt)}</span>
                )}
              </div>
            </div>
          </li>
        ))}
      </ul>
      <p className="mt-[16px]">
        <Link href="/" className={TEXT_LINK}>
          Start shopping
        </Link>
      </p>
    </>
  );
}
