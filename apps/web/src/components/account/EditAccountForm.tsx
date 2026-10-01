'use client';

import { useId, useState, type FormEvent } from 'react';
import { formatPhone, supportErrorMessage, type AuthUser } from '@youmart/shared-client';
import { updateProfileName, useSession } from '@/lib/session';
import { Notice } from './Notice';
import {
  FIELD_ERROR,
  FIELD_HINT,
  FORM_BUTTON,
  FORM_INPUT,
  FORM_LABEL,
  FORM_REQUIRED,
  FORM_ROW,
} from './formStyles';

export function EditAccountForm() {
  const session = useSession();
  return session.status === 'authenticated' ? <AccountDetailsForm user={session.user} /> : null;
}

// WooCommerce "Account details" minus the password section (login is passwordless OTP). The name
// saves through PATCH /api/auth/me; email and mobile are the OTP-verified login identities, so
// changing them needs a fresh OTP (not offered yet).
function AccountDetailsForm({ user }: { user: AuthUser }) {
  const id = useId();
  const [name, setName] = useState(user.name ?? '');
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);
  const [pending, setPending] = useState(false);

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    const trimmed = name.trim();
    setStatus(null);
    if (trimmed.length === 0 || trimmed.length > 100) {
      setError('Please enter your name (up to 100 characters).');
      return;
    }
    setError(null);
    setPending(true);
    try {
      const saved = await updateProfileName(trimmed);
      setName(saved.name ?? '');
      setStatus({ tone: 'success', text: 'Account details changed successfully.' });
    } catch (failure) {
      setStatus({ tone: 'error', text: supportErrorMessage(failure) });
    } finally {
      setPending(false);
    }
  };

  return (
    <form onSubmit={onSubmit} noValidate>
      {status && <Notice tone={status.tone}>{status.text}</Notice>}
      <p className={FORM_ROW}>
        <label htmlFor={`${id}-name`} className={FORM_LABEL}>
          Full name <span className={FORM_REQUIRED}>*</span>
        </label>
        <input
          id={`${id}-name`}
          value={name}
          onChange={(e) => setName(e.target.value)}
          autoComplete="name"
          maxLength={100}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? `${id}-name-error` : undefined}
          className={FORM_INPUT}
        />
        {error && (
          <span id={`${id}-name-error`} className={FIELD_ERROR}>
            {error}
          </span>
        )}
      </p>
      <p className={FORM_ROW}>
        <label htmlFor={`${id}-email`} className={FORM_LABEL}>
          Email address
        </label>
        <input
          id={`${id}-email`}
          type="email"
          value={user.email ?? 'Not added'}
          disabled
          aria-describedby={`${id}-email-note`}
          className={FORM_INPUT}
        />
        <span id={`${id}-email-note`} className={FIELD_HINT}>
          {user.email
            ? 'Verified by OTP. You can log in with this email.'
            : 'You signed up with your mobile number.'}
        </span>
      </p>
      <p className={FORM_ROW}>
        <label htmlFor={`${id}-phone`} className={FORM_LABEL}>
          Mobile number
        </label>
        <input
          id={`${id}-phone`}
          value={user.phone ? formatPhone(user.phone) : 'Not added'}
          disabled
          aria-describedby={`${id}-phone-note`}
          className={FORM_INPUT}
        />
        <span id={`${id}-phone-note`} className={FIELD_HINT}>
          {user.phone
            ? 'Verified by OTP. You can log in with this number.'
            : 'You signed up with your email. Mobile login is a separate account for now.'}
        </span>
      </p>
      <p className="mx-[3px]">
        <button type="submit" disabled={pending} className={FORM_BUTTON}>
          {pending ? 'Saving\u2026' : 'Save changes'}
        </button>
      </p>
    </form>
  );
}
