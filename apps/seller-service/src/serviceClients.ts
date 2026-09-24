import { createSettingsClient, type ServiceAuthOptions } from '@youmart/service-client';
import { config } from './config';

// Ch6.5 - self-minted short-lived service token attached to every internal
// call below (never a forwarded user token).
const serviceAuth: ServiceAuthOptions = {
  callerServiceName: 'seller-service',
  serviceSecret: config.serviceJwtSecret,
  ttlSeconds: config.serviceTokenTtlSeconds,
};

// Ch6.7b - the hard-off gate (marketplace-gate.ts) reads marketplace_mode
// from here instead of the retired MARKETPLACE_MODE env - cached
// client-side (default 30s TTL).
export const settingsClient = createSettingsClient({
  baseUrl: config.adminServiceUrl,
  serviceAuth,
});
