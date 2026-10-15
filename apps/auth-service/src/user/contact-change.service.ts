import { z } from 'zod';
import { AppError } from '@youmart/errors';
import { prisma } from '../db';
import { config } from '../config';
import { getSessionUser, type SessionUser } from '../auth/session.service';
import { requestOtp, type RequestOtpResult } from '../otp/otp.service';
import { parseIdentifier, targetKey, type OtpTarget } from '../otp/otp.target';
import { verifyOtp } from '../otp/otp.util';

// v1.12: change (or add) the signed-in customer's mobile number or email. Both are login
// identifiers, so the NEW value must prove itself with an OTP sent to it before it replaces the
// old one - and it can't already belong to another account (that would merge two customers).

export const ContactChangeRequestBody = z.object({ identifier: z.string().trim().min(3).max(254) });
export const ContactChangeVerifyBody = ContactChangeRequestBody.extend({
  code: z.string().regex(/^\d+$/, 'Code must be numeric'),
});

function newTarget(raw: string): OtpTarget {
  const target = parseIdentifier(raw);
  if (!target) {
    throw new AppError('VALIDATION_ERROR', 400, 'Enter a valid mobile number or email address');
  }
  return target;
}

async function assertChangeable(userId: string, target: OtpTarget): Promise<void> {
  const me = await prisma.user.findFirst({ where: { id: userId, deletedAt: null } });
  if (!me) throw new AppError('FORBIDDEN', 403, 'Account not found or inactive');
  const current = target.type === 'PHONE' ? me.phone : me.email;
  const value = target.type === 'PHONE' ? target.phone : target.email;
  if (current === value) {
    throw new AppError(
      'VALIDATION_ERROR',
      400,
      `This is already your ${target.type === 'PHONE' ? 'mobile number' : 'email'}`,
    );
  }
  const taken = await prisma.user.findFirst({
    where: { ...targetKey(target), deletedAt: null, NOT: { id: userId } },
    select: { id: true },
  });
  if (taken) {
    throw new AppError(
      'CONFLICT',
      409,
      `This ${target.type === 'PHONE' ? 'mobile number' : 'email'} is already used by another YouMart account`,
    );
  }
}

/** POST /auth/me/contact/request - sends a code to the new number (WhatsApp) or email. */
export async function requestContactChange(
  userId: string,
  identifier: string,
): Promise<RequestOtpResult> {
  const target = newTarget(identifier);
  await assertChangeable(userId, target);
  return requestOtp({ target, purpose: 'CONTACT_CHANGE' });
}

/**
 * POST /auth/me/contact/verify - checks the code (same attempt limit and generic failure message
 * as login), then saves the new value as verified. Returns the updated profile.
 */
export async function verifyContactChange(
  userId: string,
  identifier: string,
  code: string,
): Promise<SessionUser> {
  const target = newTarget(identifier);
  const key = targetKey(target);
  const now = new Date();
  const challenge = await prisma.otpChallenge.findFirst({
    where: {
      ...key,
      purpose: 'CONTACT_CHANGE',
      deletedAt: null,
      consumedAt: null,
      expiresAt: { gt: now },
    },
    orderBy: { createdAt: 'desc' },
  });
  if (!challenge) throw new AppError('VALIDATION_ERROR', 400, 'Invalid or expired code');
  if (challenge.attemptCount >= config.otpMaxAttempts) {
    throw new AppError('RATE_LIMITED', 429, 'Too many attempts');
  }
  if (!verifyOtp(code, challenge.codeHash)) {
    await prisma.otpChallenge.update({
      where: { id: challenge.id },
      data: { attemptCount: { increment: 1 } },
    });
    throw new AppError('VALIDATION_ERROR', 400, 'Invalid or expired code');
  }

  // Re-checked at save time: someone may have registered the value since the code was sent.
  await assertChangeable(userId, target);
  await prisma.$transaction([
    prisma.otpChallenge.update({ where: { id: challenge.id }, data: { consumedAt: now } }),
    prisma.user.update({
      where: { id: userId },
      data:
        target.type === 'PHONE'
          ? { phone: target.phone, isPhoneVerified: true }
          : { email: target.email, isEmailVerified: true },
    }),
  ]);
  return getSessionUser(userId);
}
