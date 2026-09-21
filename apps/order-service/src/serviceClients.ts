import {
  createCartClient,
  createCatalogClient,
  createInventoryClient,
  createSellerClient,
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
