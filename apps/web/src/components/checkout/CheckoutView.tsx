'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ChevronDown } from 'lucide-react';
import {
  CHECKOUT_BLOCKER_MESSAGE,
  DEMO_SHIPPING_TOTAL,
  authUserLabel,
  cartTotals,
  checkoutBlocker,
  defaultCheckoutAddress,
  demoPlaceOrder,
  formatMoney,
  type Address,
  type OrderView,
  type PaymentMethodId,
} from '@youmart/shared-client';
import { LogoutButton } from '@/components/account/LogoutButton';
import { Notice } from '@/components/account/Notice';
import { OtpLoginForm } from '@/components/account/OtpLoginForm';
import { BODY_TEXT, TEXT_LINK } from '@/components/account/formStyles';
import { CheckoutSteps } from '@/components/listing/CheckoutSteps';
import { useCart } from '@/lib/cart';
import { useSession } from '@/lib/session';
import { AddressPicker } from './AddressPicker';
import { OrderPanel, OrderReviewTable } from './OrderReview';
import { OrderReceived } from './OrderReceived';
import { PaymentMethods } from './PaymentMethods';

interface CheckoutViewProps {
  /** DEMO saved addresses until the address API is wired; shown only when signed in. */
  addresses: readonly Address[];
}

/** Live's section heading ("Billing details"): small Outfit semibold over a 1px blue rule. */
const SECTION_TITLE =
  'mb-[25.6px] border-b border-catalog-rule font-ui text-[13.1px] font-semibold leading-[1.3] text-heading lg:text-[14.4px]';

// One page, three blocks in order of need: who you are (OTP), where it goes (saved addresses),
// how you pay (Razorpay) - replacing live's 10-field billing form, account/ship-to toggles
// and order notes, none of which the order API accepts.
export function CheckoutView({ addresses: initial }: CheckoutViewProps) {
  const router = useRouter();
  const session = useSession();
  const loggedIn = session.status === 'authenticated';
  const { cart, clear } = useCart();
  const [addresses, setAddresses] = useState<Address[]>([...initial]);
  const [addressId, setAddressId] = useState(defaultCheckoutAddress(initial)?.id ?? null);
  const [payment, setPayment] = useState<PaymentMethodId>('razorpay');
  const [error, setError] = useState<string | null>(null);
  const [placed, setPlaced] = useState<{ order: OrderView; placedAt: string } | null>(null);

  useEffect(() => {
    if (cart && cart.items.length === 0 && !placed) router.replace('/cart');
  }, [cart, placed, router]);

  if (placed) {
    return <OrderReceived order={placed.order} placedAt={placed.placedAt} />;
  }

  const steps = <CheckoutSteps current="Shop" active={2} centered />;
  if (!cart || cart.items.length === 0 || session.status === 'loading') {
    return (
      <>
        {steps}
        <div aria-busy="true" className="min-h-[480px]" />
      </>
    );
  }

  const totals = cartTotals(cart, DEMO_SHIPPING_TOTAL);

  const placeOrder = () => {
    const blocker = checkoutBlocker({ loggedIn, addressId, cart });
    const address = addresses.find((a) => a.id === addressId);
    if (blocker || !address) {
      setError(CHECKOUT_BLOCKER_MESSAGE[blocker ?? 'address']);
      return;
    }
    setError(null);
    // DEMO. Wiring: order = await api.orders.checkout(address.id); rz = await
    // api.payments.createRazorpayOrder(order.orderId); open Razorpay Checkout with rz; on its
    // success callback refetch api.orders.get(order.orderId) until status is CONFIRMED.
    const now = new Date();
    setPlaced({ order: demoPlaceOrder(cart, address, now), placedAt: now.toISOString() });
    clear();
    window.scrollTo({ top: 0 });
  };

  return (
    <>
      {steps}
      <div className="px-[10px] pb-[32px] font-ui">
        <details className="group mb-[24px] mt-[10px] rounded-[10px] border border-catalog-rule bg-white min-[922px]:hidden">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-[12px] px-[14px] py-[12px] text-[15px] font-semibold text-brand [&::-webkit-details-marker]:hidden">
            <span className="flex items-center gap-[6px]">
              <span className="group-open:hidden">Show order summary</span>
              <span className="hidden group-open:inline">Hide order summary</span>
              <ChevronDown
                aria-hidden="true"
                className="size-[16px] transition-transform group-open:rotate-180"
              />
            </span>
            <strong className="font-sans text-[16px] text-black">
              {formatMoney(totals.total)}
            </strong>
          </summary>
          <div className="border-t border-catalog-rule px-[14px] pb-[10px]">
            <OrderReviewTable items={cart.items} totals={totals} />
          </div>
        </details>

        <div className="min-[922px]:flex min-[922px]:items-start min-[922px]:justify-between min-[922px]:pt-[25.6px]">
          <div className="mb-[29.2px] min-[922px]:mb-[32px] min-[922px]:w-[55%] min-[922px]:pt-[25.6px]">
            <section aria-labelledby="checkout-account" className="mb-[32px]">
              <h2 id="checkout-account" className={SECTION_TITLE}>
                Account
              </h2>
              {session.status === 'authenticated' ? (
                <div className={`${BODY_TEXT} flex flex-wrap items-center gap-x-[6px]`}>
                  Logged in as <strong>{authUserLabel(session.user)}</strong>.
                  <LogoutButton className={TEXT_LINK}>Not you? Log out</LogoutButton>
                </div>
              ) : (
                <>
                  <p className={`${BODY_TEXT} mb-[15px]`}>
                    Log in with your mobile number or email to continue - new customers get an
                    account automatically. Your cart is kept.
                  </p>
                  <OtpLoginForm mode="login" returnTo="/checkout" bare />
                </>
              )}
            </section>

            <section aria-labelledby="checkout-address">
              <h2 id="checkout-address" className={SECTION_TITLE}>
                Delivery address
              </h2>
              {loggedIn ? (
                <AddressPicker
                  addresses={addresses}
                  selectedId={addressId}
                  onSelect={(id) => {
                    setAddressId(id);
                    setError(null);
                  }}
                  onAdded={(address) => {
                    setAddresses((list) => [
                      ...(address.isDefault ? list.map((a) => ({ ...a, isDefault: false })) : list),
                      address,
                    ]);
                    setAddressId(address.id);
                    setError(null);
                  }}
                />
              ) : (
                <p className={`${BODY_TEXT} text-ink-muted`}>
                  Log in to choose a saved address or add a new one.
                </p>
              )}
            </section>
          </div>

          <div className="min-[922px]:w-[40%]">
            <OrderPanel>
              <OrderReviewTable items={cart.items} totals={totals} />
              <PaymentMethods selected={payment} onSelect={setPayment} />
              <p className="mb-[25.6px] text-[14.6px] leading-[1.6] text-ink-body lg:text-[16px]">
                Your personal data will be used to process your order, support your experience
                throughout this website, and for other purposes described in our{' '}
                <Link href="/privacy-policy" className={TEXT_LINK}>
                  privacy policy
                </Link>
                .
              </p>
              {error && <Notice tone="error">{error}</Notice>}
              <button
                type="button"
                onClick={placeOrder}
                className="mb-[10px] flex h-[31.8px] w-full items-center justify-center rounded-[30px] border-2 border-white bg-brand px-[36px] font-sans text-[18px] font-bold uppercase text-white transition-opacity hover:opacity-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 lg:h-[35.8px] lg:text-[22px]"
              >
                Place order
              </button>
            </OrderPanel>
          </div>
        </div>
      </div>
    </>
  );
}
