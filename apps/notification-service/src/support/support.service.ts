import { AppError } from '@youmart/errors';
import { enqueueNotification } from '@youmart/notifications-client';
import { normalizePhoneE164 } from '@youmart/shared-utils';
import { prisma } from '../db';
import { config } from '../config';
import type { ContactMessageBody } from './support.schema';

export interface ContactMessageReceipt {
  messageId: string;
  /** Short human reference for the customer ("SUP-" + the id's random tail). */
  reference: string;
  receivedAt: string;
}

/**
 * Public contact form (W1): stores the message (the durable record the store works from), then
 * forwards it to the support inbox through the existing notifications queue - fire-and-forget,
 * so a mail/queue problem never loses the stored message or fails the customer's request.
 */
export async function submitContactMessage(
  input: ContactMessageBody,
): Promise<ContactMessageReceipt> {
  const phone = normalizePhoneE164(input.phone);
  if (!phone) {
    throw new AppError('VALIDATION_ERROR', 400, 'Please enter a valid mobile number');
  }

  const row = await prisma.supportMessage.create({
    data: { name: input.name, phone, email: input.email ?? null, message: input.message },
  });
  const reference = `SUP-${row.id.replace(/-/g, '').slice(-8).toUpperCase()}`;

  await enqueueNotification({
    channel: 'EMAIL',
    to: config.supportInboxEmail,
    templateKey: 'SUPPORT_MESSAGE',
    data: {
      reference,
      name: row.name,
      phone: row.phone,
      email: row.email,
      message: row.message,
    },
  });

  return { messageId: row.id, reference, receivedAt: row.createdAt.toISOString() };
}
