import { config } from '../config';
import type { NotificationChannelValue, NotificationProvider } from './provider.interface';
import { Msg91SmsProvider } from './msg91-sms.provider';
import { Msg91WhatsappProvider } from './msg91-whatsapp.provider';
import { ZohoEmailProvider } from './zoho-email.provider';
import { NoopProvider } from './noop.provider';

// PUSH has no adapter yet (declared in the channel enum for forward-compat
// only, see @youmart/notifications-client) - a job for it fails until a
// future chapter adds one; deliberately NOT registered here.
const realProviders: Partial<Record<NotificationChannelValue, NotificationProvider>> = {
  SMS: new Msg91SmsProvider(),
  WHATSAPP: new Msg91WhatsappProvider(),
  EMAIL: new ZohoEmailProvider(),
};

const noopProvider = new NoopProvider();

/** `NOTIFICATIONS_ENABLED=false` resolves EVERY channel (including PUSH)
 * to the no-op/simulated provider - the safe-mode switch always wins. */
export function resolveProvider(channel: NotificationChannelValue): NotificationProvider {
  if (!config.notificationsEnabled) {
    return noopProvider;
  }
  const provider = realProviders[channel];
  if (!provider) {
    throw new Error(`No notification provider registered for channel "${channel}"`);
  }
  return provider;
}
