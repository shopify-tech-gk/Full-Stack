import Link from 'next/link';
import { formatMoney, orderHref, type OrderListItem } from '@youmart/shared-client';
import { TEXT_LINK } from './formStyles';

const dateFormat = new Intl.DateTimeFormat('en-US', {
  month: 'long',
  day: 'numeric',
  year: 'numeric',
  timeZone: 'Asia/Kolkata',
});

export function formatOrderDate(iso: string): string {
  return dateFormat.format(new Date(iso));
}

/** The list endpoint carries the payment status only; fulfilment detail is on the order page. */
const STATUS_LABEL: Record<OrderListItem['status'], string> = {
  PENDING_PAYMENT: 'Pending payment',
  CONFIRMED: 'Confirmed',
  CANCELLED: 'Cancelled',
};

// POLISH (W6, flagged): status as a small coloured pill instead of plain text.
const STATUS_PILL: Record<OrderListItem['status'], string> = {
  PENDING_PAYMENT: 'border-[#f0b429] bg-[#fff8e6] text-[#8a5a00]',
  CONFIRMED: 'border-woo-success bg-[#f3f8e6] text-[#4f6610]',
  CANCELLED: 'border-woo-error bg-[#fdf0f0] text-woo-error',
};

const CELL = 'border-catalog-rule px-[16px] py-[10px] text-left align-middle md:border-t';
// Below 768px each row stacks with its column label, like WooCommerce's responsive shop_table.
const STACK =
  'max-md:flex max-md:justify-between max-md:gap-[12px] max-md:before:font-bold max-md:before:content-[attr(data-title)]';

/** WooCommerce "orders" table (My Account > Orders) in YouMart's blue-rule theme. */
export function OrdersTable({ orders }: { orders: readonly OrderListItem[] }) {
  return (
    <table className="w-full border-collapse border border-catalog-rule font-ui text-[16px] leading-[25.6px] text-ink-body">
      <thead className="max-md:sr-only">
        <tr>
          {['Order', 'Date', 'Status', 'Total', 'Actions'].map((title) => (
            <th key={title} scope="col" className={`${CELL} font-semibold text-heading`}>
              {title}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {orders.map((order) => (
          <tr
            key={order.orderId}
            className="max-md:block max-md:border-t max-md:border-catalog-rule max-md:py-[6px] max-md:first:border-t-0"
          >
            <th scope="row" data-title="Order" className={`${CELL} ${STACK} font-normal`}>
              <Link href={orderHref(order.orderNumber)} className={TEXT_LINK}>
                #{order.orderNumber}
              </Link>
            </th>
            <td data-title="Date" className={`${CELL} ${STACK}`}>
              <time dateTime={order.createdAt}>{formatOrderDate(order.createdAt)}</time>
            </td>
            <td data-title="Status" className={`${CELL} ${STACK}`}>
              <span
                className={`inline-flex rounded-full border px-[10px] text-[13px] font-semibold leading-[22px] ${STATUS_PILL[order.status]}`}
              >
                {STATUS_LABEL[order.status]}
              </span>
            </td>
            <td data-title="Total" className={`${CELL} ${STACK}`}>
              <strong className="font-sans tabular-nums">{formatMoney(order.grandTotal)}</strong>
            </td>
            <td data-title="Actions" className={`${CELL} ${STACK}`}>
              <Link
                href={orderHref(order.orderNumber)}
                aria-label={`View order ${order.orderNumber}`}
                className="inline-flex h-[36px] items-center rounded-[5px] bg-brand px-[16px] font-ui text-[13px] font-semibold uppercase leading-none text-white hover:opacity-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2"
              >
                View
              </Link>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
