import { createOrderClient, createSellerClient, createAuthClient } from '@youmart/service-client';
import { config } from './config';

/**
 * logistics_svc cannot read the orders/sellers schemas (cross-schema
 * isolation) - order-item state/ownership and seller identity/activation
 * are resolved over HTTP instead.
 */
export const orderClient = createOrderClient({
  baseUrl: config.orderServiceUrl,
  timeoutMs: config.serviceHttpTimeoutMs,
});

export const sellerClient = createSellerClient({
  baseUrl: config.sellerServiceUrl,
  timeoutMs: config.serviceHttpTimeoutMs,
});

// logistics_svc cannot read the auth schema (cross-schema isolation) -
// resolving the buyer's email for the shipping-update notification
// (Ch6.2) goes over HTTP instead.
export const authClient = createAuthClient({
  baseUrl: config.authServiceUrl,
  timeoutMs: config.serviceHttpTimeoutMs,
});
