import Link from 'next/link';
import { formatMoney, orderStatusLabel, type AccountOrder } from '@youmart/shared-client';
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

const CELL = 'border-catalog-rule px-[16px] py-[10px] text-left align-middle md:border-t';
// Below 768px each row stacks with its column label, like WooCommerce's responsive shop_table.
const STACK =
  'max-md:flex max-md:justify-between max-md:gap-[12px] max-md:before:font-bold max-md:before:content-[attr(data-title)]';

/** WooCommerce "orders" table (my-account/orders) in YouMart's blue-rule theme. */
export function OrdersTable({ orders }: { orders: readonly AccountOrder[] }) {
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
        {orders.map((order) => {
          const count = order.items.reduce((sum, item) => sum + item.quantity, 0);
          return (
            <tr
              key={order.orderId}
              className="max-md:block max-md:border-t max-md:border-catalog-rule max-md:py-[6px] max-md:first:border-t-0"
            >
              <th scope="row" data-title="Order" className={`${CELL} ${STACK} font-normal`}>
                <Link href={`/order-track?orderid=${order.orderNumber}`} className={TEXT_LINK}>
                  #{order.orderNumber}
                </Link>
              </th>
              <td data-title="Date" className={`${CELL} ${STACK}`}>
                <time dateTime={order.createdAt}>{formatOrderDate(order.createdAt)}</time>
              </td>
              <td data-title="Status" className={`${CELL} ${STACK}`}>
                {orderStatusLabel(order)}
              </td>
              <td data-title="Total" className={`${CELL} ${STACK}`}>
                <span>
                  <strong className="font-sans">{formatMoney(order.grandTotal)}</strong> for {count}{' '}
                  item{count === 1 ? '' : 's'}
                </span>
              </td>
              <td data-title="Actions" className={`${CELL} ${STACK}`}>
                <Link
                  href={`/order-track?orderid=${order.orderNumber}`}
                  className="inline-flex h-[36px] items-center rounded-[5px] bg-brand px-[16px] font-ui text-[13px] font-semibold uppercase leading-none text-white hover:opacity-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2"
                >
                  View
                </Link>
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
