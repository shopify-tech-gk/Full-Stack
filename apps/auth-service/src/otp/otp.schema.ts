import { z } from 'zod';

// E.164-ish: leading +, first digit 1-9, then 7-14 more digits (8-15 total
// digits after the +). Deliberately permissive - a stricter India-specific
// pattern (fixed 10-digit numbers, allowed prefixes) can layer on top of
// this later without changing the shared shape other services depend on.
export const Phone = z.string().regex(/^\+[1-9]\d{7,14}$/, 'Invalid phone number');

export const OtpPurpose = z.enum(['LOGIN', 'PHONE_VERIFY']);
export type OtpPurpose = z.infer<typeof OtpPurpose>;

export const OtpRequestBody = z.object({
  // v1.2: a mobile number OR an email; see otp.target.ts. `phone` is the v1 field.
  identifier: z.string().max(254).optional(),
  phone: Phone.optional(),
  purpose: OtpPurpose.default('LOGIN'),
});
export type OtpRequestBody = z.infer<typeof OtpRequestBody>;

export const OtpVerifyBody = OtpRequestBody.extend({
  code: z.string().regex(/^\d+$/, 'Code must be numeric'),
});
export type OtpVerifyBody = z.infer<typeof OtpVerifyBody>;
