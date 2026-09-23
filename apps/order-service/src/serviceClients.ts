import {
  createCartClient,
  createCatalogClient,
  createInventoryClient,
  createSellerClient,
  createAddressClient,
  createAuthClient,
  type ServiceAuthOptions,
} from '@youmart/service-client';
import { config } from './config';

// Ch6.5 - self-minted short-lived service token attached to every internal
// call below (never a forwarded user token).
const serviceAuth: ServiceAuthOptions = {
  callerServiceName: 'order-service',
  serviceSecret: config.serviceJwtSecret,
  ttlSeconds: config.serviceTokenTtlSeconds,
};

export const cartClient = createCartClient({
  baseUrl: config.cartServiceUrl,
  timeoutMs: config.serviceHttpTimeoutMs,
  serviceAuth,
});

export const catalogClient = createCatalogClient({
  baseUrl: config.catalogServiceUrl,
  timeoutMs: config.serviceHttpTimeoutMs,
});

export const inventoryClient = createInventoryClient({
  baseUrl: config.inventoryServiceUrl,
  timeoutMs: config.serviceHttpTimeoutMs,
  serviceAuth,
});

// orders_svc cannot read the sellers schema (cross-schema isolation) -
// seller identity/activation for the seller-scoped order endpoints (Ch5.2)
// is resolved over HTTP instead.
export const sellerClient = createSellerClient({
  baseUrl: config.sellerServiceUrl,
  timeoutMs: config.serviceHttpTimeoutMs,
  serviceAuth,
});

// orders_svc cannot read the addresses schema (cross-schema isolation) -
// checkout validates + snapshots the caller's chosen shipping address over
// HTTP instead (Ch6.1).
export const addressClient = createAddressClient({
  baseUrl: config.addressServiceUrl,
  timeoutMs: config.serviceHttpTimeoutMs,
  serviceAuth,
});

// orders_svc cannot read the auth schema (cross-schema isolation) -
// resolving the buyer's email for the order-confirmation notification
// (Ch6.2) goes over HTTP instead.
export const authClient = createAuthClient({
  baseUrl: config.authServiceUrl,
  timeoutMs: config.serviceHttpTimeoutMs,
  serviceAuth,
});
