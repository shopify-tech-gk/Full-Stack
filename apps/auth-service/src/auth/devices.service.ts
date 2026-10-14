import { AppError } from '@youmart/errors';
import { prisma } from '../db';
import { deviceLabel } from './device-label';
import { hashRefreshToken } from './token.util';

// Logged-in devices (WhatsApp-style). Every signed-in phone / browser holds one live refresh token;
// rotation (every /auth/refresh) revokes the old row and creates a new one, so the live rows ARE
// the signed-in devices and a row's createdAt is when that device was last active. Signing a
// device out revokes its refresh token: it can't get new access tokens (the current one, at most
// 15 minutes old, simply runs out).

export interface DeviceView {
  deviceId: string;
  label: string;
  kind: 'APP' | 'BROWSER' | 'UNKNOWN';
  lastActiveAt: string;
  /** The device making this request. */
  current: boolean;
}

function liveWhere(userId: string) {
  return { userId, revokedAt: null, deletedAt: null, expiresAt: { gt: new Date() } };
}

export async function listDevices(userId: string, currentRawToken?: string): Promise<DeviceView[]> {
  const currentHash = currentRawToken ? hashRefreshToken(currentRawToken) : null;
  const rows = await prisma.refreshToken.findMany({
    where: liveWhere(userId),
    orderBy: { createdAt: 'desc' },
  });
  return rows
    .map((row) => {
      const { label, kind } = deviceLabel(row.userAgent);
      return {
        deviceId: row.id,
        label,
        kind,
        lastActiveAt: row.createdAt.toISOString(),
        current: row.tokenHash === currentHash,
      };
    })
    .sort((a, b) => Number(b.current) - Number(a.current));
}

/** Sign one of the user's own devices out. */
export async function signOutDevice(userId: string, deviceId: string): Promise<void> {
  const result = await prisma.refreshToken.updateMany({
    where: { id: deviceId, ...liveWhere(userId) },
    data: { revokedAt: new Date() },
  });
  if (result.count === 0) {
    throw new AppError('NOT_FOUND', 404, 'Device not found');
  }
}

/** Sign out every device except the one making the request. */
export async function signOutOtherDevices(
  userId: string,
  currentRawToken?: string,
): Promise<{ signedOut: number }> {
  // Without this device's own session we can't tell "others" apart - refuse rather than sign out all.
  if (!currentRawToken) {
    throw new AppError(
      'VALIDATION_ERROR',
      400,
      'Could not identify this device - please sign in again',
    );
  }
  const currentHash = hashRefreshToken(currentRawToken);
  const result = await prisma.refreshToken.updateMany({
    where: { ...liveWhere(userId), tokenHash: { not: currentHash } },
    data: { revokedAt: new Date() },
  });
  return { signedOut: result.count };
}
