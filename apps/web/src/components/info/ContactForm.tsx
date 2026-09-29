'use client';

import { useId, useState, useTransition, type FormEvent } from 'react';
import {
  EMPTY_CONTACT_FORM,
  type ContactFormValues,
  type FormErrors,
} from '@youmart/shared-client';
import { submitContact } from '@/app/support-actions';
import { Notice } from '@/components/account/Notice';
import { FIELD_HINT, FORM_BUTTON, FORM_INPUT } from '@/components/account/formStyles';
import { Field } from './Field';

// Not on live (its contact page only lists phone/email/address) - flagged addition.
export function ContactForm() {
  const id = useId();
  const [values, setValues] = useState(EMPTY_CONTACT_FORM);
  const [errors, setErrors] = useState<FormErrors<keyof ContactFormValues>>({});
  const [sent, setSent] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const set = (key: keyof ContactFormValues, value: string) =>
    setValues((current) => ({ ...current, [key]: value }));

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    startTransition(async () => {
      const result = await submitContact(values);
      setErrors(result.errors ?? {});
      if (result.ok) {
        setSent(result.reference ?? '');
        setValues(EMPTY_CONTACT_FORM);
      }
    });
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
          Thank you! Your message has been received (reference {sent}). Our team will get back to
          you soon.
        </Notice>
      )}
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
      <p className="mx-[3px] flex flex-wrap items-center gap-[16px]">
        <button type="submit" disabled={pending} className={FORM_BUTTON}>
          {pending ? 'Sending…' : 'Send message'}
        </button>
        {/* DEMO hint - remove when the support endpoint exists. */}
        <span className={`${FIELD_HINT} mt-0`}>Demo: messages are not sent anywhere yet.</span>
      </p>
    </form>
  );
}
