import { createQueue } from '@youmart/queue';
import { z } from 'zod';

/** PUSH is declared for forward-compat only - no provider adapter exists
 * yet in notification-service (a future chapter). INBOX (v1.15) is the customer's in-app
 * inbox: `to` is the user id and notification-service stores the message itself. */
export const NotificationChannel = z.enum(['EMAIL', 'SMS', 'WHATSAPP', 'PUSH', 'INBOX']);
export type NotificationChannel = z.infer<typeof NotificationChannel>;

/** `data` is intentionally untyped here - only notification-service's own
 * template registry knows what shape each `templateKey` expects; this
 * package is just the typed transport. */
export const NotificationJob = z.object({
  channel: NotificationChannel,
  to: z.string().min(1),
  templateKey: z.string().min(1),
  data: z.record(z.string(), z.unknown()),
  userId: z.string().uuid().optional(),
});
export type NotificationJob = z.infer<typeof NotificationJob>;

const NOTIFICATIONS_QUEUE_NAME = 'notifications';

export const notificationsQueue = createQueue(NOTIFICATIONS_QUEUE_NAME, NotificationJob);

/**
 * Fire-and-forget enqueue - deliberately NEVER throws. A notification is
 * always secondary to the core flow that triggers it (OTP request, order
 * confirm, shipment creation); if Redis/the queue is unreachable, this
 * logs and returns rather than propagating, so the caller's own
 * transaction/response is never blocked or failed by a notification
 * problem. The actual send (with BullMQ retry) happens independently in
 * notification-service's worker.
 */
export async function enqueueNotification(payload: NotificationJob): Promise<void> {
  try {
    await notificationsQueue.enqueue(payload);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('failed to enqueue notification job (non-fatal, core flow continues)', {
      channel: payload.channel,
      templateKey: payload.templateKey,
      err,
    });
  }
}

/**
 * v1.15: drop a message into the customer's in-app inbox (the bell). Same fire-and-forget rules
 * as `enqueueNotification`; notification-service's inbox templates turn `templateKey` + `data`
 * into the title and text. Pass `orderId` / `orderNumber` in `data` so tapping it opens the order.
 */
export async function notifyInbox(
  userId: string,
  templateKey: string,
  data: Record<string, unknown>,
): Promise<void> {
  await enqueueNotification({ channel: 'INBOX', to: userId, userId, templateKey, data });
}
