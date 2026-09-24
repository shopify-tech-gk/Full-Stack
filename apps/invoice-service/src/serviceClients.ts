import {
  createOrderClient,
  createCatalogClient,
  type ServiceAuthOptions,
} from '@youmart/service-client';
import { config } from './config';

// Ch6.5 - self-minted short-lived service token attached to every internal
// call below (never a forwarded user token - the queue worker has none).
const serviceAuth: ServiceAuthOptions = {
  callerServiceName: 'invoice-service',
  serviceSecret: config.serviceJwtSecret,
  ttlSeconds: config.serviceTokenTtlSeconds,
};

/**
 * invoices_svc cannot read the orders/catalog schemas (cross-schema
 * isolation) - the order (+ its lines) and each SKU's HSN/GST rate are
 * resolved over HTTP instead.
 */
export const orderClient = createOrderClient({
  baseUrl: config.orderServiceUrl,
  timeoutMs: config.serviceHttpTimeoutMs,
  serviceAuth,
});

export const catalogClient = createCatalogClient({
  baseUrl: config.catalogServiceUrl,
  timeoutMs: config.serviceHttpTimeoutMs,
});
