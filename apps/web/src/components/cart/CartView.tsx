'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Heart, ShoppingCart } from 'lucide-react';
import {
  deliveryFee,
  cartTotals,
  defaultCheckoutAddress,
  type CartLine,
} from '@youmart/shared-client';
import { Notice } from '@/components/account/Notice';
import { TEXT_LINK } from '@/components/account/formStyles';
import { useAddresses } from '@/lib/addresses';
import { useCart, type CartNotice } from '@/lib/cart';
import { useProductImages } from '@/lib/product-images';
import { CartLines } from './CartLines';
import { CartTotals } from './CartTotals';

/** The empty cart: a friendly card with ways back into the store. */
export function EmptyCart() {
  return (
    <div className="mx-auto mb-[32px] mt-[12px] max-w-[640px] rounded-[20px] border border-catalog-rule bg-white px-[24px] py-[40px] text-center font-ui shadow-rail-card">
      <span className="mx-auto mb-[16px] flex size-[84px] items-center justify-center rounded-full bg-[#eef3fc]">
        <ShoppingCart aria-hidden="true" className="size-[38px] text-brand" />
      </span>
      <p className="text-[24px] font-semibold text-heading">Your cart is empty</p>
      <p className="mx-auto mt-[6px] max-w-[420px] text-[15px] leading-[1.55] text-ink-muted">
        Looks like you haven&rsquo;t added anything yet. Explore 5 lakh+ products across every category.
      </p>
      <div className="mt-[22px] flex flex-wrap justify-center gap-[10px]">
        <Link
          href="/"
          className="inline-flex h-[44px] items-center gap-[8px] rounded-[12px] bg-brand px-[24px] text-[15px] font-semibold text-white transition-shadow hover:shadow-brand-button focus:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2"
        >
          Start shopping
        </Link>
        <Link
          href="/wishlist"
          className="inline-flex h-[44px] items-center gap-[8px] rounded-[12px] border border-catalog-rule bg-white px-[20px] text-[15px] font-semibold text-heading transition-colors hover:border-brand hover:text-brand"
        >
          <Heart aria-hidden="true" className="size-[16px]" /> My wishlist
        </Link>
      </div>
    </div>
  );
}

function StoreNotice({ notice, onDismiss }: { notice: CartNotice; onDismiss: () => void }) {
  return (
    <Notice tone={notice.tone}>
      {notice.message}
      {notice.details && notice.details.length > 0 && (
        <ul className="mt-[4px] list-disc pl-[18px]">
          {notice.details.map((detail) => (
            <li key={detail}>{detail}</li>
          ))}
        </ul>
      )}{' '}
      <button type="button" onClick={onDismiss} className={TEXT_LINK}>
        Dismiss
      </button>
    </Notice>
  );
}

export function CartView() {
  const { mode, cart, notice, setQuantity, remove, restore, dismissNotice, reload } = useCart();
  const { addresses } = useAddresses();
  const imageFor = useProductImages(cart?.items.map((line) => line.productSlug) ?? []);
  const [removed, setRemoved] = useState<{ line: CartLine; index: number } | null>(null);
  const router = useRouter();

  const storeNotice = notice && (
    <div className="mt-[20px]">
      <StoreNotice notice={notice} onDismiss={dismissNotice} />
    </div>
  );

  if (!cart) {
    // The account cart failed to load: say so and offer a retry (never an empty-looking cart).
    if (mode === 'account' && notice?.tone === 'error') {
      return (
        <div className="mt-[20px]">
          <Notice tone="error">
            {notice.message}{' '}
            <button type="button" onClick={reload} className={TEXT_LINK}>
              Try again
            </button>
          </Notice>
        </div>
      );
    }
    return <div aria-busy="true" aria-label="Loading your cart" className="min-h-[320px]" />;
  }

  // Only a signed-in customer has a saved default address to estimate delivery to (v1.16: the
  // delivery charge depends on it; free from ₹2,000 either way).
  const deliverTo = mode === 'account' && addresses ? defaultCheckoutAddress(addresses) : null;
  const destination = deliverTo ? `${deliverTo.city}, ${deliverTo.state}` : null;
  const fee = deliveryFee(cart.subtotal, deliverTo);

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
        {storeNotice}
        {undo && <div className="mt-[20px]">{undo}</div>}
        <EmptyCart />
      </>
    );
  }

  return (
    <>
      {storeNotice}
      {undo && <div className="mt-[20px]">{undo}</div>}
      <CartLines
        items={cart.items}
        imageFor={(line) => imageFor(line.productSlug)}
        onQuantity={(line, quantity) => {
          setRemoved(null);
          setQuantity(line.cartItemId, quantity);
        }}
        onRemove={onRemove}
        onBuyNow={(line) =>
          // Guest cart lines get new ids when they merge into the account at sign-in, so a guest
          // signs in first and then picks the item again.
          router.push(
            mode === 'account' ? `/checkout?buy=${line.cartItemId}` : '/account?returnTo=/cart',
          )
        }
      />
      <CartTotals
        totals={cartTotals(cart, fee ?? '0.00')}
        destination={destination}
        feeKnown={fee !== null}
      />
    </>
  );
}
