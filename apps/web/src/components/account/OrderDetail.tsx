'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ApiError,
  ROUTES,
  addressLines,
  canCancelOrder,
  formatMoney,
  orderStatusLabel,
  shipmentEvents,
  shippingLabel,
  type OrderView,
  type ShipmentTracking,
} from '@youmart/shared-client';
import { InvoiceDownload } from '@/components/checkout/InvoiceDownload';
import { api } from '@/lib/api';
import { rememberPendingOrder } from '@/lib/pending-order';
import { useSession } from '@/lib/session';
import { Notice } from './Notice';
import { OrderProgress } from './OrderProgress';
import { formatOrderDate } from './OrdersTable';
import { BODY_TEXT, FORM_BUTTON, TEXT_LINK } from './formStyles';

const HEADING = 'mb-[12px] font-ui text-[20px] font-semibold leading-[26px] text-heading';
const CELL = 'border-b border-catalog-rule px-[16px] py-[10px]';
const SHIPPED = new Set(['SHIPPED', 'DELIVERED', 'RETURNED']);

type State =
  | { kind: 'loading' }
  | { kind: 'missing' }
  | { kind: 'failed' }
  | { kind: 'ready'; order: OrderView; shipments: (ShipmentTracking | null)[] };

/** One of the signed-in customer's orders (GET /api/orders/:number - 404 unless it's theirs). */
export function OrderDetail({ orderNumber }: { orderNumber: string }) {
  const router = useRouter();
  const session = useSession();
  const [state, setState] = useState<State>({ kind: 'loading' });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const order = await api.orders.get(orderNumber);
        // Courier scans exist only once a line has shipped; tracking is supplementary.
        const shipments = await Promise.all(
          order.items.map((item) =>
            SHIPPED.has(item.sellerStatus)
              ? api.logistics.trackOrderItem(item.orderItemId).catch(() => null)
              : Promise.resolve(null),
          ),
        );
        if (active) setState({ kind: 'ready', order, shipments });
      } catch (error) {
        if (!active) return;
        setState(
          error instanceof ApiError && error.status === 404
            ? { kind: 'missing' }
            : { kind: 'failed' },
        );
      }
    })();
    return () => {
      active = false;
    };
  }, [orderNumber, attempt]);

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
  const payNow = () => {
    if (session.status !== 'authenticated') return;
    rememberPendingOrder(session.user.id, order.orderId);
    router.push(ROUTES.checkout);
  };

  return (
    <article aria-labelledby="order-title">
      <h1 id="order-title" className="sr-only">
        Order {order.orderNumber}
      </h1>
      <p className={`${BODY_TEXT} mb-[24px]`}>
        Order <mark className="bg-transparent font-bold text-brand">#{order.orderNumber}</mark> was
        placed on{' '}
        <mark className="bg-transparent font-bold text-brand">
          {formatOrderDate(order.createdAt)}
        </mark>{' '}
        and is currently{' '}
        <mark className="bg-transparent font-bold text-brand">{orderStatusLabel(order)}</mark>.
      </p>

      {order.status === 'PENDING_PAYMENT' && (
        <div className="mb-[24px]">
          <Notice tone="info">
            This order is waiting for payment. Its items are held for you.
          </Notice>
          <button type="button" onClick={payNow} className={FORM_BUTTON}>
            Complete payment &middot; {formatMoney(order.grandTotal)}
          </button>
        </div>
      )}

      <OrderProgress order={order} timeline={order.timeline} events={events} />

      <h2 className={HEADING}>Order details</h2>
      <table
        className={`${BODY_TEXT} mb-[32px] w-full border-collapse border border-catalog-rule tabular-nums`}
      >
        <thead>
          <tr>
            <th scope="col" className={`${CELL} text-left font-semibold text-heading`}>
              Product
            </th>
            <th scope="col" className={`${CELL} text-right font-semibold text-heading`}>
              Total
            </th>
          </tr>
        </thead>
        <tbody>
          {order.items.map((item) => (
            <tr key={item.orderItemId}>
              <td className={CELL}>
                {item.title}{' '}
                <strong className="whitespace-nowrap font-sans">
                  &times;&nbsp;{item.quantity}
                </strong>
              </td>
              <td className={`${CELL} text-right font-sans`}>{formatMoney(item.lineTotal)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          {[
            ['Subtotal:', formatMoney(order.subtotal)],
            ['Shipping:', shippingLabel(order.shippingTotal) ?? formatMoney(order.shippingTotal)],
            ['Total:', formatMoney(order.grandTotal)],
          ].map(([label, value], index, rows) => (
            <tr key={label}>
              <th scope="row" className={`${CELL} text-left font-semibold text-heading`}>
                {label}
              </th>
              <td
                className={`${CELL} text-right font-sans ${index === rows.length - 1 ? 'font-bold' : ''}`}
              >
                {value}
              </td>
            </tr>
          ))}
        </tfoot>
      </table>

      {order.status === 'CONFIRMED' && (
        <>
          <h2 className={HEADING}>Invoice</h2>
          <div className="mb-[32px]">
            <InvoiceDownload orderId={order.orderId} />
          </div>
        </>
      )}

      <h2 className={HEADING}>Shipping address</h2>
      <address className={`${BODY_TEXT} mb-[32px] not-italic`}>
        {addressLines(order.shippingAddress).map((line) => (
          <span key={line} className="block">
            {line}
          </span>
        ))}
      </address>

      <p className={`${BODY_TEXT} flex flex-wrap gap-x-[20px] gap-y-[8px]`}>
        <Link href={ROUTES.orders} className={TEXT_LINK}>
          &larr; All orders
        </Link>
        {order.status !== 'CANCELLED' && (
          <Link
            href={`${ROUTES.orderNotifications}?order=${encodeURIComponent(order.orderNumber)}`}
            className={TEXT_LINK}
          >
            Delivery updates
          </Link>
        )}
        {canCancelOrder(order) && (
          <Link
            href={`${ROUTES.cancelOrder}?order=${encodeURIComponent(order.orderNumber)}`}
            className="text-woo-error hover:underline focus:outline-none focus-visible:underline"
          >
            Cancel order
          </Link>
        )}
      </p>
    </article>
  );
}
