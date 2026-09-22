import { createQueue } from '@youmart/queue';
import { z } from 'zod';

/** PUSH is declared for forward-compat only - no provider adapter exists
 * yet in notification-service (a future chapter). */
export const NotificationChannel = z.enum(['EMAIL', 'SMS', 'WHATSAPP', 'PUSH']);
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
