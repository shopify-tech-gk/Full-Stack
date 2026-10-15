'use client';

import { useState } from 'react';
import { OtpLoginForm } from './OtpLoginForm';
import { QrLoginPanel } from './QrLoginPanel';

type Method = 'otp' | 'qr';

/** Login card: mobile / email OTP (as before) or "Scan QR code" with the YouMart app. */
export function LoginMethods({ returnTo }: { returnTo?: string }) {
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
        aria-label="Login method"
        className="mb-[16px] mt-[12px] flex gap-[6px] rounded-full bg-brand-popup-bg p-[5px]"
      >
        {tab('otp', 'Mobile / Email')}
        {tab('qr', 'Scan QR code')}
      </div>
      {method === 'otp' ? (
        <OtpLoginForm mode="login" returnTo={returnTo} />
      ) : (
        <QrLoginPanel returnTo={returnTo} />
      )}
    </div>
  );
}
