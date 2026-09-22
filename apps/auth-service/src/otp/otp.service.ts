import { prisma } from '../db';
import { config } from '../config';
import { AppError } from '@youmart/errors';
import { enqueueNotification } from '@youmart/notifications-client';
import { generateOtp, hashOtp, verifyOtp } from './otp.util';
import type { OtpPurpose } from './otp.schema';

export interface RequestOtpInput {
  phone: string;
  purpose: OtpPurpose;
}

export interface RequestOtpResult {
  status: 'otp_sent';
  expiresInSeconds: number;
}

/**
 * Same response shape regardless of whether `phone` maps to an existing
 * user - never lets a caller enumerate registered numbers.
 */
export async function requestOtp({ phone, purpose }: RequestOtpInput): Promise<RequestOtpResult> {
  const now = new Date();
  const cooldownSince = new Date(now.getTime() - config.otpResendCooldownSeconds * 1000);
  const hourAgo = new Date(now.getTime() - 60 * 60 * 1000);

  const recentChallenge = await prisma.otpChallenge.findFirst({
    where: {
      phone,
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
      phone,
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
    data: { phone, codeHash, purpose, expiresAt, attemptCount: 0 },
  });

  // Async, non-blocking send (Ch6.2): the DEV STUB that just logged the
  // code is retired - the raw code now flows ONLY through this queue job
  // (Redis) to notification-service's SMS provider (MSG91). It is never
  // stored in this service's DB and never returned in an HTTP response;
  // notification-service also never persists it in plaintext (see its
  // log-redaction.util.ts). `enqueueNotification` never throws - a queue
  // outage must never block the OTP response.
  await enqueueNotification({
    channel: 'SMS',
    to: phone,
    templateKey: 'OTP',
    data: { code, minutes: Math.round(config.otpTtlSeconds / 60) },
  });

  return { status: 'otp_sent', expiresInSeconds: config.otpTtlSeconds };
}

export interface VerifyOtpInput {
  phone: string;
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
 */
export async function verifyOtpCode({
  phone,
  purpose,
  code,
}: VerifyOtpInput): Promise<VerifyOtpResult> {
  const now = new Date();

  const challenge = await prisma.otpChallenge.findFirst({
    where: {
      phone,
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
      where: { phone, deletedAt: null },
    });

    if (existingUser) {
      if (!existingUser.isPhoneVerified) {
        await tx.user.update({
          where: { id: existingUser.id },
          data: { isPhoneVerified: true },
        });
      }
      return existingUser.id;
    }

    const newUser = await tx.user.create({
      data: { phone, isPhoneVerified: true, status: 'ACTIVE' },
    });
    return newUser.id;
  });

  return { status: 'verified', userId };
}
