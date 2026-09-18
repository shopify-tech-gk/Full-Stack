import { z } from 'zod';

// E.164-ish: leading +, first digit 1-9, then 7-14 more digits (8-15 total
// digits after the +). Deliberately permissive - a stricter India-specific
// pattern (fixed 10-digit numbers, allowed prefixes) can layer on top of
// this later without changing the shared shape other services depend on.
export const Phone = z.string().regex(/^\+[1-9]\d{7,14}$/, 'Invalid phone number');

export const OtpPurpose = z.enum(['LOGIN', 'PHONE_VERIFY']);
export type OtpPurpose = z.infer<typeof OtpPurpose>;

export const OtpRequestBody = z.object({
  phone: Phone,
  purpose: OtpPurpose.default('LOGIN'),
});
export type OtpRequestBody = z.infer<typeof OtpRequestBody>;

export const OtpVerifyBody = z.object({
  phone: Phone,
  purpose: OtpPurpose.default('LOGIN'),
  code: z.string().regex(/^\d+$/, 'Code must be numeric'),
});
export type OtpVerifyBody = z.infer<typeof OtpVerifyBody>;

// Queue payload - the only place the raw code travels outside this process
// (via Redis, to the send worker).
export const OtpSendJob = z.object({
  phone: Phone,
  code: z.string(),
  purpose: OtpPurpose,
});
export type OtpSendJob = z.infer<typeof OtpSendJob>;
