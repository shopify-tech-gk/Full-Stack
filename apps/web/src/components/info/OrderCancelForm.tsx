'use client';

import { useId, useState, useTransition, type FormEvent } from 'react';
import {
  CANCEL_REASONS,
  EMPTY_ORDER_CANCEL,
  type FormErrors,
  type OrderCancelValues,
} from '@youmart/shared-client';
import { requestOrderCancel } from '@/app/support-actions';
import { Notice } from '@/components/account/Notice';
import { FIELD_HINT, FORM_BUTTON, FORM_INPUT } from '@/components/account/formStyles';
import { Field } from './Field';

export function OrderCancelForm() {
  const id = useId();
  const [values, setValues] = useState(EMPTY_ORDER_CANCEL);
  const [errors, setErrors] = useState<FormErrors<keyof OrderCancelValues>>({});
  const [reference, setReference] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const set = (key: keyof OrderCancelValues, value: string) =>
    setValues((current) => ({ ...current, [key]: value }));

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    startTransition(async () => {
      const result = await requestOrderCancel(values);
      setErrors(result.errors ?? {});
      if (result.ok) {
        setReference(result.reference ?? '');
        setValues(EMPTY_ORDER_CANCEL);
      }
    });
  };

  return (
    <form onSubmit={onSubmit} noValidate>
      {reference !== null && (
        <Notice tone="success">
          Your cancellation request has been received (reference {reference}). We will confirm by
          WhatsApp or SMS once it is processed.
        </Notice>
      )}
      <Field id={`${id}-order`} label="Order ID" required error={errors.orderNumber}>
        {(aria) => (
          <input
            {...aria}
            maxLength={40}
            placeholder="Enter Order ID"
            value={values.orderNumber}
            onChange={(e) => set('orderNumber', e.target.value)}
            className={FORM_INPUT}
          />
        )}
      </Field>
      <Field id={`${id}-phone`} label="Mobile number" required error={errors.phone}>
        {(aria) => (
          <input
            {...aria}
            type="tel"
            inputMode="tel"
            autoComplete="tel-national"
            placeholder="Mobile number used for the order"
            value={values.phone}
            onChange={(e) => set('phone', e.target.value)}
            className={FORM_INPUT}
          />
        )}
      </Field>
      <Field id={`${id}-reason`} label="Reason for cancellation" required error={errors.reason}>
        {(aria) => (
          <select
            {...aria}
            value={values.reason}
            onChange={(e) => set('reason', e.target.value)}
            className={FORM_INPUT}
          >
            <option value="">Select a reason&hellip;</option>
            {CANCEL_REASONS.map((reason) => (
              <option key={reason} value={reason}>
                {reason}
              </option>
            ))}
          </select>
        )}
      </Field>
      <Field id={`${id}-comments`} label="Comments" error={errors.comments}>
        {(aria) => (
          <textarea
            {...aria}
            rows={3}
            maxLength={1000}
            value={values.comments}
            onChange={(e) => set('comments', e.target.value)}
            className={`${FORM_INPUT} h-auto min-h-[90px] leading-[1.5] lg:h-auto`}
          />
        )}
      </Field>
      <p className="m-[3px]">
        <button type="submit" disabled={pending} className={FORM_BUTTON}>
          {pending ? 'Sending…' : 'Request cancellation'}
        </button>
      </p>
      {/* DEMO hint - remove when a customer cancel endpoint exists. */}
      <p className={`${FIELD_HINT} mx-[3px] mt-[10px]`}>
        Demo: requests are not sent anywhere yet.
      </p>
    </form>
  );
}
