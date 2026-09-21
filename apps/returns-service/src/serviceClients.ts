import {
  createOrderClient,
  createPaymentClient,
  createInventoryClient,
} from '@youmart/service-client';
import { config } from './config';

/**
 * returns_svc cannot read the orders/payments/inventory schemas
 * (cross-schema isolation) - order-item state, refunds, and stock are
 * resolved over HTTP instead.
 */
export const orderClient = createOrderClient({
  baseUrl: config.orderServiceUrl,
  timeoutMs: config.serviceHttpTimeoutMs,
});

export const paymentClient = createPaymentClient({
  baseUrl: config.paymentServiceUrl,
  timeoutMs: config.serviceHttpTimeoutMs,
});

export const inventoryClient = createInventoryClient({
  baseUrl: config.inventoryServiceUrl,
  timeoutMs: config.serviceHttpTimeoutMs,
});
