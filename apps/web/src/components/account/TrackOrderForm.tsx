'use client';

import { useId, useState, type FormEvent } from 'react';
import {
  ApiError,
  ORDER_NUMBER_PATTERN,
  toE164Phone,
  type GuestTrackingView,
} from '@youmart/shared-client';
import { Notice } from '@/components/account/Notice';
import { TrackingResult } from '@/components/account/TrackingResult';
import {
  BODY_TEXT,
  FIELD_ERROR,
  FORM_BUTTON,
  FORM_INPUT,
  FORM_LABEL,
  FORM_ROW,
} from '@/components/account/formStyles';
import { api } from '@/lib/api';

type Errors = Partial<Record<'orderNumber' | 'phone', string>>;

// Guest tracking (POST /api/orders/track): the order number AND the mobile number on the order must
// both match, so the form can't be used to look up other people's orders. Called from the browser
// so the gateway's per-IP limit applies to the customer, not to our web server.
export function TrackOrderForm({ initialOrderNumber }: { initialOrderNumber: string }) {
  const id = useId();
  const [orderNumber, setOrderNumber] = useState(initialOrderNumber);
  const [phone, setPhone] = useState('');
  const [errors, setErrors] = useState<Errors>({});
  const [pending, setPending] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const [result, setResult] = useState<GuestTrackingView | null>(null);

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    const number = orderNumber.trim().toUpperCase();
    const e164 = toE164Phone(phone);
    const next: Errors = {};
    if (!ORDER_NUMBER_PATTERN.test(number)) next.orderNumber = 'Please enter your Order ID.';
    if (!e164) next.phone = 'Please enter the 10-digit mobile number used for the order.';
    setErrors(next);
    setFailure(null);
    if (Object.keys(next).length > 0 || !e164) return;
    setPending(true);
    try {
      setResult(await api.orders.track(number, e164));
    } catch (error) {
      setResult(null);
      setFailure(
        error instanceof ApiError && error.status === 429
          ? 'Too many tracking attempts. Please try again in a few minutes.'
          : error instanceof ApiError && error.status === 404
            ? 'No order matches that Order ID and mobile number. Please check both and try again.'
            : 'We could not reach YouMart. Please check your connection and try again.',
      );
    } finally {
      setPending(false);
    }
  };

  const field = (key: keyof Errors) => ({
    'aria-invalid': Boolean(errors[key]),
    'aria-describedby': errors[key] ? `${id}-${key}-error` : undefined,
  });

  return (
    <>
      <form
        onSubmit={(event) => void onSubmit(event)}
        noValidate
        className="mx-auto my-[20px] max-w-[500px]"
      >
        <p className={`${BODY_TEXT} mb-[25.6px]`}>
          Enter your Order ID and the mobile number you used at checkout, then click Track.
        </p>
        <p className={FORM_ROW}>
          <label htmlFor={`${id}-orderNumber`} className={FORM_LABEL}>
            Order ID
          </label>
          <input
            id={`${id}-orderNumber`}
            maxLength={40}
            autoComplete="off"
            value={orderNumber}
            onChange={(e) => setOrderNumber(e.target.value)}
            placeholder="e.g. YM-MUO212NA-4EAB"
            className={FORM_INPUT}
            {...field('orderNumber')}
          />
          {errors.orderNumber && (
            <span id={`${id}-orderNumber-error`} className={FIELD_ERROR}>
              {errors.orderNumber}
            </span>
          )}
        </p>
        <p className={FORM_ROW}>
          <label htmlFor={`${id}-phone`} className={FORM_LABEL}>
            Mobile number
          </label>
          <input
            id={`${id}-phone`}
            type="tel"
            inputMode="tel"
            autoComplete="tel-national"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="Mobile number used for the order"
            className={FORM_INPUT}
            {...field('phone')}
          />
          {errors.phone && (
            <span id={`${id}-phone-error`} className={FIELD_ERROR}>
              {errors.phone}
            </span>
          )}
        </p>
        <p className="m-[3px]">
          <button type="submit" disabled={pending} className={FORM_BUTTON}>
            {pending ? 'Tracking\u2026' : 'Track Order'}
          </button>
        </p>
      </form>

      {failure && (
        <div className="mx-auto max-w-[500px]">
          <Notice tone="error">{failure}</Notice>
        </div>
      )}
      {result && (
        <div className="mx-auto max-w-[800px]">
          <TrackingResult result={result} />
        </div>
      )}
    </>
  );
}
