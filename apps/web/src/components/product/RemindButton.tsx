'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { AlarmClock, BellRing } from 'lucide-react';
import { loginHref, type BuyReminder, type CartProduct } from '@youmart/shared-client';
import { api } from '@/lib/api';
import { whenLabel } from '@/lib/reminder-time';
import { useSession } from '@/lib/session';
import { RemindDialog } from './RemindDialog';

const LINK =
  'flex w-full items-center justify-center gap-[8px] rounded-full border border-brand/30 bg-white px-[16px] py-[8px] font-ui text-[14px] font-semibold text-brand transition-colors hover:border-brand hover:bg-[#eef3fc] focus:outline-none focus-visible:ring-2 focus-visible:ring-brand';

/** v1.18 "Remind me to buy" under Buy Now: set / change a reminder for this product. */
export function RemindButton({ product }: { product: CartProduct }) {
  const session = useSession();
  const pathname = usePathname();
  const [reminder, setReminder] = useState<BuyReminder | null>(null);
  const [open, setOpen] = useState(false);
  const signedIn = session.status === 'authenticated';

  useEffect(() => {
    if (!signedIn) return;
    let active = true;
    api.reminders
      .forProduct(product.productId)
      .then(({ items }) => {
        if (!active) return;
        const upcoming = items
          .filter((r) => r.status === 'SCHEDULED' && new Date(r.remindAt).getTime() > Date.now())
          .sort((a, b) => a.remindAt.localeCompare(b.remindAt));
        setReminder(upcoming.find((r) => r.skuId === product.skuId) ?? upcoming[0] ?? null);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [signedIn, product.productId, product.skuId]);

  if (!signedIn) {
    return (
      <Link href={loginHref(pathname)} className={LINK}>
        <AlarmClock aria-hidden="true" className="size-[16px]" /> Remind me to buy
      </Link>
    );
  }

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={LINK}>
        {reminder ? (
          <>
            <BellRing aria-hidden="true" className="size-[16px]" />
            Reminder · {whenLabel(new Date(reminder.remindAt))}
          </>
        ) : (
          <>
            <AlarmClock aria-hidden="true" className="size-[16px]" /> Remind me to buy
          </>
        )}
      </button>
      <RemindDialog
        open={open}
        product={{ skuId: product.skuId, title: product.title, imageUrl: product.image, price: product.price }}
        existing={reminder}
        onClose={() => setOpen(false)}
        onSaved={(saved) => {
          setReminder(saved);
          setOpen(false);
        }}
      />
    </>
  );
}
