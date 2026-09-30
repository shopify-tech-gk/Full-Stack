import Link from 'next/link';
import { CheckCircle2 } from 'lucide-react';
import {
  addressLines,
  formatMoney,
  orderOverview,
  shippingLabel,
  type OrderView,
} from '@youmart/shared-client';
import { InvoiceDownload } from './InvoiceDownload';

interface OrderReceivedProps {
  order: OrderView;
  placedAt: string;
}

const CELL = 'border-b border-catalog-rule px-[12px] py-[10px] align-top';

// WooCommerce order-received template in YouMart styling (live hides the steps bar here too).
// Shown only once order-service reports the order CONFIRMED (the payment webhook settled it).
export function OrderReceived({ order, placedAt }: OrderReceivedProps) {
  return (
    <div className="pb-[32px] pt-[25.6px] font-ui text-[14.6px] leading-[25.6px] text-ink-body lg:text-[16px]">
      {/* POLISH (W5, flagged): confirmation as a success card (WooCommerce green rule + tint). */}
      <div
        role="status"
        className="mb-[28px] flex items-start gap-[12px] rounded-[10px] border border-catalog-rule border-t-[3px] border-t-woo-success bg-white px-[18px] py-[16px] shadow-cart-table"
      >
        <CheckCircle2
          aria-hidden="true"
          className="mt-[2px] size-[26px] shrink-0 text-woo-success"
        />
        <div>
          <p className="text-[20px] font-bold leading-[1.3] text-heading lg:text-[24px]">
            Thank you. Your order has been received.
          </p>
          <p className="mt-[4px] text-[14.6px] text-ink-muted lg:text-[15px]">
            Payment confirmed. We&rsquo;ve sent the order details to you and will let you know when
            it ships.
          </p>
        </div>
      </div>

      <ul className="mb-[32px] flex flex-wrap gap-y-[12px]">
        {orderOverview(order, placedAt).map((row) => (
          <li
            key={row.label}
            className="mr-[2em] border-r border-dashed border-catalog-rule pr-[2em] text-[12px] uppercase leading-[1.4] last:border-r-0"
          >
            {row.label}:
            <strong className="block text-[15px] normal-case text-heading lg:text-[16px]">
              {row.value}
            </strong>
          </li>
        ))}
      </ul>

      <h2 className="mb-[12px] text-[19.2px] font-bold text-heading">Invoice</h2>
      <div className="mb-[32px]">
        <InvoiceDownload orderId={order.orderId} />
      </div>

      <h2 className="mb-[12px] text-[19.2px] font-bold text-heading">Order details</h2>
      <table className="mb-[32px] w-full max-w-[800px] border-separate border-spacing-0 rounded-[10px] border border-catalog-rule bg-white font-sans tabular-nums">
        <thead>
          <tr>
            <th scope="col" className={`${CELL} text-left`}>
              Product
            </th>
            <th scope="col" className={`${CELL} text-right`}>
              Total
            </th>
          </tr>
        </thead>
        <tbody>
          {order.items.map((item) => (
            <tr key={item.skuId}>
              <td className={CELL}>
                {item.title} <strong>&times;&nbsp;{item.quantity}</strong>
              </td>
              <td className={`${CELL} text-right`}>{formatMoney(item.lineTotal)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <th scope="row" className={`${CELL} text-left font-medium`}>
              Subtotal
            </th>
            <td className={`${CELL} text-right`}>{formatMoney(order.subtotal)}</td>
          </tr>
          <tr>
            <th scope="row" className={`${CELL} text-left font-medium`}>
              Shipping
            </th>
            <td className={`${CELL} text-right`}>
              {shippingLabel(order.shippingTotal) ?? formatMoney(order.shippingTotal)}
            </td>
          </tr>
          <tr>
            <th scope="row" className="px-[12px] py-[10px] text-left font-medium">
              Total Amount
            </th>
            <td className="px-[12px] py-[10px] text-right">
              <strong className="text-[18px] text-black lg:text-[20px]">
                {formatMoney(order.grandTotal)}
              </strong>
            </td>
          </tr>
        </tfoot>
      </table>

      <h2 className="mb-[12px] text-[19.2px] font-bold text-heading">Shipping address</h2>
      <address className="mb-[32px] max-w-[400px] rounded-[10px] border border-catalog-rule bg-white px-[1em] py-[0.8em] not-italic">
        {addressLines(order.shippingAddress).map((line) => (
          <span key={line} className="block">
            {line}
          </span>
        ))}
      </address>

      <Link
        href="/"
        className="inline-flex h-[39.8px] items-center rounded-[30px] border-2 border-white bg-brand px-[36px] text-[14px] font-bold uppercase text-white transition-opacity hover:opacity-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2"
      >
        Continue shopping
      </Link>
    </div>
  );
}
