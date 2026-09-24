import { registerWorker } from '@youmart/queue';
import { NotificationJob } from '@youmart/notifications-client';
import { processNotificationJob } from './notification.service';

let worker: ReturnType<typeof registerWorker<NotificationJob>> | undefined;

/** Registers the consumer side of the SAME "notifications" BullMQ queue
 * every other service's `@youmart/notifications-client` enqueues onto. */
export function startNotificationWorker(): ReturnType<typeof registerWorker<NotificationJob>> {
  worker = registerWorker('notifications', NotificationJob, async (payload, job) => {
    await processNotificationJob(payload, job);
  });
  return worker;
}

export async function closeNotificationWorker(): Promise<void> {
  if (worker) {
    await worker.close();
    worker = undefined;
  }
}
