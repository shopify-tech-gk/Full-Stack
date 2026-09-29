'use client';

import { useEffect, useId, useState, useTransition, type FormEvent } from 'react';
import Link from 'next/link';
import {
  DEMO_OTP_CODE,
  OTP_LENGTH,
  OTP_RESEND_SECONDS,
  toE164Phone,
  toLocalPhone,
} from '@youmart/shared-client';
import { requestOtp, verifyOtp } from '@/app/my-account/actions';
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
}

// Live's Login/Register cards (1px blue border, radius 10, 20px padding), driven by our
// phone + WhatsApp OTP auth instead of WooCommerce username/password.
export function OtpLoginForm({ mode }: OtpLoginFormProps) {
  const id = useId();
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = window.setTimeout(() => setCooldown((s) => s - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [cooldown]);

  const send = () =>
    startTransition(async () => {
      setError(null);
      const result = await requestOtp(phone);
      if (!result.ok) {
        setError(result.error ?? 'Could not send the code.');
        return;
      }
      setSentTo(toE164Phone(phone));
      setCode('');
      setCooldown(OTP_RESEND_SECONDS);
    });

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (!sentTo) {
      send();
      return;
    }
    startTransition(async () => {
      setError(null);
      const result = await verifyOtp(phone, code);
      if (result && !result.ok) setError(result.error ?? 'Verification failed.');
    });
  };

  const verb = mode === 'login' ? 'Log in' : 'Register';

  return (
    <form
      onSubmit={onSubmit}
      noValidate
      className="my-[32px] rounded-[10px] border border-catalog-rule p-[20px]"
    >
      {error && <Notice tone="error">{error}</Notice>}

      <p className={FORM_ROW}>
        <label htmlFor={`${id}-phone`} className={FORM_LABEL}>
          Mobile number <span className={FORM_REQUIRED}>*</span>
        </label>
        <input
          id={`${id}-phone`}
          type="tel"
          inputMode="numeric"
          autoComplete="tel-national"
          placeholder="10-digit mobile number"
          value={phone}
          onChange={(event) => setPhone(event.target.value)}
          disabled={Boolean(sentTo)}
          aria-invalid={Boolean(error && !sentTo)}
          className={FORM_INPUT}
        />
      </p>

      {sentTo && (
        <>
          <p className="mb-[15px] font-ui text-[15px] leading-[1.5] text-ink-body">
            Enter the {OTP_LENGTH}-digit code sent on WhatsApp to +91 {toLocalPhone(sentTo)}.{' '}
            <button
              type="button"
              onClick={() => {
                setSentTo(null);
                setError(null);
              }}
              className={TEXT_LINK}
            >
              Change number
            </button>
          </p>
          <p className={FORM_ROW}>
            <label htmlFor={`${id}-code`} className={FORM_LABEL}>
              OTP <span className={FORM_REQUIRED}>*</span>
            </label>
            <input
              id={`${id}-code`}
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={OTP_LENGTH}
              value={code}
              onChange={(event) => setCode(event.target.value.replace(/\D/g, ''))}
              aria-describedby={`${id}-demo`}
              className={`${FORM_INPUT} tracking-[0.3em]`}
            />
            {/* DEMO hint - remove when the real OTP service is wired. */}
            <span id={`${id}-demo`} className={FIELD_HINT}>
              Demo mode: use code {DEMO_OTP_CODE}.
            </span>
          </p>
        </>
      )}

      {mode === 'register' && (
        <p className="mb-[25.6px] font-ui text-[16px] leading-[25.6px] text-ink-body">
          Your personal data will be used to support your experience throughout this website, to
          manage access to your account, and for other purposes described in our{' '}
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
            <button type="button" onClick={send} disabled={pending} className={TEXT_LINK}>
              Resend OTP
            </button>
          )}
        </p>
      )}
    </form>
  );
}
