'use client';

import { useState } from 'react';
import { OtpLoginForm } from './OtpLoginForm';
import { UsernameRegisterForm } from './PasswordAuthForms';

type Method = 'otp' | 'username';

/** Register card: quick OTP sign-up (as before) or a username + password account (v1.18). */
export function RegisterMethods({ returnTo }: { returnTo?: string }) {
  const [method, setMethod] = useState<Method>('otp');
  const tab = (value: Method, label: string) => (
    <button
      type="button"
      role="tab"
      aria-selected={method === value}
      onClick={() => setMethod(value)}
      className={`flex-1 rounded-full px-[14px] py-[9px] font-ui text-[14px] font-semibold transition-colors duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand ${
        method === value ? 'bg-brand text-white shadow-brand-button' : 'text-brand hover:bg-white'
      }`}
    >
      {label}
    </button>
  );
  return (
    <div>
      <div
        role="tablist"
        aria-label="Register method"
        className="mb-[16px] mt-[12px] flex gap-[6px] rounded-full bg-brand-popup-bg p-[5px]"
      >
        {tab('otp', 'Quick sign-up (OTP)')}
        {tab('username', 'Username & password')}
      </div>
      {method === 'otp' ? (
        <OtpLoginForm mode="register" returnTo={returnTo} />
      ) : (
        <UsernameRegisterForm returnTo={returnTo} />
      )}
    </div>
  );
}
