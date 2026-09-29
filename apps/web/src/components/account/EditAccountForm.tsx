'use client';

import { useId, useState, type FormEvent } from 'react';
import { toLocalPhone } from '@youmart/shared-client';
import { Notice } from './Notice';
import {
  FIELD_HINT,
  FORM_BUTTON,
  FORM_INPUT,
  FORM_LABEL,
  FORM_REQUIRED,
  FORM_ROW,
} from './formStyles';

interface EditAccountFormProps {
  user: { name: string; email: string; phone: string };
}

// DEMO: WooCommerce "Account details" minus the password section (login is phone OTP).
export function EditAccountForm({ user }: EditAccountFormProps) {
  const id = useId();
  const [name, setName] = useState(user.name);
  const [email, setEmail] = useState(user.email);
  const [status, setStatus] = useState<'idle' | 'saved' | 'invalid'>('idle');

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    const valid = name.trim().length > 0 && (!email || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email));
    setStatus(valid ? 'saved' : 'invalid');
  };

  return (
    <form onSubmit={onSubmit} noValidate>
      {status === 'saved' && <Notice tone="success">Account details changed successfully.</Notice>}
      {status === 'invalid' && (
        <Notice tone="error">Please enter your name and a valid email address.</Notice>
      )}
      <p className={FORM_ROW}>
        <label htmlFor={`${id}-name`} className={FORM_LABEL}>
          Full name <span className={FORM_REQUIRED}>*</span>
        </label>
        <input
          id={`${id}-name`}
          value={name}
          onChange={(e) => setName(e.target.value)}
          autoComplete="name"
          className={FORM_INPUT}
        />
      </p>
      <p className={FORM_ROW}>
        <label htmlFor={`${id}-email`} className={FORM_LABEL}>
          Email address <span className="font-normal">(optional)</span>
        </label>
        <input
          id={`${id}-email`}
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="email"
          className={FORM_INPUT}
        />
      </p>
      <p className={FORM_ROW}>
        <label htmlFor={`${id}-phone`} className={FORM_LABEL}>
          Mobile number
        </label>
        <input
          id={`${id}-phone`}
          value={`+91 ${toLocalPhone(user.phone)}`}
          disabled
          aria-describedby={`${id}-phone-note`}
          className={FORM_INPUT}
        />
        <span id={`${id}-phone-note`} className={FIELD_HINT}>
          Verified by OTP. This is the number you log in with.
        </span>
      </p>
      <p className="mx-[3px]">
        <button type="submit" className={FORM_BUTTON}>
          Save changes
        </button>
      </p>
    </form>
  );
}
