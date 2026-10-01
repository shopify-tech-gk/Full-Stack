'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { CheckCircle2, Info, X, XCircle } from 'lucide-react';
import { dismissCartToast, useCartToast } from '@/lib/cart-toast';

const TONES = {
  success: {
    border: 'border-t-woo-success',
    icon: (
      <CheckCircle2 aria-hidden="true" className="mt-[3px] size-[16px] shrink-0 text-woo-success" />
    ),
  },
  info: {
    border: 'border-t-brand',
    icon: <Info aria-hidden="true" className="mt-[3px] size-[16px] shrink-0 text-brand" />,
  },
  error: {
    border: 'border-t-woo-error',
    icon: <XCircle aria-hidden="true" className="mt-[3px] size-[16px] shrink-0 text-woo-error" />,
  },
} as const;

// POLISH (flagged): a floating WooCommerce-style notice (same #f7f6f7 / 3px top border / icon as
// the in-page notices), because cards, the product page and sign-in have no room for an inline
// cart message. Sits above the mobile bottom nav; never moves page content.
export function CartToast() {
  const toast = useCartToast();
  const pathname = usePathname() ?? '';
  if (!toast) return null;
  const { border, icon } = TONES[toast.tone];
  const action = toast.action ?? { href: '/cart', label: 'View cart' };
  const onTarget = pathname.startsWith(action.href);

  return (
    <div
      key={toast.id}
      role={toast.tone === 'error' ? 'alert' : 'status'}
      className={`fixed inset-x-[12px] bottom-[calc(88px+env(safe-area-inset-bottom))] z-50 mx-auto flex max-w-[420px] animate-toast-in items-start gap-[10px] rounded-[10px] border-t-[3px] bg-woo-noticeBg px-[16px] py-[12px] font-ui text-[15px] leading-[1.5] text-woo-noticeText shadow-menu motion-reduce:animate-none lg:inset-x-auto lg:bottom-[24px] lg:right-[24px] ${border}`}
    >
      {icon}
      <div className="min-w-0 flex-1">
        <p>
          {toast.message}
          {toast.tone !== 'error' && !onTarget && (
            <>
              {' '}
              <Link
                href={action.href}
                onClick={dismissCartToast}
                className="font-semibold text-brand hover:text-woo-linkHover focus:outline-none focus-visible:underline"
              >
                {action.label}
              </Link>
            </>
          )}
        </p>
        {toast.details && toast.details.length > 0 && (
          <ul className="mt-[4px] list-disc pl-[18px] text-[14px]">
            {toast.details.map((detail) => (
              <li key={detail}>{detail}</li>
            ))}
          </ul>
        )}
      </div>
      <button
        type="button"
        onClick={dismissCartToast}
        aria-label="Dismiss"
        className="-mr-[4px] rounded-[4px] p-[2px] text-woo-noticeText hover:text-heading focus:outline-none focus-visible:ring-2 focus-visible:ring-brand"
      >
        <X aria-hidden="true" className="size-[16px]" />
      </button>
    </div>
  );
}
