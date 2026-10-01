'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Check, ChevronDown, Loader2, Lock } from 'lucide-react';
import {
  ApiError,
  CART_SHIPPING_TOTAL,
  CHECKOUT_BLOCKER_MESSAGE,
  PAYMENT_POLL,
  addressLines,
  authUserLabel,
  cartTotals,
  checkoutBlocker,
  colors,
  defaultCheckoutAddress,
  formatMoney,
  paymentErrorMessage,
  placeOrderErrorMessage,
  pollOrderStatus,
  razorpayCheckoutOptions,
  type CartTotals,
  type OrderView,
  type PaymentMethodId,
} from '@youmart/shared-client';
import { LogoutButton } from '@/components/account/LogoutButton';
import { Notice } from '@/components/account/Notice';
import { OtpLoginForm } from '@/components/account/OtpLoginForm';
import { BODY_TEXT, TEXT_LINK } from '@/components/account/formStyles';
import { CheckoutSteps } from '@/components/listing/CheckoutSteps';
import { useAddresses } from '@/lib/addresses';
import { api } from '@/lib/api';
import { useCart } from '@/lib/cart';
import { openRazorpayCheckout } from '@/lib/razorpay';
import { forgetPendingOrder, pendingOrderId, rememberPendingOrder } from '@/lib/pending-order';
import { useSession } from '@/lib/session';
import { AddressPicker } from './AddressPicker';
import { OrderPanel, OrderReviewTable, type ReviewRow } from './OrderReview';
import { OrderReceived } from './OrderReceived';
import { PaymentMethods } from './PaymentMethods';

type Phase =
  | { step: 'review' }
  | { step: 'placing' }
  /** Placed (PENDING_PAYMENT, stock held); waiting for the customer to pay or retry. */
  | { step: 'pay'; order: OrderView }
  | { step: 'paying'; order: OrderView }
  /** Razorpay reported success; polling until the webhook confirms the order. */
  | { step: 'confirming'; order: OrderView }
  | { step: 'slow'; order: OrderView }
  | { step: 'done'; order: OrderView; placedAt: string };

type Message = { tone: 'info' | 'error'; text: string };

/** Live's section heading ("Billing details"): small Outfit semibold over a 1px blue rule. */
const SECTION_TITLE =
  'mb-[25.6px] flex items-center gap-[10px] border-b border-catalog-rule pb-[8px] font-ui text-[13.1px] font-semibold leading-[1.3] text-heading lg:text-[14.4px]';

// POLISH (W5, flagged): numbered steps that turn into a green check once complete.
function SectionTitle({
  id,
  index,
  done,
  children,
}: {
  id: string;
  index: number;
  done: boolean;
  children: React.ReactNode;
}) {
  return (
    <h2 id={id} className={SECTION_TITLE}>
      <span
        aria-hidden="true"
        className={`flex size-[22px] shrink-0 items-center justify-center rounded-full text-[12px] font-bold text-white ${
          done ? 'bg-woo-success' : 'bg-brand'
        }`}
      >
        {done ? <Check className="size-[14px]" strokeWidth={3} /> : index}
      </span>
      {children}
      {done && <span className="sr-only"> (done)</span>}
    </h2>
  );
}

const PILL =
  'mb-[10px] flex h-[40px] w-full items-center justify-center gap-[8px] rounded-[30px] border-2 border-white bg-brand px-[36px] font-sans text-[17px] font-bold uppercase text-white transition-[opacity,box-shadow] duration-150 hover:opacity-90 hover:shadow-brand-button focus:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 disabled:cursor-wait disabled:opacity-70 disabled:shadow-none lg:h-[44px] lg:text-[20px]';

function Busy({ children }: { children: React.ReactNode }) {
  return (
    <p
      role="status"
      className="mb-[16px] flex items-start gap-[10px] rounded-[10px] border border-catalog-rule bg-cart-headBg px-[14px] py-[12px] font-ui text-[15px] leading-[1.5] text-heading"
    >
      <Loader2
        aria-hidden="true"
        className="mt-[3px] size-[16px] shrink-0 animate-spin text-brand"
      />
      <span>{children}</span>
    </p>
  );
}

// One page, three blocks in order of need: who you are (OTP), where it goes (saved addresses),
// how you pay (Razorpay). The money path and its rules live in shared-client checkout.ts.
export function CheckoutView() {
  const router = useRouter();
  const session = useSession();
  const loggedIn = session.status === 'authenticated';
  const userId = session.user?.id ?? null;
  const { cart, reload: reloadCart } = useCart();
  const { addresses, reload: reloadAddresses } = useAddresses();
  const [chosenId, setChosenId] = useState<string | null>(null);
  const [payment, setPayment] = useState<PaymentMethodId>('razorpay');
  const [phase, setPhase] = useState<Phase>({ step: 'review' });
  const [message, setMessage] = useState<Message | null>(null);
  // Until we know whether this customer has an unpaid order from before a reload.
  const [resumeChecked, setResumeChecked] = useState(false);
  const polling = useRef<AbortController | null>(null);

  const addressId =
    chosenId && addresses?.some((a) => a.id === chosenId)
      ? chosenId
      : (defaultCheckoutAddress(addresses ?? [])?.id ?? null);

  useEffect(() => () => polling.current?.abort(), []);

  const finish = (order: OrderView) => {
    forgetPendingOrder();
    reloadCart();
    setMessage(null);
    setPhase({ step: 'done', order, placedAt: new Date().toISOString() });
    window.scrollTo({ top: 0 });
  };

  // The webhook is the source of truth: after Razorpay's success callback we only watch the order.
  const confirm = async (order: OrderView) => {
    polling.current?.abort();
    const controller = new AbortController();
    polling.current = controller;
    setMessage(null);
    setPhase({ step: 'confirming', order });
    let outcome;
    try {
      outcome = await pollOrderStatus(() => api.orders.get(order.orderId), {
        ...PAYMENT_POLL,
        signal: controller.signal,
      });
    } catch {
      outcome = { kind: 'cancelled' as const, order };
    }
    if (outcome.kind === 'aborted') return;
    if (outcome.kind === 'confirmed') {
      finish(outcome.order);
    } else if (outcome.kind === 'cancelled') {
      forgetPendingOrder();
      setPhase({ step: 'review' });
      setMessage({ tone: 'error', text: `Order ${order.orderNumber} was cancelled.` });
    } else {
      setPhase({ step: 'slow', order });
    }
  };

  const pay = async (order: OrderView) => {
    setMessage(null);
    setPhase({ step: 'paying', order });
    let result;
    try {
      const razorpayOrder = await api.payments.createRazorpayOrder(order.orderId);
      const prefill = {
        name: session.user?.name ?? order.shippingAddress.fullName,
        email: session.user?.email ?? undefined,
        contact: session.user?.phone ?? order.shippingAddress.phone,
      };
      result = await openRazorpayCheckout(
        razorpayCheckoutOptions(razorpayOrder, order, prefill, colors.brand.DEFAULT),
      );
    } catch (error) {
      // 409 = no longer payable: most likely already paid (e.g. in another tab) - check.
      if (error instanceof ApiError && error.status === 409) {
        await confirm(order);
        return;
      }
      setPhase({ step: 'pay', order });
      setMessage({
        tone: 'error',
        text:
          error instanceof ApiError
            ? paymentErrorMessage(error)
            : 'Razorpay could not be opened. Please check your connection and try again.',
      });
      return;
    }
    if (result.kind === 'paid') {
      await confirm(order);
      return;
    }
    setPhase({ step: 'pay', order });
    setMessage(
      result.lastError
        ? {
            tone: 'error',
            text: `Payment failed: ${result.lastError.replace(/\.?\s*$/, '.')} Your order is saved - you can try again.`,
          }
        : {
            tone: 'info',
            text: 'Payment was not completed. Your order is saved and its items are held for you.',
          },
    );
  };

  const placeOrder = async () => {
    if (!cart) return;
    const blocker = checkoutBlocker({ loggedIn, addressId, cart });
    if (blocker || !addressId || !userId) {
      setMessage({ tone: 'error', text: CHECKOUT_BLOCKER_MESSAGE[blocker ?? 'address'] });
      return;
    }
    setMessage(null);
    setPhase({ step: 'placing' });
    let order: OrderView;
    try {
      order = await api.orders.checkout(addressId);
    } catch (error) {
      setPhase({ step: 'review' });
      setMessage({ tone: 'error', text: placeOrderErrorMessage(error) });
      reloadCart();
      return;
    }
    rememberPendingOrder(userId, order.orderId);
    // The order consumed the server cart; the header count follows.
    reloadCart();
    await pay(order);
  };

  // Resume an unpaid (or just-confirmed) order after a reload.
  useEffect(() => {
    if (session.status === 'loading') return;
    if (!userId) {
      setResumeChecked(true);
      return;
    }
    const orderId = pendingOrderId(userId);
    if (!orderId) {
      setResumeChecked(true);
      return;
    }
    let active = true;
    api.orders
      .get(orderId)
      .then((order) => {
        if (!active) return;
        if (order.status === 'PENDING_PAYMENT') {
          setPhase({ step: 'pay', order });
          setMessage({
            tone: 'info',
            text: `Order ${order.orderNumber} is waiting for payment.`,
          });
        } else if (order.status === 'CONFIRMED') {
          finish(order);
        } else {
          forgetPendingOrder();
        }
      })
      .catch(() => forgetPendingOrder())
      .finally(() => active && setResumeChecked(true));
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once per signed-in customer
  }, [session.status, userId]);

  const order = 'order' in phase ? phase.order : null;
  const cartEmpty = !cart || cart.items.length === 0;

  useEffect(() => {
    if (resumeChecked && !order && cart && cart.items.length === 0) router.replace('/cart');
  }, [resumeChecked, order, cart, router]);

  if (phase.step === 'done') {
    return <OrderReceived order={phase.order} placedAt={phase.placedAt} />;
  }

  const steps = <CheckoutSteps current="Shop" active={2} centered />;
  if (!resumeChecked || session.status === 'loading' || (!order && cartEmpty)) {
    return (
      <>
        {steps}
        <div aria-busy="true" aria-label="Loading checkout" className="min-h-[480px]" />
      </>
    );
  }

  // Before placing: the cart (a preview). After: the server's re-priced order (what is charged).
  const rows: ReviewRow[] = order
    ? order.items.map((item) => ({
        key: item.skuId,
        title: item.title,
        quantity: item.quantity,
        lineTotal: item.lineTotal,
      }))
    : (cart?.items ?? []).map((line) => ({
        key: line.cartItemId,
        title: line.title,
        quantity: line.quantity,
        lineTotal: line.lineTotal,
      }));
  const totals: CartTotals = order
    ? { subtotal: order.subtotal, shipping: order.shippingTotal, total: order.grandTotal }
    : cartTotals(cart!, CART_SHIPPING_TOTAL);

  const busy = phase.step === 'placing' || phase.step === 'paying' || phase.step === 'confirming';
  const notice = message && <Notice tone={message.tone}>{message.text}</Notice>;

  let action: React.ReactNode;
  if (phase.step === 'confirming') {
    action = <Busy>Confirming your payment with Razorpay&hellip; Please keep this page open.</Busy>;
  } else if (phase.step === 'slow') {
    action = (
      <>
        <Notice tone="info">
          Your payment is still being confirmed - this can take a minute. We&rsquo;ll show your
          receipt as soon as it lands; you won&rsquo;t be charged twice.
        </Notice>
        <button type="button" onClick={() => void confirm(phase.order)} className={PILL}>
          Check payment status
        </button>
      </>
    );
  } else if (order) {
    action = (
      <>
        <button
          type="button"
          onClick={() => void pay(order)}
          disabled={phase.step === 'paying'}
          aria-busy={phase.step === 'paying' || undefined}
          className={PILL}
        >
          {phase.step === 'paying' ? (
            <>
              <Loader2 aria-hidden="true" className="size-[18px] animate-spin" />
              Opening Razorpay&hellip;
            </>
          ) : (
            <>
              <Lock aria-hidden="true" className="size-[16px]" />
              Pay {formatMoney(order.grandTotal)}
            </>
          )}
        </button>
        <p className="mb-[12px] text-center font-ui text-[13px] text-ink-muted">
          Order <strong className="text-heading">{order.orderNumber}</strong> &middot; items held
          for you
        </p>
      </>
    );
  } else {
    action = (
      <button
        type="button"
        onClick={() => void placeOrder()}
        disabled={phase.step === 'placing'}
        aria-busy={phase.step === 'placing' || undefined}
        className={PILL}
      >
        {phase.step === 'placing' ? (
          <>
            <Loader2 aria-hidden="true" className="size-[18px] animate-spin" />
            Placing order&hellip;
          </>
        ) : (
          'Place order'
        )}
      </button>
    );
  }

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
            <strong className="font-sans text-[16px] tabular-nums text-black">
              {formatMoney(totals.total)}
            </strong>
          </summary>
          <div className="border-t border-catalog-rule px-[14px] pb-[10px]">
            <OrderReviewTable rows={rows} totals={totals} editable={!order} />
          </div>
        </details>

        <div className="min-[922px]:flex min-[922px]:items-start min-[922px]:justify-between min-[922px]:pt-[25.6px]">
          <div className="mb-[29.2px] min-[922px]:mb-[32px] min-[922px]:w-[55%] min-[922px]:pt-[25.6px]">
            <section aria-labelledby="checkout-account" className="mb-[32px]">
              <SectionTitle id="checkout-account" index={1} done={loggedIn}>
                Account
              </SectionTitle>
              {session.status === 'authenticated' ? (
                <div className={`${BODY_TEXT} flex flex-wrap items-center gap-x-[6px]`}>
                  Logged in as <strong>{authUserLabel(session.user)}</strong>.
                  {!order && <LogoutButton className={TEXT_LINK}>Not you? Log out</LogoutButton>}
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
              <SectionTitle id="checkout-address" index={2} done={Boolean(order)}>
                Delivery address
              </SectionTitle>
              {order ? (
                // The order carries its own address snapshot; it can't change after placing.
                <address
                  className={`${BODY_TEXT} rounded-[10px] border border-brand bg-cart-rowHover px-[14px] py-[12px] not-italic`}
                >
                  {addressLines(order.shippingAddress).map((line) => (
                    <span key={line} className="block">
                      {line}
                    </span>
                  ))}
                </address>
              ) : loggedIn && addresses ? (
                <AddressPicker
                  addresses={addresses}
                  selectedId={addressId}
                  onSelect={(id) => {
                    setChosenId(id);
                    setMessage(null);
                  }}
                  onAdded={async (address) => {
                    await reloadAddresses();
                    setChosenId(address.id);
                    setMessage(null);
                  }}
                />
              ) : loggedIn ? (
                <div
                  aria-busy="true"
                  aria-label="Loading your addresses"
                  className="min-h-[120px]"
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
              <OrderReviewTable rows={rows} totals={totals} editable={!order} />
              <PaymentMethods selected={payment} onSelect={setPayment} disabled={busy} />
              <p className="mb-[25.6px] text-[14.6px] leading-[1.6] text-ink-body lg:text-[16px]">
                Your personal data will be used to process your order, support your experience
                throughout this website, and for other purposes described in our{' '}
                <Link href="/privacy-policy" className={TEXT_LINK}>
                  privacy policy
                </Link>
                .
              </p>
              {notice}
              {action}
            </OrderPanel>
          </div>
        </div>
      </div>
    </>
  );
}
