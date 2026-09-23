import { createOrderClient, createCatalogClient } from '@youmart/service-client';
import { config } from './config';

/**
 * invoices_svc cannot read the orders/catalog schemas (cross-schema
 * isolation) - the order (+ its lines) and each SKU's HSN/GST rate are
 * resolved over HTTP instead.
 */
export const orderClient = createOrderClient({
  baseUrl: config.orderServiceUrl,
  timeoutMs: config.serviceHttpTimeoutMs,
});

export const catalogClient = createCatalogClient({
  baseUrl: config.catalogServiceUrl,
  timeoutMs: config.serviceHttpTimeoutMs,
});
