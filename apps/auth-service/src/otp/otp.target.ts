import { z } from 'zod';
import { AppError } from '@youmart/errors';
import { normalizePhoneE164 } from '@youmart/shared-utils';
import type { OtpPurpose } from './otp.schema';

/** Who an OTP challenge is for: a phone (sent on WhatsApp) or an email (sent by email). */
export type OtpTarget = { type: 'PHONE'; phone: string } | { type: 'EMAIL'; email: string };

const EmailAddress = z.email().max(254);

/** Detects phone vs email from one free-text field. Emails are compared lower-cased. */
export function parseIdentifier(raw: string): OtpTarget | null {
  const value = raw.trim();
  if (value.includes('@')) {
    const email = value.toLowerCase();
    return EmailAddress.safeParse(email).success ? { type: 'EMAIL', email } : null;
  }
  const phone = normalizePhoneE164(value);
  return phone ? { type: 'PHONE', phone } : null;
}

/** v1.2 `identifier` wins; the v1 `phone` field stays accepted for older clients. */
export function resolveOtpTarget(body: {
  identifier?: string;
  phone?: string;
  purpose: OtpPurpose;
}): OtpTarget {
  const target =
    body.identifier !== undefined
      ? parseIdentifier(body.identifier)
      : body.phone
        ? ({ type: 'PHONE', phone: body.phone } as const)
        : null;
  if (!target) {
    throw new AppError('VALIDATION_ERROR', 400, 'Enter a valid mobile number or email address');
  }
  if (target.type === 'EMAIL' && body.purpose === 'PHONE_VERIFY') {
    throw new AppError('VALIDATION_ERROR', 400, 'Phone verification needs a mobile number');
  }
  return target;
}

/** Prisma `where`/`data` fragment selecting the target's own column. */
export function targetKey(target: OtpTarget): { phone: string } | { email: string } {
  return target.type === 'PHONE' ? { phone: target.phone } : { email: target.email };
}
