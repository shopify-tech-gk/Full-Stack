import { createOrderClient, createSellerClient } from '@youmart/service-client';
import { config } from './config';

/**
 * settlements_svc cannot read the orders/sellers schemas (cross-schema
 * isolation) - settleable items and seller identity/commission rate are
 * resolved over HTTP instead.
 */
export const orderClient = createOrderClient({
  baseUrl: config.orderServiceUrl,
  timeoutMs: config.serviceHttpTimeoutMs,
});

export const sellerClient = createSellerClient({
  baseUrl: config.sellerServiceUrl,
  timeoutMs: config.serviceHttpTimeoutMs,
});
