import { prisma } from '../db';
import { config } from '../config';
import { AppError } from '@youmart/errors';
import { signAccessToken, generateRefreshToken, hashRefreshToken } from './token.util';

export interface SessionUser {
  id: string;
  phone: string;
  isPhoneVerified: boolean;
}

export interface SessionResult {
  accessToken: string;
  accessTokenExpiresIn: number;
  refreshTokenRaw: string;
  refreshTokenExpiresAt: Date;
  user: SessionUser;
}

async function loadActiveUser(userId: string) {
  const user = await prisma.user.findFirst({ where: { id: userId, deletedAt: null } });
  if (!user || user.status === 'BLOCKED') {
    throw new AppError('FORBIDDEN', 403, 'Account not found or inactive');
  }
  return user;
}

function toSessionUser(user: { id: string; phone: string; isPhoneVerified: boolean }): SessionUser {
  return { id: user.id, phone: user.phone, isPhoneVerified: user.isPhoneVerified };
}

export async function issueSession(userId: string, userAgent?: string): Promise<SessionResult> {
  const user = await loadActiveUser(userId);

  const { token: accessToken, expiresIn: accessTokenExpiresIn } = signAccessToken({
    id: user.id,
    phone: user.phone,
  });

  const refreshTokenRaw = generateRefreshToken();
  const refreshTokenExpiresAt = new Date(Date.now() + config.refreshTokenTtlSeconds * 1000);

  await prisma.refreshToken.create({
    data: {
      userId: user.id,
      tokenHash: hashRefreshToken(refreshTokenRaw),
      expiresAt: refreshTokenExpiresAt,
      userAgent: userAgent ?? null,
    },
  });

  return {
    accessToken,
    accessTokenExpiresIn,
    refreshTokenRaw,
    refreshTokenExpiresAt,
    user: toSessionUser(user),
  };
}

/**
 * Rotation is mandatory on every refresh: the old row is revoked and a new
 * one issued atomically ($transaction), so a replayed old cookie can never
 * be reused - its row no longer matches the "active" query.
 */
export async function rotateSession(
  rawRefreshToken: string,
  userAgent?: string,
): Promise<SessionResult> {
  const tokenHash = hashRefreshToken(rawRefreshToken);
  const now = new Date();

  const existing = await prisma.refreshToken.findFirst({
    where: { tokenHash, revokedAt: null, deletedAt: null, expiresAt: { gt: now } },
  });

  if (!existing) {
    throw new AppError('UNAUTHORIZED', 401, 'Invalid or expired session');
  }

  const user = await loadActiveUser(existing.userId);

  const { token: accessToken, expiresIn: accessTokenExpiresIn } = signAccessToken({
    id: user.id,
    phone: user.phone,
  });

  const refreshTokenRaw = generateRefreshToken();
  const refreshTokenExpiresAt = new Date(Date.now() + config.refreshTokenTtlSeconds * 1000);

  await prisma.$transaction([
    prisma.refreshToken.update({
      where: { id: existing.id },
      data: { revokedAt: now },
    }),
    prisma.refreshToken.create({
      data: {
        userId: user.id,
        tokenHash: hashRefreshToken(refreshTokenRaw),
        expiresAt: refreshTokenExpiresAt,
        userAgent: userAgent ?? null,
      },
    }),
  ]);

  return {
    accessToken,
    accessTokenExpiresIn,
    refreshTokenRaw,
    refreshTokenExpiresAt,
    user: toSessionUser(user),
  };
}

/**
 * Idempotent: a missing, already-revoked, or invalid token is a silent
 * no-op - never reveals whether a given cookie value ever mapped to a
 * real session.
 */
export async function revokeSession(rawRefreshToken: string): Promise<void> {
  const tokenHash = hashRefreshToken(rawRefreshToken);
  const existing = await prisma.refreshToken.findFirst({
    where: { tokenHash, revokedAt: null, deletedAt: null },
  });

  if (!existing) {
    return;
  }

  await prisma.refreshToken.update({
    where: { id: existing.id },
    data: { revokedAt: new Date() },
  });
}

export async function revokeAllForUser(userId: string): Promise<void> {
  await prisma.refreshToken.updateMany({
    where: { userId, revokedAt: null, deletedAt: null },
    data: { revokedAt: new Date() },
  });
}
