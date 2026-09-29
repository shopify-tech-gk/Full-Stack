import Link from 'next/link';
import { formatMoney, shippingLabel, type CartLine, type CartTotals } from '@youmart/shared-client';
import { TEXT_LINK } from '@/components/account/formStyles';

interface OrderReviewTableProps {
  items: readonly CartLine[];
  totals: CartTotals;
}

const HEAD = 'border-b border-catalog-rule py-[11.2px] pr-[16px] font-bold';
const CELL = 'border-b border-catalog-rule py-[10px] pr-[10px] align-top';
const FOOT_TH = 'border-b border-catalog-rule py-[14px] pr-[12px] text-left font-medium';
const FOOT_TD = 'border-b border-catalog-rule py-[14px] pr-[10px] text-right';

// Live review table (Product / Quantity / Subtotal, 1px blue rules). Read-only here: live's
// 20px steppers + "Johnson Travo Brass Angle..." truncation move to the cart page.
export function OrderReviewTable({ items, totals }: OrderReviewTableProps) {
  return (
    <>
      <table className="w-full border-separate border-spacing-0 font-sans text-[14.6px] leading-[25.6px] text-ink-body lg:text-[16px]">
        <thead>
          <tr>
            <th scope="col" className={`${HEAD} text-left`}>
              Product
            </th>
            <th scope="col" className={`${HEAD} w-[64px] text-center`}>
              Qty
            </th>
            <th scope="col" className={`${HEAD} w-[34%] pr-[10px] text-right`}>
              Subtotal
            </th>
          </tr>
        </thead>
        <tbody>
          {items.map((line) => (
            <tr key={line.cartItemId}>
              <th scope="row" className={`${CELL} text-left font-normal`}>
                <span className="line-clamp-2 font-ui text-[13px] font-semibold leading-[1.4] text-cart-ink">
                  {line.title}
                </span>
              </th>
              <td className={`${CELL} text-center`}>&times;&nbsp;{line.quantity}</td>
              <td className={`${CELL} text-right`}>{formatMoney(line.lineTotal)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <th scope="row" colSpan={2} className={FOOT_TH}>
              Subtotal
            </th>
            <td className={FOOT_TD}>{formatMoney(totals.subtotal)}</td>
          </tr>
          <tr>
            <th scope="row" colSpan={2} className={FOOT_TH}>
              Shipping
            </th>
            <td className={FOOT_TD}>
              {shippingLabel(totals.shipping) ?? formatMoney(totals.shipping)}
            </td>
          </tr>
          <tr>
            <th scope="row" colSpan={2} className={FOOT_TH}>
              Total Amount
            </th>
            <td className={FOOT_TD}>
              <strong className="text-[18px] text-black lg:text-[20px]">
                {formatMoney(totals.total)}
              </strong>
            </td>
          </tr>
        </tfoot>
      </table>
      <p className="mt-[10px] text-right font-ui text-[14.6px] lg:text-[15px]">
        <Link href="/cart" className={TEXT_LINK}>
          Edit cart
        </Link>
      </p>
    </>
  );
}

/** Live #order_review_heading + #order_review: 2px blue top frame, 1px blue body frame. */
export function OrderPanel({ children }: { children: React.ReactNode }) {
  return (
    <section aria-labelledby="order-review-title">
      <h2
        id="order-review-title"
        className="rounded-t-[10px] border-2 border-b-0 border-catalog-rule px-[26.3px] pb-[17.5px] pt-[26.3px] font-ui text-[17.5px] font-bold leading-[1.3] text-heading lg:px-[28.8px] lg:pb-[19.2px] lg:pt-[28.8px] lg:text-[19.2px]"
      >
        Your order
      </h2>
      <div className="rounded-b-[10px] border border-t-0 border-catalog-rule px-[20.4px] pb-[8px] lg:px-[22.4px]">
        {children}
      </div>
    </section>
  );
}
