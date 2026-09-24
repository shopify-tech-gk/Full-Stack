import type { NotificationProvider, OutgoingMessage, SendResult } from './provider.interface';

/**
 * Used only when `NOTIFICATIONS_ENABLED=false` - never calls a real
 * provider, always reports a simulated success. Lets the whole
 * enqueue->render->log pipeline run in dev/test without spending
 * SMS/WhatsApp credits or hitting rate limits.
 */
export class NoopProvider implements NotificationProvider {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  send(_message: OutgoingMessage): Promise<SendResult> {
    return Promise.resolve({ status: 'SENT', providerMessageId: 'simulated' });
  }
}
