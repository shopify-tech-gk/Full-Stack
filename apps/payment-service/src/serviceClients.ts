import { createOrderClient } from '@youmart/service-client';
import { config } from './config';

// No inventory client here on purpose - order-service owns confirm->commit
// / cancel->release-stock (see order.service.ts's confirmOrder/
// cancelOrderForPaymentFailure), so payment-service only ever talks to
// order-service, never to inventory-service directly.
export const orderClient = createOrderClient({
  baseUrl: config.orderServiceUrl,
  timeoutMs: config.serviceHttpTimeoutMs,
});
