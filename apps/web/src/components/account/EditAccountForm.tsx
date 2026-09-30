'use client';

import { useId, useState, type FormEvent } from 'react';
import { formatPhone, type AuthUser } from '@youmart/shared-client';
import { useSession } from '@/lib/session';
import { Notice } from './Notice';
import {
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

// WooCommerce "Account details" minus the password section (login is passwordless OTP). The
// signed-in identity is real; saving is still DEMO (no profile-update endpoint yet).
function AccountDetailsForm({ user }: { user: AuthUser }) {
  const id = useId();
  const [name, setName] = useState(user.name ?? '');
  const [email, setEmail] = useState(user.email ?? '');
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
          disabled={user.isEmailVerified}
          aria-describedby={user.isEmailVerified ? `${id}-email-note` : undefined}
          className={FORM_INPUT}
        />
        {user.isEmailVerified && (
          <span id={`${id}-email-note`} className={FIELD_HINT}>
            Verified by OTP. You can log in with this email.
          </span>
        )}
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
        <button type="submit" className={FORM_BUTTON}>
          Save changes
        </button>
      </p>
    </form>
  );
}
