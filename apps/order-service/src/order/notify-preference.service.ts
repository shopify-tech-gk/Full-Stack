import { AppError } from '@youmart/errors';
import { prisma } from '../db';
import type { NotifyPreferenceBody } from './notify-preference.schema';

export interface NotifyPreferenceView {
  orderId: string;
  whatsapp: boolean;
  sms: boolean;
  /** null = never set; the defaults below apply. */
  updatedAt: string | null;
}

/** Matches what the system does today with no preference: WhatsApp on, SMS off. */
const DEFAULTS = { whatsapp: true, sms: false } as const;

async function assertOwnOrder(userId: string, orderId: string): Promise<void> {
  const order = await prisma.order.findFirst({
    where: { id: orderId, userId, deletedAt: null },
    select: { id: true },
  });
  if (!order) {
    throw new AppError('NOT_FOUND', 404, 'Order not found');
  }
}

/**
 * Per-order notification channel preference (W1). Lives in order-service because it is order
 * data: ownership is a local query, and every service that sends order updates already reads
 * the order through order-service. Stored only for launch - senders start honouring it when
 * order-update notifications are reworked (SMS is not an active channel yet, Ch6.2b).
 */
export async function getNotifyPreference(
  userId: string,
  orderId: string,
): Promise<NotifyPreferenceView> {
  await assertOwnOrder(userId, orderId);
  const row = await prisma.orderNotifyPreference.findFirst({
    where: { orderId, deletedAt: null },
  });
  return row
    ? { orderId, whatsapp: row.whatsapp, sms: row.sms, updatedAt: row.updatedAt.toISOString() }
    : { orderId, ...DEFAULTS, updatedAt: null };
}

export async function setNotifyPreference(
  userId: string,
  orderId: string,
  input: NotifyPreferenceBody,
): Promise<NotifyPreferenceView> {
  await assertOwnOrder(userId, orderId);
  const existing = await prisma.orderNotifyPreference.findFirst({
    where: { orderId, deletedAt: null },
  });
  const row = existing
    ? await prisma.orderNotifyPreference.update({
        where: { id: existing.id },
        data: { whatsapp: input.whatsapp, sms: input.sms },
      })
    : await prisma.orderNotifyPreference.create({
        data: { orderId, userId, whatsapp: input.whatsapp, sms: input.sms },
      });
  return { orderId, whatsapp: row.whatsapp, sms: row.sms, updatedAt: row.updatedAt.toISOString() };
}
