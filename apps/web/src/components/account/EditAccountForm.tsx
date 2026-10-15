'use client';

import { useId, useState, type FormEvent } from 'react';
import { formatPhone, supportErrorMessage, type AuthUser } from '@youmart/shared-client';
import { updateProfileName, useSession } from '@/lib/session';
import { ContactChange } from './ContactChange';
import { Notice } from './Notice';
import {
  FIELD_ERROR,
  FIELD_HINT,
  FORM_BUTTON,
  FORM_INPUT,
  FORM_LABEL,
  FORM_REQUIRED,
  FORM_ROW,
  TEXT_LINK,
} from './formStyles';

export function EditAccountForm() {
  const session = useSession();
  return session.status === 'authenticated' ? <AccountDetailsForm user={session.user} /> : null;
}

// WooCommerce "Account details" minus the password section (login is passwordless OTP). The name
// saves through PATCH /api/auth/me; email and mobile are the OTP-verified login identities, so
// changing (or adding) one needs a code sent to the new value (v1.12, ContactChange).
function AccountDetailsForm({ user }: { user: AuthUser }) {
  const id = useId();
  const [name, setName] = useState(user.name ?? '');
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);
  const [pending, setPending] = useState(false);
  const [changing, setChanging] = useState<'PHONE' | 'EMAIL' | null>(null);

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
      <div className={FORM_ROW}>
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
            : 'Add an email to also log in with it.'}{' '}
          {changing !== 'EMAIL' && (
            <button type="button" onClick={() => setChanging('EMAIL')} className={TEXT_LINK}>
              {user.email ? 'Change email' : 'Add email'}
            </button>
          )}
        </span>
        {changing === 'EMAIL' && (
          <ContactChange
            kind="EMAIL"
            onCancel={() => setChanging(null)}
            onDone={() => {
              setChanging(null);
              setStatus({ tone: 'success', text: 'Your email has been updated.' });
            }}
          />
        )}
      </div>
      <div className={FORM_ROW}>
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
            : 'Add a mobile number to also log in with it.'}{' '}
          {changing !== 'PHONE' && (
            <button type="button" onClick={() => setChanging('PHONE')} className={TEXT_LINK}>
              {user.phone ? 'Change number' : 'Add number'}
            </button>
          )}
        </span>
        {changing === 'PHONE' && (
          <ContactChange
            kind="PHONE"
            onCancel={() => setChanging(null)}
            onDone={() => {
              setChanging(null);
              setStatus({ tone: 'success', text: 'Your mobile number has been updated.' });
            }}
          />
        )}
      </div>
      <p className="mx-[3px]">
        <button type="submit" disabled={pending} className={FORM_BUTTON}>
          {pending ? 'Saving\u2026' : 'Save changes'}
        </button>
      </p>
    </form>
  );
}
