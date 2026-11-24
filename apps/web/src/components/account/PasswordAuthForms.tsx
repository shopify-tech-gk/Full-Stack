'use client';

import { useEffect, useId, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Check, Eye, EyeOff, Loader2, X } from 'lucide-react';
import {
  ApiError,
  OTP_LENGTH,
  OTP_RESEND_SECONDS,
  formatPhone,
  safeReturnTo,
  toE164Phone,
} from '@youmart/shared-client';
import { api } from '@/lib/api';
import { loginWithPassword, registerWithUsername } from '@/lib/session';
import { cleanUsername, passwordOk, passwordRules, useUsernameCheck } from '@/lib/username';
import { Notice } from './Notice';
import { FIELD_HINT, FORM_BUTTON, FORM_INPUT, FORM_LABEL, FORM_REQUIRED, FORM_ROW, TEXT_LINK } from './formStyles';

const CARD = 'my-[32px] rounded-[10px] border border-catalog-rule bg-white p-[20px] shadow-rail-card';

function PasswordInput({
  id,
  value,
  onChange,
  autoComplete,
}: {
  id: string;
  value: string;
  onChange: (v: string) => void;
  autoComplete: 'current-password' | 'new-password';
}) {
  const [show, setShow] = useState(false);
  return (
    <span className="relative block">
      <input
        id={id}
        type={show ? 'text' : 'password'}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        autoComplete={autoComplete}
        className={`${FORM_INPUT} pr-[44px]`}
      />
      <button
        type="button"
        onClick={() => setShow((s) => !s)}
        aria-label={show ? 'Hide password' : 'Show password'}
        className="absolute right-[8px] top-1/2 flex size-[30px] -translate-y-1/2 items-center justify-center rounded-full text-ink-muted hover:text-brand focus:outline-none focus-visible:ring-2 focus-visible:ring-brand"
      >
        {show ? <EyeOff aria-hidden="true" className="size-[17px]" /> : <Eye aria-hidden="true" className="size-[17px]" />}
      </button>
    </span>
  );
}

/** The three password rules, ticked off as they are met. */
export function PasswordRules({ password }: { password: string }) {
  const r = passwordRules(password);
  const rule = (ok: boolean, text: string) => (
    <li className={`flex items-center gap-[6px] ${ok ? 'text-[#15803d]' : 'text-ink-muted'}`}>
      {ok ? <Check aria-hidden="true" className="size-[13px]" strokeWidth={3} /> : <span aria-hidden="true" className="size-[13px] text-center leading-[13px]">•</span>}
      {text}
    </li>
  );
  return (
    <ul className="mt-[6px] flex flex-wrap gap-x-[16px] gap-y-[2px] font-ui text-[12.5px]">
      {rule(r.length, 'At least 8 characters')}
      {rule(r.letter, 'A letter')}
      {rule(r.number, 'A number')}
    </ul>
  );
}

/** "is it free?" line under a username field. */
export function UsernameHint({ state, message }: { state: string; message: string | null }) {
  if (state === 'checking') {
    return (
      <span className={`${FIELD_HINT} flex items-center gap-[6px]`}>
        <Loader2 aria-hidden="true" className="size-[13px] animate-spin" /> Checking…
      </span>
    );
  }
  if (!message) return <span className={FIELD_HINT}>3-20 letters, numbers, _ or . - start with a letter. It can&rsquo;t be changed later.</span>;
  return (
    <span className={`mt-[4px] flex items-center gap-[6px] font-ui text-[13px] ${state === 'ok' ? 'text-[#15803d]' : 'text-woo-error'}`}>
      {state === 'ok' ? <Check aria-hidden="true" className="size-[13px]" strokeWidth={3} /> : <X aria-hidden="true" className="size-[13px]" />}
      {message}
    </span>
  );
}

/** v1.18 Log in with username + password (accounts that set one). */
export function PasswordLoginForm({ returnTo, onUseOtp }: { returnTo?: string; onUseOtp: () => void }) {
  const id = useId();
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!username.trim() || !password) {
      setError('Enter your username and password.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await loginWithPassword(cleanUsername(username).replace(/^@/, ''), password);
      router.replace(safeReturnTo(returnTo));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not log in. Please try again.');
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} noValidate className={CARD}>
      {error && <Notice tone="error">{error}</Notice>}
      <p className={FORM_ROW}>
        <label htmlFor={`${id}-u`} className={FORM_LABEL}>
          Username <span className={FORM_REQUIRED}>*</span>
        </label>
        <input
          id={`${id}-u`}
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          autoComplete="username"
          autoCapitalize="none"
          spellCheck={false}
          placeholder="yourname"
          className={FORM_INPUT}
        />
      </p>
      <div className={FORM_ROW}>
        <label htmlFor={`${id}-p`} className={FORM_LABEL}>
          Password <span className={FORM_REQUIRED}>*</span>
        </label>
        <PasswordInput id={`${id}-p`} value={password} onChange={setPassword} autoComplete="current-password" />
      </div>
      <p className="mx-[3px] mb-[12px]">
        <button type="submit" disabled={busy} className={FORM_BUTTON}>
          {busy ? 'Logging in…' : 'Log in'}
        </button>
      </p>
      <p className="font-ui text-[14.5px]">
        Forgot your password?{' '}
        <button type="button" onClick={onUseOtp} className={TEXT_LINK}>
          Log in with OTP
        </button>{' '}
        and set a new one under Account details.
      </p>
    </form>
  );
}

/** v1.18 Register with a username: name, username, password and mobile; an OTP completes it. */
export function UsernameRegisterForm({ returnTo }: { returnTo?: string }) {
  const id = useId();
  const router = useRouter();
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [mobile, setMobile] = useState('');
  const [step, setStep] = useState<'form' | 'otp'>('form');
  const [code, setCode] = useState('');
  const [seconds, setSeconds] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const uname = cleanUsername(username);
  const check = useUsernameCheck(uname);
  const phone = toE164Phone(mobile);

  useEffect(() => {
    if (seconds <= 0) return;
    const t = setTimeout(() => setSeconds((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [seconds]);

  const body = () => ({ name: name.trim(), username: uname, password, phone: phone ?? '' });

  const sendOtp = async () => {
    setError(null);
    if (!name.trim()) return setError('Please enter your name.');
    if (check.state === 'bad' || !uname) return setError(check.message ?? 'Choose a username.');
    if (!passwordOk(password)) return setError('Your password needs 8+ characters with a letter and a number.');
    if (!phone) return setError('Please enter a valid 10-digit mobile number.');
    setBusy(true);
    try {
      await api.auth.registerStart(body());
      setStep('otp');
      setCode('');
      setSeconds(OTP_RESEND_SECONDS);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not send the OTP. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  const create = async () => {
    if (!new RegExp(`^\\d{${OTP_LENGTH}}$`).test(code)) {
      setError(`Please enter the ${OTP_LENGTH}-digit code.`);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await registerWithUsername(body(), code);
      router.replace(safeReturnTo(returnTo));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not create the account.');
      setCode('');
      setBusy(false);
    }
  };

  return (
    <form
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        void (step === 'form' ? sendOtp() : create());
      }}
      className={CARD}
    >
      {error && <Notice tone="error">{error}</Notice>}
      {step === 'form' ? (
        <>
          <p className={FORM_ROW}>
            <label htmlFor={`${id}-n`} className={FORM_LABEL}>
              Full name <span className={FORM_REQUIRED}>*</span>
            </label>
            <input id={`${id}-n`} value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" maxLength={100} className={FORM_INPUT} />
          </p>
          <div className={FORM_ROW}>
            <label htmlFor={`${id}-u`} className={FORM_LABEL}>
              Username <span className={FORM_REQUIRED}>*</span>
            </label>
            <span className="relative block">
              <span className="pointer-events-none absolute left-[12px] top-1/2 -translate-y-1/2 font-ui text-[15px] text-ink-muted">@</span>
              <input
                id={`${id}-u`}
                value={username}
                onChange={(e) => setUsername(cleanUsername(e.target.value))}
                autoComplete="username"
                autoCapitalize="none"
                spellCheck={false}
                maxLength={20}
                className={`${FORM_INPUT} pl-[28px]`}
              />
            </span>
            <UsernameHint state={check.state} message={check.message} />
          </div>
          <div className={FORM_ROW}>
            <label htmlFor={`${id}-p`} className={FORM_LABEL}>
              Password <span className={FORM_REQUIRED}>*</span>
            </label>
            <PasswordInput id={`${id}-p`} value={password} onChange={setPassword} autoComplete="new-password" />
            <PasswordRules password={password} />
          </div>
          <div className={FORM_ROW}>
            <label htmlFor={`${id}-m`} className={FORM_LABEL}>
              Mobile number <span className={FORM_REQUIRED}>*</span>
            </label>
            <input id={`${id}-m`} inputMode="tel" value={mobile} onChange={(e) => setMobile(e.target.value)} autoComplete="tel" placeholder="10-digit mobile number" className={FORM_INPUT} />
            <span className={FIELD_HINT}>We&rsquo;ll send a code on WhatsApp - one number, one account.</span>
          </div>
        </>
      ) : (
        <>
          <p role="status" className="mb-[15px] font-ui text-[15px] leading-[1.5] text-ink-body">
            OTP sent on WhatsApp to <strong>{phone ? formatPhone(phone) : mobile}</strong>.{' '}
            <button type="button" onClick={() => setStep('form')} className={TEXT_LINK}>
              Change
            </button>
          </p>
          <p className={FORM_ROW}>
            <label htmlFor={`${id}-c`} className={FORM_LABEL}>
              Enter the {OTP_LENGTH}-digit OTP <span className={FORM_REQUIRED}>*</span>
            </label>
            <input
              id={`${id}-c`}
              inputMode="numeric"
              autoComplete="one-time-code"
              autoFocus
              maxLength={OTP_LENGTH}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
              placeholder={'•'.repeat(OTP_LENGTH)}
              className={`${FORM_INPUT} font-semibold tabular-nums tracking-[0.45em] placeholder:tracking-[0.45em] lg:text-[18px]`}
            />
          </p>
        </>
      )}
      <p className="mb-[16px] font-ui text-[14px] leading-[1.55] text-ink-muted">
        By creating an account you accept our{' '}
        <Link href="/terms" className={TEXT_LINK}>
          Terms
        </Link>{' '}
        and{' '}
        <Link href="/privacy-policy" className={TEXT_LINK}>
          Privacy Policy
        </Link>
        .
      </p>
      <p className="mx-[3px] mb-[12px]">
        <button type="submit" disabled={busy} className={FORM_BUTTON}>
          {busy ? 'Please wait…' : step === 'form' ? 'Send OTP' : 'Create account'}
        </button>
      </p>
      {step === 'otp' ? (
        <p className="font-ui text-[15px]">
          {seconds > 0 ? (
            <span className="text-ink-muted">Resend OTP in {seconds}s</span>
          ) : (
            <button type="button" onClick={() => void sendOtp()} disabled={busy} className={TEXT_LINK}>
              Resend OTP
            </button>
          )}
        </p>
      ) : null}
    </form>
  );
}
