import { createSellerClient } from '@youmart/service-client';
import { config } from './config';

/**
 * catalog_svc cannot read the sellers schema (cross-schema isolation) -
 * seller identity/activation is resolved over HTTP instead (Ch5.2).
 */
export const sellerClient = createSellerClient({
  baseUrl: config.sellerServiceUrl,
  timeoutMs: config.serviceHttpTimeoutMs,
});
