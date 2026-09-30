import Link from 'next/link';
import { formatMoney, shippingLabel, type CartTotals as Totals } from '@youmart/shared-client';
import { TEXT_LINK } from '@/components/account/formStyles';

interface CartTotalsProps {
  totals: Totals;
  /** State from the customer's default address, when known. */
  destination: string | null;
}

const TH =
  'hidden w-[40%] px-[16px] py-[11.2px] text-left align-top font-medium leading-[24px] min-[922px]:table-cell';
const TD =
  'block px-[14.6px] py-[10.2px] text-right leading-[24px] min-[922px]:table-cell min-[922px]:px-[16px] min-[922px]:py-[11.2px] min-[922px]:text-left';
const MOBILE_LABEL = 'float-left font-bold min-[922px]:hidden';

// Live WooCommerce .cart_totals: 1px blue panel, #fbfbfb heading bar, 48% wide on the right from
// 922px; below that WooCommerce's responsive table puts each label inline, left of its value.
// POLISH (W4, flagged): white panel with the cart table's soft blue shadow, tabular amounts, and
// a brand-blue hover lift on the Checkout pill.
export function CartTotals({ totals, destination }: CartTotalsProps) {
  const shipping = shippingLabel(totals.shipping) ?? formatMoney(totals.shipping);
  return (
    <section
      aria-labelledby="cart-totals-title"
      className="mb-[29.2px] rounded-[10px] border border-catalog-rule bg-white px-[20px] font-sans text-[14.6px] tabular-nums text-ink-body shadow-cart-table min-[922px]:ml-auto min-[922px]:w-[48%] lg:mb-[32px] lg:text-[16px]"
    >
      <h2
        id="cart-totals-title"
        className="-mx-[20px] mb-[20px] rounded-t-[10px] border-b border-catalog-rule bg-cart-panelHead px-[17.5px] py-[12.3px] font-ui text-[17.5px] font-bold leading-[1.3] text-heading lg:px-[19.2px] lg:py-[13.44px] lg:text-[19.2px]"
      >
        Cart totals
      </h2>
      <table className="w-full border-separate border-spacing-0 rounded-[10px] border-b border-catalog-rule">
        <tbody>
          <tr>
            <th scope="row" className={TH}>
              Subtotal
            </th>
            <td className={TD}>
              <span className={MOBILE_LABEL}>Subtotal:</span>
              {formatMoney(totals.subtotal)}
            </td>
          </tr>
          <tr>
            <th scope="row" className={`${TH} border-t border-catalog-rule`}>
              Shipping
            </th>
            <td className={`${TD} border-t border-catalog-rule`}>
              <span className={MOBILE_LABEL}>Shipping:</span>
              <span className="block py-[4px]">{shipping}</span>
              {destination && (
                <span className="mb-[25.6px] block font-ui">
                  Delivery to <strong>{destination}</strong>.
                </span>
              )}
            </td>
          </tr>
          <tr>
            <th scope="row" className={`${TH} border-t border-catalog-rule`}>
              Total Amount
            </th>
            <td className={`${TD} border-t border-catalog-rule`}>
              <span className={MOBILE_LABEL}>Total Amount:</span>
              <strong className="text-[18px] font-bold text-black lg:text-[20px]">
                {formatMoney(totals.total)}
              </strong>
            </td>
          </tr>
        </tbody>
      </table>
      <div className="py-[16px]">
        <Link
          href="/checkout"
          className="flex h-[36.8px] w-full items-center justify-center rounded-[30px] border-2 border-white bg-brand px-[36px] font-ui text-[16px] font-bold uppercase text-white transition-[opacity,box-shadow] duration-150 hover:opacity-90 hover:shadow-brand-button focus:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 lg:text-[17.6px]"
        >
          Checkout
        </Link>
        <p className="mt-[12px] text-center font-ui text-[15px]">
          <Link href="/" className={TEXT_LINK}>
            Continue shopping
          </Link>
        </p>
      </div>
    </section>
  );
}
