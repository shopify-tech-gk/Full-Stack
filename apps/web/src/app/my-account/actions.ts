'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { DEMO_OTP_CODE, OTP_LENGTH, toE164Phone } from '@youmart/shared-client';
import { DEMO_SESSION_COOKIE } from '@/lib/session';

export interface OtpResult {
  ok: boolean;
  error?: string;
}

/** Where a successful login may return to (fixed list - never an arbitrary URL). */
const LOGIN_RETURN_PATHS = ['/my-account', '/checkout'] as const;
export type LoginReturnPath = (typeof LOGIN_RETURN_PATHS)[number];

// DEMO: mirrors POST /api/auth/otp/request (validation + generic response). No code is sent.
export async function requestOtp(phone: string): Promise<OtpResult> {
  return toE164Phone(phone)
    ? { ok: true }
    : { ok: false, error: 'Please enter a valid 10-digit mobile number.' };
}

// DEMO: mirrors POST /api/auth/otp/verify; accepts DEMO_OTP_CODE and sets a demo session flag.
export async function verifyOtp(
  phone: string,
  code: string,
  returnTo: LoginReturnPath = '/my-account',
): Promise<OtpResult> {
  if (!toE164Phone(phone)) {
    return { ok: false, error: 'Please enter a valid 10-digit mobile number.' };
  }
  if (!new RegExp(`^\\d{${OTP_LENGTH}}$`).test(code) || code !== DEMO_OTP_CODE) {
    return { ok: false, error: 'The code is incorrect or has expired. Please try again.' };
  }
  cookies().set(DEMO_SESSION_COOKIE, '1', {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 60 * 24 * 14,
  });
  redirect(LOGIN_RETURN_PATHS.includes(returnTo) ? returnTo : '/my-account');
}

export async function logout(): Promise<void> {
  cookies().delete(DEMO_SESSION_COOKIE);
  redirect('/my-account');
}
