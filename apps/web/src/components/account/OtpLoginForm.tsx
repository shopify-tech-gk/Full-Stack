'use client';

import { useEffect, useId, useState, useTransition, type FormEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  OTP_LENGTH,
  OTP_RESEND_SECONDS,
  detectIdentifier,
  identifierKind,
  identifierLabel,
  otpErrorMessage,
  safeReturnTo,
  type LoginIdentifier,
} from '@youmart/shared-client';
import { api } from '@/lib/api';
import { loginWithOtp } from '@/lib/session';
import { Notice } from './Notice';
import {
  FIELD_HINT,
  FORM_BUTTON,
  FORM_INPUT,
  FORM_LABEL,
  FORM_REQUIRED,
  FORM_ROW,
  TEXT_LINK,
} from './formStyles';

interface OtpLoginFormProps {
  mode: 'login' | 'register';
  /** Validated against the allowlist in safeReturnTo before use. */
  returnTo?: string;
  /** Checkout embeds the form without the card frame. */
  bare?: boolean;
}

function inputHint(value: string): string {
  const kind = identifierKind(value);
  const detected = detectIdentifier(value);
  if (!kind) return 'Use your mobile number or email - no password needed.';
  if (kind === 'PHONE') {
    return detected
      ? `Mobile number detected - we'll send the code on WhatsApp to ${identifierLabel(detected)}.`
      : 'Mobile number - enter all 10 digits.';
  }
  return detected
    ? `Email detected - we'll email the code to ${detected.value}.`
    : 'Email address - enter the full address, e.g. name@example.com.';
}

// Live's Login/Register cards (1px blue border, radius 10, 20px padding) driven by passwordless
// OTP: one field takes a mobile number (code on WhatsApp) or an email (code by email). The first
// successful code creates the account, so Login and Register run the same flow.
export function OtpLoginForm({ mode, returnTo, bare = false }: OtpLoginFormProps) {
  const id = useId();
  const router = useRouter();
  const [value, setValue] = useState('');
  const [code, setCode] = useState('');
  const [sentTo, setSentTo] = useState<LoginIdentifier | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = window.setTimeout(() => setCooldown((s) => s - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [cooldown]);

  const send = (target: LoginIdentifier) => {
    setError(null);
    startTransition(async () => {
      try {
        await api.auth.requestOtp(target.value);
        setSentTo(target);
        setCode('');
        setCooldown(OTP_RESEND_SECONDS);
      } catch (err) {
        setError(otpErrorMessage(err, 'request'));
      }
    });
  };

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (!sentTo) {
      const target = detectIdentifier(value);
      if (!target) {
        setError('Please enter a valid 10-digit mobile number or an email address.');
        return;
      }
      send(target);
      return;
    }
    if (!new RegExp(`^\\d{${OTP_LENGTH}}$`).test(code)) {
      setError(`Please enter the ${OTP_LENGTH}-digit code.`);
      return;
    }
    setError(null);
    startTransition(async () => {
      try {
        await loginWithOtp(sentTo.value, code);
        router.replace(safeReturnTo(returnTo));
      } catch (err) {
        setError(otpErrorMessage(err, 'verify'));
      }
    });
  };

  const verb = mode === 'login' ? 'Log in' : 'Register';
  const channel = sentTo?.type === 'EMAIL' ? 'email' : 'WhatsApp';

  return (
    <form
      onSubmit={onSubmit}
      noValidate
      className={bare ? undefined : 'my-[32px] rounded-[10px] border border-catalog-rule p-[20px]'}
    >
      {error && <Notice tone="error">{error}</Notice>}

      {!sentTo ? (
        <p className={FORM_ROW}>
          <label htmlFor={`${id}-identifier`} className={FORM_LABEL}>
            Mobile number or email <span className={FORM_REQUIRED}>*</span>
          </label>
          <input
            id={`${id}-identifier`}
            type="text"
            inputMode={identifierKind(value) === 'PHONE' ? 'tel' : 'email'}
            autoComplete="username"
            autoCapitalize="none"
            spellCheck={false}
            placeholder="Enter mobile number or email"
            value={value}
            onChange={(event) => setValue(event.target.value)}
            aria-invalid={Boolean(error)}
            aria-describedby={`${id}-identifier-hint`}
            className={FORM_INPUT}
          />
          <span id={`${id}-identifier-hint`} aria-live="polite" className={FIELD_HINT}>
            {inputHint(value)}
          </span>
        </p>
      ) : (
        <>
          <p role="status" className="mb-[15px] font-ui text-[15px] leading-[1.5] text-ink-body">
            OTP sent to your {channel}: <strong>{identifierLabel(sentTo)}</strong>.{' '}
            <button
              type="button"
              onClick={() => {
                setSentTo(null);
                setCode('');
                setError(null);
              }}
              className={TEXT_LINK}
            >
              Change
            </button>
          </p>
          <p className={FORM_ROW}>
            <label htmlFor={`${id}-code`} className={FORM_LABEL}>
              Enter the {OTP_LENGTH}-digit OTP <span className={FORM_REQUIRED}>*</span>
            </label>
            <input
              id={`${id}-code`}
              inputMode="numeric"
              autoComplete="one-time-code"
              autoFocus
              maxLength={OTP_LENGTH}
              value={code}
              onChange={(event) => setCode(event.target.value.replace(/\D/g, ''))}
              aria-invalid={Boolean(error)}
              className={`${FORM_INPUT} tracking-[0.3em]`}
            />
          </p>
        </>
      )}

      {mode === 'register' && (
        <p className="mb-[25.6px] font-ui text-[16px] leading-[25.6px] text-ink-body">
          New here? Your account is created when you verify the code. Your personal data will be
          used to support your experience throughout this website, to manage access to your account,
          and for other purposes described in our{' '}
          <Link href="/privacy-policy" className={TEXT_LINK}>
            privacy policy
          </Link>
          .
        </p>
      )}

      <p className="mx-[3px] mb-[15px]">
        <button type="submit" disabled={pending} className={FORM_BUTTON}>
          {sentTo ? verb : 'Send OTP'}
        </button>
      </p>

      {sentTo && (
        <p className="font-ui text-[16px] leading-[25.6px]">
          {cooldown > 0 ? (
            <span className="text-ink-muted">Resend OTP in {cooldown}s</span>
          ) : (
            <button
              type="button"
              onClick={() => send(sentTo)}
              disabled={pending}
              className={TEXT_LINK}
            >
              Resend OTP
            </button>
          )}
        </p>
      )}
    </form>
  );
}
