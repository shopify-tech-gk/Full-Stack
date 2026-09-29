'use client';

import { CreditCard } from 'lucide-react';
import { PAYMENT_METHODS, type PaymentMethodId } from '@youmart/shared-client';
import { FIELD_HINT } from '@/components/account/formStyles';

interface PaymentMethodsProps {
  selected: PaymentMethodId;
  onSelect: (id: PaymentMethodId) => void;
}

// Live #payment list: 28px indent, 16/22 semibold labels, and the selected method's grey box
// (#efefef, 1px #01589e, radius 10) with an arrow pointing up at its label.
export function PaymentMethods({ selected, onSelect }: PaymentMethodsProps) {
  return (
    <fieldset className="mb-[16px] mt-[24px]">
      <legend className="sr-only">Payment method</legend>
      <ul>
        {PAYMENT_METHODS.map((method) => {
          const checked = method.id === selected;
          return (
            <li key={method.id} className="relative mb-[20px] pl-[28px] font-sans leading-[32px]">
              <input
                id={`payment-${method.id}`}
                type="radio"
                name="payment-method"
                value={method.id}
                checked={checked}
                onChange={() => onSelect(method.id)}
                aria-describedby={`payment-${method.id}-box`}
                className="absolute left-0 top-[1px] size-[20px] accent-brand"
              />
              <label
                htmlFor={`payment-${method.id}`}
                className="block cursor-pointer text-[14.6px] font-semibold leading-[22px] text-ink-body lg:text-[16px]"
              >
                {method.label}
                <span className="mt-[6px] flex items-center gap-[8px] font-ui text-[12px] font-medium leading-none text-cart-ink">
                  <CreditCard aria-hidden="true" className="size-[18px] text-brand" />
                  Pay by Razorpay
                </span>
              </label>
              {checked && (
                <div
                  id={`payment-${method.id}-box`}
                  className="relative my-[14.72px] rounded-[10px] border border-catalog-qtyBorder bg-cart-payBox p-[13.4px] text-[13.4px] leading-[1.5] text-woo-noticeText before:absolute before:-top-[14.72px] before:left-[16px] before:border-[7.36px] before:border-transparent before:border-b-catalog-qtyBorder before:content-[''] lg:p-[14.72px] lg:text-[14.72px]"
                >
                  {method.description}
                  {/* DEMO note - remove when Razorpay Checkout is wired. */}
                  <span className={FIELD_HINT}>Demo mode: no payment is taken.</span>
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </fieldset>
  );
}
