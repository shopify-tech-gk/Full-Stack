import {
  createOrderClient,
  createSellerClient,
  createSettingsClient,
  type ServiceAuthOptions,
} from '@youmart/service-client';
import { config } from './config';

// Ch6.5 - self-minted short-lived service token attached to every internal
// call below (never a forwarded user token - closes the scheduled-job gap,
// see settlement.queue.ts's updated doc comment).
const serviceAuth: ServiceAuthOptions = {
  callerServiceName: 'settlement-service',
  serviceSecret: config.serviceJwtSecret,
  ttlSeconds: config.serviceTokenTtlSeconds,
};

/**
 * settlements_svc cannot read the orders/sellers schemas (cross-schema
 * isolation) - settleable items and seller identity/commission rate are
 * resolved over HTTP instead.
 */
export const orderClient = createOrderClient({
  baseUrl: config.orderServiceUrl,
  timeoutMs: config.serviceHttpTimeoutMs,
  serviceAuth,
});

export const sellerClient = createSellerClient({
  baseUrl: config.sellerServiceUrl,
  timeoutMs: config.serviceHttpTimeoutMs,
  serviceAuth,
});

// Ch6.7b - commission/TCS/TDS rules (getSettlementRules()) now come from
// here instead of env - cached client-side (default 30s TTL).
export const settingsClient = createSettingsClient({
  baseUrl: config.adminServiceUrl,
  timeoutMs: config.serviceHttpTimeoutMs,
  serviceAuth,
});
