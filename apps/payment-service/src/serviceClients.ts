import { createOrderClient, type ServiceAuthOptions } from '@youmart/service-client';
import { config } from './config';

// Ch6.5 - self-minted short-lived service token attached to every internal
// call below (never a forwarded/cached user token - closes the webhook
// gap: see payment.service.ts's handleWebhook doc comment).
const serviceAuth: ServiceAuthOptions = {
  callerServiceName: 'payment-service',
  serviceSecret: config.serviceJwtSecret,
  ttlSeconds: config.serviceTokenTtlSeconds,
};

// No inventory client here on purpose - order-service owns confirm->commit
// / cancel->release-stock (see order.service.ts's confirmOrder/
// cancelOrderForPaymentFailure), so payment-service only ever talks to
// order-service, never to inventory-service directly.
export const orderClient = createOrderClient({
  baseUrl: config.orderServiceUrl,
  timeoutMs: config.serviceHttpTimeoutMs,
  serviceAuth,
});
