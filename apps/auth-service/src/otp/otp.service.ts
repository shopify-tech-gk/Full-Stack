import { prisma } from '../db';
import { config } from '../config';
import { AppError } from '@youmart/errors';
import { enqueueNotification } from '@youmart/notifications-client';
import { generateOtp, hashOtp, verifyOtp } from './otp.util';
import type { OtpPurpose } from './otp.schema';
import { targetKey, type OtpTarget } from './otp.target';

export interface RequestOtpInput {
  target: OtpTarget;
  purpose: OtpPurpose;
}

export interface RequestOtpResult {
  status: 'otp_sent';
  expiresInSeconds: number;
}

/**
 * Same response shape regardless of whether the phone/email maps to an existing
 * user - never lets a caller enumerate registered accounts. Cooldown, hourly cap
 * and TTL apply per identifier, identically for both channels.
 */
export async function requestOtp({ target, purpose }: RequestOtpInput): Promise<RequestOtpResult> {
  const key = targetKey(target);
  const now = new Date();
  const cooldownSince = new Date(now.getTime() - config.otpResendCooldownSeconds * 1000);
  const hourAgo = new Date(now.getTime() - 60 * 60 * 1000);

  const recentChallenge = await prisma.otpChallenge.findFirst({
    where: {
      ...key,
      purpose,
      deletedAt: null,
      consumedAt: null,
      expiresAt: { gt: now },
      createdAt: { gte: cooldownSince },
    },
  });

  if (recentChallenge) {
    throw new AppError('RATE_LIMITED', 429, 'Please wait before requesting another code');
  }

  const challengeCountLastHour = await prisma.otpChallenge.count({
    where: {
      ...key,
      purpose,
      deletedAt: null,
      createdAt: { gte: hourAgo },
    },
  });

  if (challengeCountLastHour >= config.otpRateLimitPerHour) {
    throw new AppError('RATE_LIMITED', 429, 'Too many code requests, try again later');
  }

  const code = generateOtp(config.otpLength);
  const codeHash = hashOtp(code);
  const expiresAt = new Date(now.getTime() + config.otpTtlSeconds * 1000);

  await prisma.otpChallenge.create({
    data: { ...key, codeHash, purpose, expiresAt, attemptCount: 0 },
  });

  if (target.type === 'EMAIL') {
    // v1.2 email channel: same template, same queue, same redaction - only the channel differs.
    await enqueueNotification({
      channel: 'EMAIL',
      to: target.email,
      templateKey: 'OTP',
      data: { code, minutes: Math.round(config.otpTtlSeconds / 60) },
    });
    return { status: 'otp_sent', expiresInSeconds: config.otpTtlSeconds };
  }
  const { phone } = target;

  // Best-effort, read-only, INTERNAL lookup only - never influences the
  // client-visible response shape (still identical whether or not `phone`
  // maps to an account, per this function's doc comment above). Used
  // solely to give notification-service a login-safety fallback email
  // (Ch6.2b) if the WhatsApp OTP send ultimately fails.
  const existingUser = await prisma.user.findFirst({ where: { phone, deletedAt: null } });
  const fallbackEmail = existingUser?.email ?? undefined;

  // Async, non-blocking send (Ch6.2, rewired Ch6.2b): the DEV STUB that
  // just logged the code is retired - the raw code now flows ONLY through
  // this queue job (Redis) to notification-service's WhatsApp provider
  // (MSG91). It is never stored in this service's DB and never returned
  // in an HTTP response; notification-service also never persists it in
  // plaintext (see its log-redaction.util.ts). `enqueueNotification` never
  // throws - a queue outage must never block the OTP response.
  //
  // Ch6.2b channel decision (Vijesh, locked): OTP goes over WHATSAPP, not
  // SMS - a separate approved WhatsApp AUTHENTICATION template is required
  // (see notification-service's template.registry.ts); SMS stays built but
  // unrouted. `fallbackEmail`, when present, lets notification-service
  // fall back to email if WhatsApp delivery is ultimately exhausted -
  // login-safety net so a user is never silently unable to receive an OTP.
  await enqueueNotification({
    channel: 'WHATSAPP',
    to: phone,
    templateKey: 'OTP',
    data: {
      code,
      minutes: Math.round(config.otpTtlSeconds / 60),
      ...(fallbackEmail ? { fallbackEmail } : {}),
    },
  });

  return { status: 'otp_sent', expiresInSeconds: config.otpTtlSeconds };
}

export interface VerifyOtpInput {
  target: OtpTarget;
  purpose: OtpPurpose;
  code: string;
}

export interface VerifyOtpResult {
  status: 'verified';
  userId: string;
}

/**
 * All failure paths return the same generic message - the caller can't
 * distinguish "no challenge", "expired", or "wrong code" from the response.
 * The first successful verify for a phone/email creates that account; a phone
 * and an email are separate accounts (no linking yet).
 */
export async function verifyOtpCode({
  target,
  purpose,
  code,
}: VerifyOtpInput): Promise<VerifyOtpResult> {
  const key = targetKey(target);
  const now = new Date();

  const challenge = await prisma.otpChallenge.findFirst({
    where: {
      ...key,
      purpose,
      deletedAt: null,
      consumedAt: null,
      expiresAt: { gt: now },
    },
    orderBy: { createdAt: 'desc' },
  });

  if (!challenge) {
    throw new AppError('VALIDATION_ERROR', 400, 'Invalid or expired code');
  }

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

  const userId = await prisma.$transaction(async (tx) => {
    await tx.otpChallenge.update({
      where: { id: challenge.id },
      data: { consumedAt: now },
    });

    const existingUser = await tx.user.findFirst({
      where: { ...key, deletedAt: null },
    });
    const verifiedFlag =
      target.type === 'PHONE' ? { isPhoneVerified: true } : { isEmailVerified: true };

    if (existingUser) {
      const alreadyVerified =
        target.type === 'PHONE' ? existingUser.isPhoneVerified : existingUser.isEmailVerified;
      if (!alreadyVerified) {
        await tx.user.update({
          where: { id: existingUser.id },
          data: verifiedFlag,
        });
      }
      return existingUser.id;
    }

    const newUser = await tx.user.create({
      data: { ...key, ...verifiedFlag, status: 'ACTIVE' },
    });
    return newUser.id;
  });

  return { status: 'verified', userId };
}
