import { createSellerClient, type ServiceAuthOptions } from '@youmart/service-client';
import { config } from './config';

// Ch6.5 - self-minted short-lived service token attached to every internal
// call below (never a forwarded user token).
const serviceAuth: ServiceAuthOptions = {
  callerServiceName: 'catalog-service',
  serviceSecret: config.serviceJwtSecret,
  ttlSeconds: config.serviceTokenTtlSeconds,
};

/**
 * catalog_svc cannot read the sellers schema (cross-schema isolation) -
 * seller identity/activation is resolved over HTTP instead (Ch5.2).
 */
export const sellerClient = createSellerClient({
  baseUrl: config.sellerServiceUrl,
  timeoutMs: config.serviceHttpTimeoutMs,
  serviceAuth,
});
