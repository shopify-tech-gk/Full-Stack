'use client';

import { useId, useState, type FormEvent } from 'react';
import {
  EMPTY_CONTACT_FORM,
  supportErrorMessage,
  validateContactForm,
  type ContactFormValues,
  type FormErrors,
} from '@youmart/shared-client';
import { Notice } from '@/components/account/Notice';
import { FORM_BUTTON, FORM_INPUT } from '@/components/account/formStyles';
import { api } from '@/lib/api';
import { Field } from './Field';

// Not on live (its contact page only lists phone/email/address) - flagged addition.
// POST /api/support/messages (notification-service): stored for the support team, rate-limited.
export function ContactForm() {
  const id = useId();
  const [values, setValues] = useState(EMPTY_CONTACT_FORM);
  const [errors, setErrors] = useState<FormErrors<keyof ContactFormValues>>({});
  const [sent, setSent] = useState<string | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const set = (key: keyof ContactFormValues, value: string) =>
    setValues((current) => ({ ...current, [key]: value }));

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    const { data, errors: found } = validateContactForm(values);
    setErrors(found);
    setFailure(null);
    if (!data) return;
    setPending(true);
    try {
      const receipt = await api.support.sendMessage(data);
      setSent(receipt.reference);
      setValues(EMPTY_CONTACT_FORM);
    } catch (error) {
      setFailure(supportErrorMessage(error));
    } finally {
      setPending(false);
    }
  };

  return (
    <form
      onSubmit={onSubmit}
      noValidate
      aria-labelledby={`${id}-title`}
      className="rounded-[10px] border border-catalog-rule bg-white p-[20px]"
    >
      <h2
        id={`${id}-title`}
        className="mb-[16px] font-ui text-[20px] font-semibold uppercase leading-[1.3] text-heading lg:text-[25px]"
      >
        Send Us a Message
      </h2>
      {sent !== null && (
        <Notice tone="success">
          Thank you! Your message has been received (reference <strong>{sent}</strong>). Our team
          will get back to you soon.
        </Notice>
      )}
      {failure && <Notice tone="error">{failure}</Notice>}
      <div className="grid gap-x-[20px] md:grid-cols-2">
        <Field id={`${id}-name`} label="Name" required error={errors.name}>
          {(aria) => (
            <input
              {...aria}
              autoComplete="name"
              maxLength={200}
              value={values.name}
              onChange={(e) => set('name', e.target.value)}
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
              placeholder="10-digit mobile number"
              value={values.phone}
              onChange={(e) => set('phone', e.target.value)}
              className={FORM_INPUT}
            />
          )}
        </Field>
        <Field
          id={`${id}-email`}
          label="Email address"
          error={errors.email}
          className="md:col-span-2"
        >
          {(aria) => (
            <input
              {...aria}
              type="email"
              autoComplete="email"
              maxLength={254}
              value={values.email}
              onChange={(e) => set('email', e.target.value)}
              className={FORM_INPUT}
            />
          )}
        </Field>
        <Field
          id={`${id}-message`}
          label="Message"
          required
          error={errors.message}
          className="md:col-span-2"
        >
          {(aria) => (
            <textarea
              {...aria}
              rows={5}
              maxLength={2000}
              value={values.message}
              onChange={(e) => set('message', e.target.value)}
              className={`${FORM_INPUT} h-auto min-h-[120px] leading-[1.5] lg:h-auto`}
            />
          )}
        </Field>
      </div>
      <p className="mx-[3px]">
        <button type="submit" disabled={pending} className={FORM_BUTTON}>
          {pending ? 'Sending\u2026' : 'Send message'}
        </button>
      </p>
    </form>
  );
}
