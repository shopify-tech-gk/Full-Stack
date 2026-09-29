'use client';

import { useId, useState, useTransition, type FormEvent } from 'react';
import {
  NOTIFY_CHANNELS,
  type FormErrors,
  type NotifyChannel,
  type OrderNotifyValues,
} from '@youmart/shared-client';
import { subscribeOrderNotify } from '@/app/support-actions';
import { Notice } from '@/components/account/Notice';
import {
  BODY_TEXT,
  FIELD_ERROR,
  FIELD_HINT,
  FORM_BUTTON,
  FORM_INPUT,
  FORM_LABEL,
  FORM_ROW,
} from '@/components/account/formStyles';
import { Field } from './Field';

interface Reminder {
  orderNumber: string;
  channel: NotifyChannel;
}

// DEMO: reminders live in component state. Wiring = notification-service preferences API.
export function OrderNotifyForm() {
  const id = useId();
  const [values, setValues] = useState<OrderNotifyValues>({ orderNumber: '', channel: 'WHATSAPP' });
  const [errors, setErrors] = useState<FormErrors<keyof OrderNotifyValues>>({});
  const [message, setMessage] = useState<string | null>(null);
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [pending, startTransition] = useTransition();

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    startTransition(async () => {
      const result = await subscribeOrderNotify(values);
      setErrors(result.errors ?? {});
      setMessage(result.ok ? null : (result.message ?? null));
      if (result.ok && result.reference) {
        const orderNumber = result.reference;
        const channel = values.channel as NotifyChannel;
        setReminders((list) => [
          ...list.filter((r) => r.orderNumber !== orderNumber),
          { orderNumber, channel },
        ]);
        setValues((current) => ({ ...current, orderNumber: '' }));
      }
    });
  };

  return (
    <>
      <h2 className="mb-[12px] font-ui text-[19.2px] font-semibold text-heading">Your reminders</h2>
      {reminders.length === 0 ? (
        <Notice tone="info">You have no order reminders yet.</Notice>
      ) : (
        <ul className="mb-[2em] divide-y divide-catalog-rule rounded-[10px] border border-catalog-rule bg-white">
          {reminders.map((r) => (
            <li
              key={r.orderNumber}
              className={`${BODY_TEXT} flex justify-between px-[1em] py-[0.6em]`}
            >
              <strong>{r.orderNumber}</strong>
              <span>{NOTIFY_CHANNELS.find((c) => c.value === r.channel)?.label}</span>
            </li>
          ))}
        </ul>
      )}

      <form onSubmit={onSubmit} noValidate>
        {message && <Notice tone="error">{message}</Notice>}
        <Field id={`${id}-order`} label="Order ID" required error={errors.orderNumber}>
          {(aria) => (
            <input
              {...aria}
              maxLength={40}
              placeholder="Enter Order ID"
              value={values.orderNumber}
              onChange={(e) => setValues((v) => ({ ...v, orderNumber: e.target.value }))}
              className={FORM_INPUT}
            />
          )}
        </Field>
        <fieldset className={FORM_ROW}>
          <legend className={FORM_LABEL}>Notify me on</legend>
          <div className="flex gap-[20px]">
            {NOTIFY_CHANNELS.map((channel) => (
              <label
                key={channel.value}
                className="flex items-center gap-[6px] font-ui text-[15px] text-ink-body"
              >
                <input
                  type="radio"
                  name={`${id}-channel`}
                  value={channel.value}
                  checked={values.channel === channel.value}
                  onChange={() => setValues((v) => ({ ...v, channel: channel.value }))}
                  className="size-[16px] accent-brand"
                />
                {channel.label}
              </label>
            ))}
          </div>
          {errors.channel && <span className={FIELD_ERROR}>{errors.channel}</span>}
        </fieldset>
        <p className="m-[3px]">
          <button type="submit" disabled={pending} className={FORM_BUTTON}>
            Notify me
          </button>
        </p>
        <p className={`${FIELD_HINT} mx-[3px] mt-[10px]`}>
          Demo: reminders are kept on this page only.
        </p>
      </form>
    </>
  );
}
