'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { FileText, ShieldCheck, Wallet } from 'lucide-react';
import { TERMS_VERSION } from '@youmart/shared-client';

const KEY = 'ym:terms';
/** Pages a visitor must be able to read before accepting. */
const OPEN_PATHS = ['/terms', '/privacy-policy', '/refund-policy', '/shipping'];
/** Let the opening animation finish before asking. */
const DELAY_MS = 2600;

function accepted(): boolean {
  try {
    const raw = window.localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as { version?: string }).version === TERMS_VERSION : false;
  } catch {
    return false;
  }
}

/**
 * First visit (or new Terms): accept the Terms & Conditions and Privacy Policy before shopping -
 * the website's version of the app's welcome screen. Remembered in this browser.
 */
export function TermsGate() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [checked, setChecked] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const skip = OPEN_PATHS.includes(pathname) || pathname.startsWith('/admin');

  useEffect(() => {
    if (skip || accepted()) {
      setOpen(false);
      return;
    }
    const t = setTimeout(() => setOpen(true), DELAY_MS);
    return () => clearTimeout(t);
  }, [skip]);

  useEffect(() => {
    if (!open) return;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = overflow;
    };
  }, [open]);

  if (!open) return null;

  const accept = () => {
    try {
      window.localStorage.setItem(
        KEY,
        JSON.stringify({ version: TERMS_VERSION, acceptedAt: new Date().toISOString() }),
      );
    } catch {
      // Private mode: accepted for this visit only.
    }
    setOpen(false);
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-end justify-center bg-[#0f172a]/55 p-[16px] backdrop-blur-[3px] md:items-center">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="terms-title"
        className="w-full max-w-[560px] overflow-hidden rounded-[20px] bg-white font-ui shadow-[0_30px_80px_rgba(15,23,42,0.35)]"
      >
        <div className="relative bg-[linear-gradient(135deg,#0142aa,#0d66ad_60%,#1e88e5)] px-[28px] pb-[26px] pt-[28px] text-white">
          <span aria-hidden="true" className="absolute -right-[40px] -top-[50px] size-[170px] rounded-full bg-white/10" />
          <p className="relative text-[13px] font-semibold uppercase tracking-[0.12em] text-white/75">Welcome to YouMart</p>
          <h2 id="terms-title" className="relative mt-[6px] text-[24px] font-semibold leading-[1.25]">
            Before you start shopping
          </h2>
          <p className="relative mt-[6px] text-[14.5px] leading-[1.55] text-white/85">
            Please review and accept how YouMart works and how we look after your data.
          </p>
        </div>
        <div className="px-[28px] py-[22px]">
          <ul className="space-y-[12px] text-[14px] leading-[1.5] text-ink-body">
            <li className="flex gap-[12px]">
              <FileText aria-hidden="true" className="mt-[2px] size-[18px] shrink-0 text-brand" />
              <span>
                <Link href="/terms" target="_blank" className="font-semibold text-brand hover:underline">
                  Terms &amp; Conditions
                </Link>{' '}
                - ordering, delivery, cancellations and returns.
              </span>
            </li>
            <li className="flex gap-[12px]">
              <ShieldCheck aria-hidden="true" className="mt-[2px] size-[18px] shrink-0 text-brand" />
              <span>
                <Link href="/privacy-policy" target="_blank" className="font-semibold text-brand hover:underline">
                  Privacy Policy
                </Link>{' '}
                - we use your details only to deliver and support your orders.
              </span>
            </li>
            <li className="flex gap-[12px]">
              <Wallet aria-hidden="true" className="mt-[2px] size-[18px] shrink-0 text-brand" />
              <span>
                YouMart Wallet - refunds are store credit for shopping on YouMart and can&rsquo;t be
                withdrawn as cash.
              </span>
            </li>
          </ul>
          <label className="mt-[18px] flex cursor-pointer items-start gap-[10px] rounded-[12px] border border-catalog-rule bg-[#fafbfc] px-[14px] py-[12px] text-[14px] text-heading">
            <input
              type="checkbox"
              checked={checked}
              onChange={(e) => {
                setChecked(e.target.checked);
                if (e.target.checked) requestAnimationFrame(() => buttonRef.current?.focus());
              }}
              className="mt-[3px] size-[16px] accent-brand"
            />
            I have read and accept the Terms &amp; Conditions and the Privacy Policy.
          </label>
          <button
            ref={buttonRef}
            type="button"
            disabled={!checked}
            onClick={accept}
            className="mt-[16px] h-[46px] w-full rounded-[12px] bg-brand font-semibold text-white transition-[opacity,box-shadow] hover:shadow-brand-button focus:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Accept &amp; continue
          </button>
        </div>
      </div>
    </div>
  );
}
