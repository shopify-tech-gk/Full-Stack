'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Banknote,
  Bell,
  CheckCircle2,
  Clock,
  CreditCard,
  ImageOff,
  LifeBuoy,
  Loader2,
  MapPin,
  Package,
  RotateCcw,
  Star,
  Truck,
  Wallet,
  XCircle,
} from 'lucide-react';
import {
  ApiError,
  CUSTOMER_CANCELLATION_ENABLED,
  ROUTES,
  addressLines,
  canCancelOrder,
  formatMoney,
  orderStatusLabel,
  shipmentEvents,
  shippingLabel,
  trackingProgress,
  type Money,
  type OrderPaymentSummary,
  type OrderView,
  type ReturnView,
  type SellerItemStatus,
  type ShipmentTracking,
} from '@youmart/shared-client';
import { InvoiceDownload } from '@/components/checkout/InvoiceDownload';
import { api } from '@/lib/api';
import { rememberPendingOrder } from '@/lib/pending-order';
import { useSession } from '@/lib/session';
import { Notice } from './Notice';
import { OrderProgress } from './OrderProgress';
import { RETURN_STATUS } from './ReturnsView';
import {
  BTN_PRIMARY,
  BTN_SECONDARY,
  BTN_SMALL,
  Banner,
  Dialog,
  Panel,
  Pill,
  ReasonPicker,
  dateTime,
  type PillTone,
} from './ui';
import { TEXT_LINK } from './formStyles';

const SHIPPED = new Set(['SHIPPED', 'DELIVERED', 'RETURNED']);
/** Lines that have left the warehouse - can no longer be cancelled. */
const DISPATCHED = new Set(['SHIPPED', 'DELIVERED', 'RETURNED']);

const RETURN_REASONS = [
  'Damaged or defective',
  'Wrong item received',
  'Item not as described',
  'Size or fit issue',
  'No longer needed',
] as const;

const CANCEL_REASONS = [
  'Ordered by mistake',
  'Found a better price',
  'Delivery is taking too long',
  'Want to change the delivery address',
  'Something else',
] as const;

const LINE: Record<SellerItemStatus, { label: string; tone: PillTone }> = {
  PENDING: { label: 'Processing', tone: 'orange' },
  CONFIRMED: { label: 'Processing', tone: 'orange' },
  PACKED: { label: 'Packed', tone: 'blue' },
  SHIPPED: { label: 'Shipped', tone: 'violet' },
  DELIVERED: { label: 'Delivered', tone: 'green' },
  CANCELLED: { label: 'Cancelled', tone: 'red' },
  RETURNED: { label: 'Returned', tone: 'grey' },
};

const HERO_TONE = {
  green: 'from-[#ecfdf3] to-white text-[#15803d]',
  blue: 'from-[#eef4ff] to-white text-[#1d4ed8]',
  violet: 'from-[#f4efff] to-white text-[#6d28d9]',
  orange: 'from-[#fff4ea] to-white text-[#c2410c]',
  red: 'from-[#fdeeee] to-white text-[#b91c1c]',
} as const;
const STEP_TONE = ['orange', 'blue', 'violet', 'green'] as const;
const STEP_TEXT = [
  'We have received your order',
  'Your order is packed and ready to ship',
  'Your order is on the way',
  'Your order has been delivered',
];

type Card = { image: string | null; slug: string };

type State =
  | { kind: 'loading' }
  | { kind: 'missing' }
  | { kind: 'failed' }
  | { kind: 'ready'; order: OrderView; shipments: (ShipmentTracking | null)[] };

type Action =
  | { kind: 'return'; item: OrderView['items'][number] }
  | { kind: 'cancel-item'; item: OrderView['items'][number] }
  | null;

/** One of the signed-in customer's orders (GET /api/orders/:number - 404 unless it's theirs). */
export function OrderDetail({ orderNumber }: { orderNumber: string }) {
  const router = useRouter();
  const session = useSession();
  const [state, setState] = useState<State>({ kind: 'loading' });
  const [attempt, setAttempt] = useState(0);
  const [cards, setCards] = useState<Record<string, Card>>({});
  const [payment, setPayment] = useState<OrderPaymentSummary | null>(null);
  const [returns, setReturns] = useState<ReturnView[]>([]);
  const [action, setAction] = useState<Action>(null);
  const [reason, setReason] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [dialogError, setDialogError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    const order = await api.orders.get(orderNumber);
    // Courier scans exist only once a line has shipped; tracking is supplementary.
    const [shipments, pay, rets] = await Promise.all([
      Promise.all(
        order.items.map((item) =>
          SHIPPED.has(item.sellerStatus)
            ? api.logistics.trackOrderItem(item.orderItemId).catch(() => null)
            : Promise.resolve(null),
        ),
      ),
      api.payments.orderSummary(order.orderId).catch(() => null),
      api.returns.list({ limit: 50 }).catch(() => null),
    ]);
    const lineIds = new Set(order.items.map((i) => i.orderItemId));
    setPayment(pay);
    setReturns((rets?.items ?? []).filter((r) => lineIds.has(r.orderItemId)));
    setState({ kind: 'ready', order, shipments });
    api.catalog
      .productCards([...new Set(order.items.map((item) => item.productId))].slice(0, 50))
      .then(({ items }) =>
        setCards(Object.fromEntries(items.map((c) => [c.id, { image: c.imageUrl, slug: c.slug }]))),
      )
      .catch(() => undefined);
  }, [orderNumber]);

  useEffect(() => {
    let active = true;
    load().catch((error: unknown) => {
      if (!active) return;
      setState(error instanceof ApiError && error.status === 404 ? { kind: 'missing' } : { kind: 'failed' });
    });
    return () => {
      active = false;
    };
  }, [load, attempt]);

  if (state.kind === 'loading') {
    return <div aria-busy="true" aria-label="Loading your order" className="min-h-[320px]" />;
  }
  if (state.kind === 'missing') {
    return (
      <Notice tone="error">
        We couldn&rsquo;t find that order in your account.{' '}
        <Link href={ROUTES.orders} className={TEXT_LINK}>
          See all your orders
        </Link>
      </Notice>
    );
  }
  if (state.kind === 'failed') {
    return (
      <Notice tone="error">
        We could not load this order.{' '}
        <button type="button" onClick={() => setAttempt((n) => n + 1)} className={TEXT_LINK}>
          Try again
        </button>
      </Notice>
    );
  }

  const { order, shipments } = state;
  const events = shipmentEvents(shipments.map((shipment) => ({ shipment })));
  const { step, cancelled } = trackingProgress(order);
  const pending = order.status === 'PENDING_PAYMENT';
  const confirmed = order.status === 'CONFIRMED';
  const cancelRequested = order.cancelRequest?.status === 'REQUESTED';
  const liveLines = order.items.filter((i) => i.sellerStatus !== 'CANCELLED').length;
  const units = order.items.reduce((n, i) => n + i.quantity, 0);
  const tone = cancelled ? 'red' : pending ? 'orange' : (STEP_TONE[step] ?? 'orange');
  const headline = pending ? 'Payment pending' : orderStatusLabel(order);
  const heroSub = cancelled
    ? 'This order has been cancelled'
    : pending
      ? 'Complete the payment to confirm your order'
      : (STEP_TEXT[step] ?? STEP_TEXT[0]);
  const returnFor = (orderItemId: string) =>
    returns.find((r) => r.orderItemId === orderItemId && r.status !== 'REJECTED') ??
    returns.find((r) => r.orderItemId === orderItemId);
  const paidForLine = (i: OrderView['items'][number]) =>
    (Number(i.lineTotal) - Number(i.discount ?? 0)).toFixed(2) as Money;

  const payNow = () => {
    if (session.status !== 'authenticated') return;
    rememberPendingOrder(session.user.id, order.orderId);
    router.push(ROUTES.checkout);
  };

  const openAction = (next: Action) => {
    setAction(next);
    setReason(null);
    setNote('');
    setDialogError(null);
  };

  const submit = async () => {
    if (!action || !reason) {
      setDialogError('Choose a reason first.');
      return;
    }
    setBusy(true);
    setDialogError(null);
    try {
      if (action.kind === 'return') {
        await api.returns.create(action.item.orderItemId, note.trim() ? `${reason} - ${note.trim()}` : reason);
        setNotice('Return requested. We’ll arrange a pickup; the refund goes to your YouMart Wallet.');
      } else {
        const result = await api.orders.cancelItem(order.orderId, action.item.orderItemId, {
          reason,
          ...(note.trim() ? { comment: note.trim() } : {}),
        });
        setNotice(
          result.outcome === 'CANCELLED'
            ? 'Item cancelled. The rest of your order carries on as usual.'
            : 'Cancellation requested for this item. Once approved, what you paid for it is added to your YouMart Wallet.',
        );
      }
      setAction(null);
      await load();
    } catch (error) {
      setDialogError(
        error instanceof ApiError
          ? error.message
          : action.kind === 'return'
            ? 'Could not request the return. Please try again.'
            : 'Could not cancel this item. Please try again.',
      );
    } finally {
      setBusy(false);
    }
  };

  const discount = order.discountTotal && order.discountTotal !== '0.00' ? order.discountTotal : null;
  const cod = order.paymentMethod === 'COD';

  return (
    <article aria-labelledby="order-title" className="font-ui">
      {/* Status hero */}
      <div className={`mb-[20px] overflow-hidden rounded-[16px] border border-catalog-rule bg-gradient-to-r shadow-rail-card ${HERO_TONE[tone]}`}>
        <div className="flex flex-wrap items-center justify-between gap-[16px] px-[22px] py-[18px]">
          <div className="flex items-center gap-[14px]">
            <span className="flex size-[46px] items-center justify-center rounded-full bg-white shadow-rail-card ring-1 ring-black/5">
              {cancelled ? (
                <XCircle aria-hidden="true" className="size-[24px]" />
              ) : pending ? (
                <Clock aria-hidden="true" className="size-[24px]" />
              ) : step >= 3 ? (
                <CheckCircle2 aria-hidden="true" className="size-[24px]" />
              ) : step >= 2 ? (
                <Truck aria-hidden="true" className="size-[24px]" />
              ) : (
                <Package aria-hidden="true" className="size-[24px]" />
              )}
            </span>
            <div>
              <h1 id="order-title" className="text-[22px] font-semibold leading-[1.2]">
                {headline}
              </h1>
              <p className="mt-[2px] text-[14px] text-ink-body">{heroSub}</p>
            </div>
          </div>
          <dl className="flex gap-[28px] text-[13px]">
            <div>
              <dt className="text-ink-muted">Order</dt>
              <dd className="font-semibold text-heading">#{order.orderNumber}</dd>
            </div>
            <div>
              <dt className="text-ink-muted">Placed on</dt>
              <dd className="font-semibold text-heading">{dateTime(order.createdAt)}</dd>
            </div>
            <div>
              <dt className="text-ink-muted">Total</dt>
              <dd className="font-semibold tabular-nums text-heading">{formatMoney(order.grandTotal)}</dd>
            </div>
          </dl>
        </div>
        {pending ? (
          <div className="flex flex-wrap items-center justify-between gap-[12px] border-t border-catalog-rule bg-white px-[22px] py-[12px]">
            <p className="text-[14px] text-ink-body">
              Items are held for you. Unpaid orders are cancelled automatically after 30 minutes.
            </p>
            <button type="button" onClick={payNow} className={BTN_PRIMARY}>
              Complete payment · {formatMoney(order.grandTotal)}
            </button>
          </div>
        ) : null}
      </div>

      {notice ? <Banner tone="success">{notice}</Banner> : null}
      {cancelRequested ? (
        <Banner tone="info">
          Cancellation requested. Once approved, the amount you paid is added to your YouMart Wallet.
        </Banner>
      ) : order.cancelRequest?.status === 'REJECTED' ? (
        <Banner tone="info">
          Your cancellation request couldn&rsquo;t be approved - the order is already being prepared. You
          can request a return after delivery.
        </Banner>
      ) : null}

      <div className="grid items-start gap-[20px] lg:grid-cols-[1fr_320px]">
        <div className="min-w-0">
          <Panel title={`Items (${units})`} padded={false}>
            <ul>
              {order.items.map((item) => {
                const card = cards[item.productId];
                const ret = returnFor(item.orderItemId);
                const line = LINE[item.sellerStatus];
                const lineCancelled = item.sellerStatus === 'CANCELLED';
                const canReturn = item.sellerStatus === 'DELIVERED' && (!ret || ret.status === 'REJECTED');
                const canCancelLine =
                  CUSTOMER_CANCELLATION_ENABLED &&
                  confirmed &&
                  liveLines > 1 &&
                  !cancelRequested &&
                  item.cancelRequest?.status !== 'REQUESTED' &&
                  !lineCancelled &&
                  !DISPATCHED.has(item.sellerStatus);
                const rateSlug = item.sellerStatus === 'DELIVERED' ? card?.slug : undefined;
                const image = (
                  <span className="flex size-[84px] shrink-0 items-center justify-center overflow-hidden rounded-[12px] border border-catalog-rule bg-white">
                    {card?.image ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={card.image} alt="" className="size-full object-contain p-[6px]" />
                    ) : (
                      <ImageOff aria-hidden="true" className="size-[22px] text-[#cbd5e1]" />
                    )}
                  </span>
                );
                return (
                  <li key={item.orderItemId} className="flex gap-[16px] border-b border-catalog-rule px-[20px] py-[16px] last:border-0">
                    {card?.slug ? (
                      <Link href={`/product/${card.slug}`} aria-hidden="true" tabIndex={-1}>
                        {image}
                      </Link>
                    ) : (
                      image
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-start justify-between gap-[10px]">
                        <div className="min-w-0">
                          {card?.slug ? (
                            <Link
                              href={`/product/${card.slug}`}
                              className={`line-clamp-2 text-[15px] font-semibold leading-[1.4] text-heading hover:text-brand ${lineCancelled ? 'line-through opacity-60' : ''}`}
                            >
                              {item.title}
                            </Link>
                          ) : (
                            <p className={`line-clamp-2 text-[15px] font-semibold leading-[1.4] text-heading ${lineCancelled ? 'line-through opacity-60' : ''}`}>
                              {item.title}
                            </p>
                          )}
                          <p className="mt-[3px] text-[13px] text-ink-muted">
                            Qty {item.quantity}
                            {item.quantity > 1 ? ` · ${formatMoney(item.unitPrice)} each` : ''}
                          </p>
                        </div>
                        <p className={`text-[15.5px] font-semibold tabular-nums text-heading ${lineCancelled ? 'line-through opacity-60' : ''}`}>
                          {formatMoney(item.lineTotal)}
                        </p>
                      </div>
                      <div className="mt-[10px] flex flex-wrap items-center gap-[8px]">
                        <Pill tone={line.tone}>{line.label}</Pill>
                        {ret ? <Pill tone={RETURN_STATUS[ret.status].tone}>Return: {RETURN_STATUS[ret.status].label}</Pill> : null}
                        {item.cancelRequest?.status === 'REQUESTED' ? <Pill tone="orange">Cancellation requested</Pill> : null}
                        <span className="flex-1" />
                        {rateSlug ? (
                          <Link href={`/product/${rateSlug}#reviews`} className={BTN_SMALL}>
                            <Star aria-hidden="true" className="size-[14px] text-[#f5a400]" />
                            Rate product
                          </Link>
                        ) : null}
                        {canReturn ? (
                          <button type="button" onClick={() => openAction({ kind: 'return', item })} className={BTN_SMALL}>
                            <RotateCcw aria-hidden="true" className="size-[14px]" />
                            Return item
                          </button>
                        ) : null}
                        {canCancelLine ? (
                          <button type="button" onClick={() => openAction({ kind: 'cancel-item', item })} className={`${BTN_SMALL} hover:!border-woo-error hover:!text-woo-error`}>
                            <XCircle aria-hidden="true" className="size-[14px]" />
                            Cancel item
                          </button>
                        ) : null}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          </Panel>

          <Panel title="Tracking">
            <OrderProgress order={order} timeline={order.timeline} events={events} />
          </Panel>
        </div>

        <aside className="min-w-0">
          <Panel title="Price details">
            <dl className="space-y-[8px] text-[14px]">
              <div className="flex justify-between">
                <dt className="text-ink-muted">Subtotal</dt>
                <dd className="tabular-nums text-heading">{formatMoney(order.subtotal)}</dd>
              </div>
              {discount ? (
                <div className="flex justify-between">
                  <dt className="text-ink-muted">Coupon{order.couponCode ? ` (${order.couponCode})` : ''}</dt>
                  <dd className="tabular-nums text-[#15803d]">−{formatMoney(discount)}</dd>
                </div>
              ) : null}
              <div className="flex justify-between">
                <dt className="text-ink-muted">Delivery</dt>
                <dd className="tabular-nums text-heading">
                  {shippingLabel(order.shippingTotal) ?? formatMoney(order.shippingTotal)}
                </dd>
              </div>
              <div className="flex justify-between border-t border-dashed border-catalog-rule pt-[10px] text-[16px] font-semibold">
                <dt className="text-heading">Total</dt>
                <dd className="tabular-nums text-heading">{formatMoney(order.grandTotal)}</dd>
              </div>
            </dl>
            {payment && !pending ? (
              <div className="mt-[14px] space-y-[8px] rounded-[12px] bg-[#f6f8fb] p-[12px] text-[13.5px]">
                <p className="text-[12px] font-semibold uppercase tracking-[0.05em] text-ink-muted">Paid with</p>
                {payment.walletAmount !== '0.00' ? (
                  <p className="flex items-center justify-between">
                    <span className="flex items-center gap-[8px] text-heading">
                      <Wallet aria-hidden="true" className="size-[15px] text-brand" /> YouMart Wallet
                    </span>
                    <span className="tabular-nums">{formatMoney(payment.walletAmount)}</span>
                  </p>
                ) : null}
                {payment.onlineAmount !== '0.00' ? (
                  <p className="flex items-center justify-between">
                    <span className="flex items-center gap-[8px] text-heading">
                      <CreditCard aria-hidden="true" className="size-[15px] text-brand" /> Online (Razorpay)
                    </span>
                    <span className="tabular-nums">{formatMoney(payment.onlineAmount)}</span>
                  </p>
                ) : null}
                {payment.cod ? (
                  <p className="flex items-center justify-between">
                    <span className="flex items-center gap-[8px] text-heading">
                      <Banknote aria-hidden="true" className="size-[15px] text-woo-success" /> Cash on Delivery
                      {payment.cod.collected ? '' : ' (due)'}
                    </span>
                    <span className="tabular-nums">{formatMoney(payment.cod.amount)}</span>
                  </p>
                ) : null}
                {payment.refunds.length > 0 ? (
                  <div className="border-t border-catalog-rule pt-[8px]">
                    {payment.refunds.map((r) => (
                      <p key={r.refundId} className="flex items-center justify-between text-[#15803d]">
                        <span>
                          Refund {r.method === 'WALLET' ? 'to wallet' : 'to original payment'}
                          {r.status !== 'PROCESSED' ? ` (${r.status.toLowerCase()})` : ''}
                        </span>
                        <span className="tabular-nums">+{formatMoney(r.amount)}</span>
                      </p>
                    ))}
                  </div>
                ) : null}
              </div>
            ) : null}
          </Panel>

          <Panel title="Delivery address">
            <address className="flex gap-[10px] text-[14px] not-italic leading-[1.55] text-ink-body">
              <MapPin aria-hidden="true" className="mt-[3px] size-[16px] shrink-0 text-brand" />
              <span>
                {addressLines(order.shippingAddress).map((l, i) => (
                  <span key={l} className={`block ${i === 0 ? 'font-semibold text-heading' : ''}`}>
                    {l}
                  </span>
                ))}
              </span>
            </address>
          </Panel>

          <Panel title="Need anything?">
            <div className="flex flex-col gap-[8px]">
              {order.status === 'CONFIRMED' ? (
                <div className="rounded-[10px] border border-catalog-rule px-[12px] py-[8px] text-[14px]">
                  <InvoiceDownload orderId={order.orderId} />
                </div>
              ) : null}
              <Link href={`${ROUTES.help}?order=${encodeURIComponent(order.orderNumber)}`} className={`${BTN_SECONDARY} justify-start`}>
                <LifeBuoy aria-hidden="true" className="size-[16px] text-brand" /> Get help with this order
              </Link>
              {order.status !== 'CANCELLED' ? (
                <Link
                  href={`${ROUTES.orderNotifications}?order=${encodeURIComponent(order.orderNumber)}`}
                  className={`${BTN_SECONDARY} justify-start`}
                >
                  <Bell aria-hidden="true" className="size-[16px] text-brand" /> Delivery updates
                </Link>
              ) : null}
              {canCancelOrder(order) && !cancelRequested ? (
                <Link
                  href={`${ROUTES.cancelOrder}?order=${encodeURIComponent(order.orderNumber)}`}
                  className={`${BTN_SECONDARY} justify-start hover:!border-woo-error hover:!text-woo-error`}
                >
                  <XCircle aria-hidden="true" className="size-[16px]" /> Cancel order
                </Link>
              ) : null}
            </div>
          </Panel>
          <Link href={ROUTES.orders} className="text-[14px] font-semibold text-brand hover:underline">
            &larr; All orders
          </Link>
        </aside>
      </div>

      <Dialog
        open={action !== null}
        onClose={() => !busy && setAction(null)}
        width={600}
        title={action?.kind === 'return' ? 'Return this item' : 'Cancel this item'}
        description={
          action
            ? `${action.item.title} · ${formatMoney(paidForLine(action.item))}${
                action.kind === 'return'
                  ? ' - we’ll arrange a pickup and refund it to your YouMart Wallet.'
                  : cod
                    ? ''
                    : ' - once approved, what you paid for it goes to your YouMart Wallet.'
              }`
            : undefined
        }
        footer={
          <>
            <button type="button" onClick={() => setAction(null)} disabled={busy} className={BTN_SECONDARY}>
              Keep it
            </button>
            <button type="button" onClick={() => void submit()} disabled={busy || !reason} className={BTN_PRIMARY}>
              {busy ? <Loader2 aria-hidden="true" className="size-[16px] animate-spin" /> : null}
              {action?.kind === 'return' ? 'Request return' : 'Cancel item'}
            </button>
          </>
        }
      >
        <ReasonPicker
          reasons={action?.kind === 'return' ? RETURN_REASONS : CANCEL_REASONS}
          value={reason}
          onChange={setReason}
          note={note}
          onNote={setNote}
        />
        {dialogError ? <p className="mt-[10px] text-[13.5px] text-woo-error">{dialogError}</p> : null}
      </Dialog>
    </article>
  );
}
