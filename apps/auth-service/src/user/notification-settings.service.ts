import { z } from 'zod';
import { AppError } from '@youmart/errors';
import { prisma } from '../db';

// W9: which channels the customer wants for each kind of message, kept on the account
// (`user.preferences.notifications`). Security messages (login OTP) are always sent and are not
// part of these settings. notification-service reads them before sending (SKIPPED when off).

const Channels = z.object({ whatsapp: z.boolean(), email: z.boolean() });

export const NotificationSettingsBody = z.object({
  /** Order placed / shipped / delivered, refunds and wallet credits. */
  orderUpdates: Channels,
  /** Offers and promotions - off until the customer opts in. */
  offers: Channels,
});
export type NotificationSettings = z.infer<typeof NotificationSettingsBody>;

export const DEFAULT_NOTIFICATION_SETTINGS: NotificationSettings = {
  orderUpdates: { whatsapp: true, email: true },
  offers: { whatsapp: false, email: false },
};

function readSettings(preferences: unknown): NotificationSettings {
  const stored = (preferences as { notifications?: unknown } | null)?.notifications;
  const parsed = NotificationSettingsBody.safeParse(stored);
  return parsed.success ? parsed.data : DEFAULT_NOTIFICATION_SETTINGS;
}

export async function getNotificationSettings(userId: string): Promise<NotificationSettings> {
  const user = await prisma.user.findFirst({
    where: { id: userId, deletedAt: null },
    select: { preferences: true },
  });
  if (!user) {
    throw new AppError('NOT_FOUND', 404, 'User not found');
  }
  return readSettings(user.preferences);
}

export async function setNotificationSettings(
  userId: string,
  settings: NotificationSettings,
): Promise<NotificationSettings> {
  const user = await prisma.user.findFirst({
    where: { id: userId, deletedAt: null, status: 'ACTIVE' },
    select: { preferences: true },
  });
  if (!user) {
    throw new AppError('FORBIDDEN', 403, 'Account not found or inactive');
  }
  const prefs = (user.preferences as Record<string, unknown> | null) ?? {};
  await prisma.user.update({
    where: { id: userId },
    data: { preferences: { ...prefs, notifications: settings } },
  });
  return settings;
}
