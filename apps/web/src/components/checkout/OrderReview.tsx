import Link from 'next/link';
import { Minus, Plus, Trash2 } from 'lucide-react';
import { formatMoney, shippingLabel, type CartTotals, type Money } from '@youmart/shared-client';
import { TEXT_LINK } from '@/components/account/formStyles';

export interface ReviewRow {
  key: string;
  title: string;
  quantity: number;
  lineTotal: Money;
}

interface OrderReviewTableProps {
  rows: readonly ReviewRow[];
  totals: CartTotals;
  /** The cart can still change before the order is placed; the placed order can't. */
  editable: boolean;
  /** v1.13: the coupon taken off (shown between shipping and the total). */
  discount?: { code: string | null; amount: Money } | null;
  /** Change a line's quantity right here (0 removes it). Only while `editable`. */
  onQuantity?: (key: string, quantity: number) => void;
}

const HEAD = 'border-b border-catalog-rule py-[11.2px] pr-[16px] font-bold';
const CELL = 'border-b border-catalog-rule py-[10px] pr-[10px] align-top';
const FOOT_TH = 'border-b border-catalog-rule py-[14px] pr-[12px] text-left font-medium';
const FOOT_TD = 'border-b border-catalog-rule py-[14px] pr-[10px] text-right';

// Live review table (Product / Quantity / Subtotal, 1px blue rules). Before the order is placed
// each line gets a − qty + stepper (at 1 the minus becomes a bin), like the big stores.
export function OrderReviewTable({
  rows,
  totals,
  editable,
  discount,
  onQuantity,
}: OrderReviewTableProps) {
  const steppers = editable && !!onQuantity;
  return (
    <>
      <table className="w-full border-separate border-spacing-0 font-sans text-[14.6px] leading-[25.6px] tabular-nums text-ink-body lg:text-[16px]">
        <thead>
          <tr>
            <th scope="col" className={`${HEAD} text-left`}>
              Product
            </th>
            <th
              scope="col"
              className={`${HEAD} ${steppers ? 'w-[118px]' : 'w-[64px]'} text-center`}
            >
              Qty
            </th>
            <th scope="col" className={`${HEAD} w-[34%] pr-[10px] text-right`}>
              Subtotal
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((line) => (
            <tr key={line.key}>
              <th scope="row" className={`${CELL} text-left font-normal`}>
                <span className="line-clamp-2 font-ui text-[13px] font-semibold leading-[1.4] text-cart-ink">
                  {line.title}
                </span>
              </th>
              <td className={`${CELL} text-center`}>
                {steppers ? (
                  <span className="inline-flex items-center rounded-[8px] border border-catalog-rule bg-white">
                    <button
                      type="button"
                      onClick={() => onQuantity(line.key, line.quantity - 1)}
                      aria-label={line.quantity <= 1 ? `Remove ${line.title}` : 'Decrease quantity'}
                      className={`flex size-[30px] items-center justify-center rounded-l-[8px] hover:bg-cart-headBg ${
                        line.quantity <= 1 ? 'text-woo-error' : 'text-brand'
                      }`}
                    >
                      {line.quantity <= 1 ? (
                        <Trash2 aria-hidden="true" className="size-[14px]" />
                      ) : (
                        <Minus aria-hidden="true" className="size-[14px]" />
                      )}
                    </button>
                    <span className="min-w-[28px] text-center font-ui text-[14px] font-semibold text-heading">
                      {line.quantity}
                    </span>
                    <button
                      type="button"
                      onClick={() => onQuantity(line.key, line.quantity + 1)}
                      aria-label="Increase quantity"
                      className="flex size-[30px] items-center justify-center rounded-r-[8px] text-brand hover:bg-cart-headBg"
                    >
                      <Plus aria-hidden="true" className="size-[14px]" />
                    </button>
                  </span>
                ) : (
                  <>&times;&nbsp;{line.quantity}</>
                )}
              </td>
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
          {discount && discount.amount !== '0.00' ? (
            <tr>
              <th scope="row" colSpan={2} className={FOOT_TH}>
                Coupon{discount.code ? ` (${discount.code})` : ''}
              </th>
              <td className={`${FOOT_TD} font-semibold text-woo-success`}>
                &minus;{formatMoney(discount.amount)}
              </td>
            </tr>
          ) : null}
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
      {editable && (
        <p className="mt-[10px] text-right font-ui text-[14.6px] lg:text-[15px]">
          <Link href="/cart" className={TEXT_LINK}>
            Edit cart
          </Link>
        </p>
      )}
    </>
  );
}

/** Live #order_review_heading + #order_review: 2px blue top frame, 1px blue body frame. */
// POLISH (W5, flagged): white panel with the cart table's soft blue shadow.
export function OrderPanel({ children }: { children: React.ReactNode }) {
  return (
    <section
      aria-labelledby="order-review-title"
      className="rounded-[10px] bg-white shadow-cart-table"
    >
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
