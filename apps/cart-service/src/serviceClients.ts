import { createCatalogClient, createInventoryClient } from '@youmart/service-client';
import { config } from './config';

export const catalogClient = createCatalogClient({
  baseUrl: config.catalogServiceUrl,
  timeoutMs: config.serviceHttpTimeoutMs,
});

export const inventoryClient = createInventoryClient({
  baseUrl: config.inventoryServiceUrl,
  timeoutMs: config.serviceHttpTimeoutMs,
});
