import {
  createOrderClient,
  createPaymentClient,
  createInventoryClient,
  createAuthClient,
  type ServiceAuthOptions,
} from '@youmart/service-client';
import { config } from './config';

// Ch6.5 - self-minted short-lived service token attached to every internal
// call below (never a forwarded user token).
const serviceAuth: ServiceAuthOptions = {
  callerServiceName: 'returns-service',
  serviceSecret: config.serviceJwtSecret,
  ttlSeconds: config.serviceTokenTtlSeconds,
};

/**
 * returns_svc cannot read the orders/payments/inventory schemas
 * (cross-schema isolation) - order-item state, refunds, and stock are
 * resolved over HTTP instead.
 */
export const orderClient = createOrderClient({
  baseUrl: config.orderServiceUrl,
  timeoutMs: config.serviceHttpTimeoutMs,
  serviceAuth,
});

export const paymentClient = createPaymentClient({
  baseUrl: config.paymentServiceUrl,
  timeoutMs: config.serviceHttpTimeoutMs,
  serviceAuth,
});

export const inventoryClient = createInventoryClient({
  baseUrl: config.inventoryServiceUrl,
  timeoutMs: config.serviceHttpTimeoutMs,
  serviceAuth,
});

// returns_svc cannot read the auth schema either (cross-schema isolation)
// - resolving the buyer's email for the refund-processed notification
// (Ch6.2c) goes over HTTP instead.
export const authClient = createAuthClient({
  baseUrl: config.authServiceUrl,
  timeoutMs: config.serviceHttpTimeoutMs,
  serviceAuth,
});
