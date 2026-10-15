'use client';

import { useId, useState, type KeyboardEvent } from 'react';
import { ApiError, type AuthUser } from '@youmart/shared-client';
import { api } from '@/lib/api';
import { applyUserUpdate } from '@/lib/session';
import { FIELD_ERROR, FIELD_HINT, FORM_BUTTON, FORM_INPUT, TEXT_LINK } from './formStyles';

/**
 * v1.12: change (or add) the account's mobile number or email. A code goes to the NEW value
 * (WhatsApp / email); nothing changes until it checks out. A number/email already on another
 * account is refused by the server.
 */
export function ContactChange({
  kind,
  onDone,
  onCancel,
}: {
  kind: 'PHONE' | 'EMAIL';
  onDone: (user: AuthUser) => void;
  onCancel: () => void;
}) {
  const id = useId();
  const phone = kind === 'PHONE';
  const [step, setStep] = useState<'enter' | 'code'>('enter');
  const [value, setValue] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const ready = step === 'enter' ? value.trim().length >= 5 : code.length >= 4;
  // Rendered inside the Account details <form> (no nested forms), so Enter is handled here and
  // never submits the outer form.
  const onKey = (event: KeyboardEvent) => {
    if (event.key !== 'Enter') return;
    event.preventDefault();
    if (ready && !busy) void submit();
  };

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      if (step === 'enter') {
        await api.auth.requestContactChange(value.trim());
        setStep('code');
      } else {
        const user = await api.auth.verifyContactChange(value.trim(), code.trim());
        applyUserUpdate(user);
        onDone(user);
      }
    } catch (failure) {
      setError(failure instanceof ApiError ? failure.message : 'Something went wrong. Try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      role="group"
      aria-label={phone ? 'Change mobile number' : 'Change email'}
      className="mt-[10px] rounded-[10px] border border-catalog-rule bg-cart-headBg p-[14px]"
    >
      {step === 'enter' ? (
        <>
          <label htmlFor={`${id}-v`} className="mb-[6px] block font-ui text-[14px] font-semibold">
            {phone ? 'New mobile number' : 'New email address'}
          </label>
          <input
            id={`${id}-v`}
            value={value}
            onChange={(e) => {
              setValue(e.target.value);
              setError(null);
            }}
            type={phone ? 'tel' : 'email'}
            inputMode={phone ? 'numeric' : 'email'}
            autoComplete={phone ? 'tel-national' : 'email'}
            placeholder={phone ? '10-digit mobile number' : 'you@example.com'}
            className={FORM_INPUT}
            onKeyDown={onKey}
            autoFocus
          />
          <span className={FIELD_HINT}>
            {phone
              ? "We'll send a code on WhatsApp to confirm it's yours."
              : "We'll email you a code to confirm it's yours."}
          </span>
        </>
      ) : (
        <>
          <label htmlFor={`${id}-c`} className="mb-[6px] block font-ui text-[14px] font-semibold">
            Enter the code sent to {value.trim()}
          </label>
          <input
            id={`${id}-c`}
            value={code}
            onChange={(e) => {
              setCode(e.target.value.replace(/\D/g, '').slice(0, 8));
              setError(null);
            }}
            inputMode="numeric"
            autoComplete="one-time-code"
            placeholder="••••••"
            className={`${FORM_INPUT} tracking-[0.4em]`}
            onKeyDown={onKey}
            autoFocus
          />
        </>
      )}
      {error && <span className={FIELD_ERROR}>{error}</span>}
      <div className="mt-[12px] flex flex-wrap items-center gap-[14px]">
        <button
          type="button"
          onClick={() => void submit()}
          disabled={busy || !ready}
          className={FORM_BUTTON}
        >
          {busy ? 'Please wait…' : step === 'enter' ? 'Send code' : 'Verify & save'}
        </button>
        <button
          type="button"
          onClick={step === 'code' ? () => setStep('enter') : onCancel}
          className={TEXT_LINK}
        >
          {step === 'code' ? `Change ${phone ? 'number' : 'email'}` : 'Cancel'}
        </button>
      </div>
    </div>
  );
}
