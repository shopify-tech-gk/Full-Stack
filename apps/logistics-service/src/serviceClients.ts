import {
  createOrderClient,
  createSellerClient,
  createAuthClient,
  type ServiceAuthOptions,
} from '@youmart/service-client';
import { config } from './config';

// Ch6.5 - self-minted short-lived service token attached to every internal
// call below (never a forwarded user token).
const serviceAuth: ServiceAuthOptions = {
  callerServiceName: 'logistics-service',
  serviceSecret: config.serviceJwtSecret,
  ttlSeconds: config.serviceTokenTtlSeconds,
};

/**
 * logistics_svc cannot read the orders/sellers schemas (cross-schema
 * isolation) - order-item state/ownership and seller identity/activation
 * are resolved over HTTP instead.
 */
export const orderClient = createOrderClient({
  baseUrl: config.orderServiceUrl,
  timeoutMs: config.serviceHttpTimeoutMs,
  serviceAuth,
});

export const sellerClient = createSellerClient({
  baseUrl: config.sellerServiceUrl,
  timeoutMs: config.serviceHttpTimeoutMs,
  serviceAuth,
});

// logistics_svc cannot read the auth schema (cross-schema isolation) -
// resolving the buyer's email for the shipping-update notification
// (Ch6.2) goes over HTTP instead.
export const authClient = createAuthClient({
  baseUrl: config.authServiceUrl,
  timeoutMs: config.serviceHttpTimeoutMs,
  serviceAuth,
});
