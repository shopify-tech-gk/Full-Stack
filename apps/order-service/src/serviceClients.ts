import {
  createCartClient,
  createCatalogClient,
  createInventoryClient,
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

// Not called yet in 4.5a (see TODO(4.5b) in order.service.ts) - constructed
// now so 4.5b only has to add the reserve() calls, not new plumbing.
export const inventoryClient = createInventoryClient({
  baseUrl: config.inventoryServiceUrl,
  timeoutMs: config.serviceHttpTimeoutMs,
});
