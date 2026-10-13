import {
  createAuthClient,
  createOrderClient,
  type ServiceAuthOptions,
} from '@youmart/service-client';
import { config } from './config';

// W9 - self-minted short-lived service token per call (never a forwarded user token).
const serviceAuth: ServiceAuthOptions = {
  callerServiceName: 'notification-service',
  serviceSecret: config.serviceJwtSecret,
  ttlSeconds: config.serviceTokenTtlSeconds,
};

/** Help tickets: verifies the order a ticket is about is the customer's own. */
export const orderClient = createOrderClient({
  baseUrl: config.orderServiceUrl,
  timeoutMs: config.serviceHttpTimeoutMs,
  serviceAuth,
});

/** Notification settings: which channels the customer wants for order updates / offers. */
export const authClient = createAuthClient({
  baseUrl: config.authServiceUrl,
  timeoutMs: config.serviceHttpTimeoutMs,
  serviceAuth,
});
