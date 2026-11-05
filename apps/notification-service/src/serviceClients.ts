import {
  createAuthClient,
  createCartClient,
  createCatalogClient,
  createOrderClient,
  createSearchClient,
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

/** v1.18 cart nudge: what's still in the customer's cart. */
export const cartClient = createCartClient({
  baseUrl: config.cartServiceUrl,
  timeoutMs: config.serviceHttpTimeoutMs,
  serviceAuth,
});

/** v1.18 buy reminders: the product's name and price (public endpoints - no service token). */
export const catalogClient = createCatalogClient({
  baseUrl: config.catalogServiceUrl,
  timeoutMs: config.serviceHttpTimeoutMs,
});

/** v1.17 YouMart AI: finds real products for shopping questions ("what do I need for a trip?"). */
export const searchClient = createSearchClient({
  baseUrl: config.searchServiceUrl,
  timeoutMs: config.serviceHttpTimeoutMs,
  serviceAuth,
});
