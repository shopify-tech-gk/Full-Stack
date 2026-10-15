'use client';

import { Banknote, CreditCard, ShieldCheck } from 'lucide-react';
import {
  COD_MAX_AMOUNT,
  PAYMENT_METHODS,
  formatMoney,
  type PaymentMethodId,
} from '@youmart/shared-client';

interface PaymentMethodsProps {
  selected: PaymentMethodId;
  onSelect: (id: PaymentMethodId) => void;
  disabled?: boolean;
  /** Cash on Delivery offered for this order (total within the COD limit). */
  codAllowed?: boolean;
}

// Live #payment list: 28px indent, 16/22 semibold labels, and the selected method's grey box
// (#efefef, 1px #01589e, radius 10) with an arrow pointing up at its label.
export function PaymentMethods({
  selected,
  onSelect,
  disabled,
  codAllowed = true,
}: PaymentMethodsProps) {
  return (
    <fieldset className="mb-[16px] mt-[24px]" disabled={disabled}>
      <legend className="sr-only">Payment method</legend>
      <ul>
        {PAYMENT_METHODS.map((method) => {
          const checked = method.id === selected;
          const cod = method.id === 'cod';
          const unavailable = cod && !codAllowed;
          return (
            <li key={method.id} className="relative mb-[20px] pl-[28px] font-sans leading-[32px]">
              <input
                id={`payment-${method.id}`}
                type="radio"
                name="payment-method"
                value={method.id}
                checked={checked}
                onChange={() => onSelect(method.id)}
                disabled={unavailable}
                aria-describedby={`payment-${method.id}-box`}
                className="absolute left-0 top-[1px] size-[20px] accent-brand"
              />
              <label
                htmlFor={`payment-${method.id}`}
                className={`block text-[14.6px] font-semibold leading-[22px] text-ink-body lg:text-[16px] ${
                  unavailable ? 'cursor-not-allowed opacity-55' : 'cursor-pointer'
                }`}
              >
                {method.label}
                <span className="mt-[6px] flex items-center gap-[8px] font-ui text-[12px] font-medium leading-none text-cart-ink">
                  {cod ? (
                    <>
                      <Banknote aria-hidden="true" className="size-[18px] text-woo-success" />
                      {unavailable
                        ? `Available for orders up to ${formatMoney(COD_MAX_AMOUNT)}`
                        : 'Pay when it arrives'}
                    </>
                  ) : (
                    <>
                      <CreditCard aria-hidden="true" className="size-[18px] text-brand" />
                      Pay by Razorpay
                    </>
                  )}
                </span>
              </label>
              {checked && (
                <div
                  id={`payment-${method.id}-box`}
                  className="relative my-[14.72px] rounded-[10px] border border-catalog-qtyBorder bg-cart-payBox p-[13.4px] text-[13.4px] leading-[1.5] text-woo-noticeText before:absolute before:-top-[14.72px] before:left-[16px] before:border-[7.36px] before:border-transparent before:border-b-catalog-qtyBorder before:content-[''] lg:p-[14.72px] lg:text-[14.72px]"
                >
                  {method.description}
                  {/* POLISH (W5, flagged): reassurance line under the Razorpay description. */}
                  {!cod && (
                    <span className="mt-[8px] flex items-center gap-[6px] font-ui text-[12.5px] font-medium text-cart-ink">
                      <ShieldCheck aria-hidden="true" className="size-[15px] text-woo-success" />
                      100% secure payments. YouMart never sees your card or UPI details.
                    </span>
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </fieldset>
  );
}
