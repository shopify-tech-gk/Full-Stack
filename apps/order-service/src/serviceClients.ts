import {
  createCartClient,
  createCatalogClient,
  createInventoryClient,
  createSellerClient,
  createAddressClient,
} from '@youmart/service-client';
import { config } from './config';

export const cartClient = createCartClient({
  baseUrl: config.cartServiceUrl,
  timeoutMs: config.serviceHttpTimeoutMs,
});

export const catalogClient = createCatalogClient({
  baseUrl: config.catalogServiceUrl,
  timeoutMs: config.serviceHttpTimeoutMs,
});

export const inventoryClient = createInventoryClient({
  baseUrl: config.inventoryServiceUrl,
  timeoutMs: config.serviceHttpTimeoutMs,
});

// orders_svc cannot read the sellers schema (cross-schema isolation) -
// seller identity/activation for the seller-scoped order endpoints (Ch5.2)
// is resolved over HTTP instead.
export const sellerClient = createSellerClient({
  baseUrl: config.sellerServiceUrl,
  timeoutMs: config.serviceHttpTimeoutMs,
});

// orders_svc cannot read the addresses schema (cross-schema isolation) -
// checkout validates + snapshots the caller's chosen shipping address over
// HTTP instead (Ch6.1).
export const addressClient = createAddressClient({
  baseUrl: config.addressServiceUrl,
  timeoutMs: config.serviceHttpTimeoutMs,
});
