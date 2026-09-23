import path from 'node:path';
import { z } from 'zod';
import { baseEnvSchema, loadConfigWith } from '@youmart/config';

process.loadEnvFile(path.resolve(__dirname, '../../../.env'));

const logisticsServiceEnvSchema = baseEnvSchema.extend({
  // Named LOGISTICS_PORT (not PORT): one shared root .env across services.
  LOGISTICS_PORT: z.coerce.number().int().positive().default(4009),
  // Connection string for the `logistics_svc` Postgres role (Ch2 grants,
  // extended by a Ch5.4 migration to ALSO cover the `tracking` schema -
  // see packages/db/prisma/migrations/20260921090000_logistics_svc_tracking_schema_grant.
  // logistics-service manages a shipment AND its tracking timeline as ONE
  // bounded context, so it connects as a SINGLE role rather than running
  // two Prisma clients/connection pools for one process - see
  // logistics-service's README/report for the full rationale.
  LOGISTICS_DATABASE_URL: z.string().url(),
  // Shared across every service that verifies access tokens.
  JWT_PUBLIC_KEY: z.string().min(1),
  JWT_ISSUER: z.string().default('youmart-auth'),
  JWT_AUDIENCE: z.string().default('youmart'),
  // logistics_svc cannot read the orders/sellers schemas (cross-schema
  // isolation) - order-item state/ownership and seller identity/activation
  // come over HTTP via @youmart/service-client.
  ORDER_SERVICE_URL: z.string().url(),
  SELLER_SERVICE_URL: z.string().url(),
  // logistics_svc cannot read the auth schema either (cross-schema
  // isolation) - resolving the buyer's email for the shipping-update
  // notification (Ch6.2) goes over HTTP too.
  AUTH_SERVICE_URL: z.string().url(),
  SERVICE_HTTP_TIMEOUT_MS: z.coerce.number().int().positive().default(5000),
  // Multi-courier FOUNDATION (Ch5.4): selects which registered
  // ShippingProvider handles shipment creation when none is specified.
  // "manual" (ManualProvider) is the ONLY provider at launch - real
  // courier adapters (Delhivery, Shiprocket, etc.) are added post-launch
  // as one-file ShippingProvider implementations, registered under their
  // own name, without any change to this default.
  DEFAULT_SHIPPING_PROVIDER: z.string().default('manual'),
});

const parsed = loadConfigWith(logisticsServiceEnvSchema);

function decodeBase64Pem(value: string): string {
  return Buffer.from(value, 'base64').toString('utf8');
}

export interface LogisticsServiceConfig {
  nodeEnv: 'development' | 'test' | 'production';
  databaseUrl: string;
  redisUrl: string;
  logLevel: 'fatal' | 'error' | 'warn' | 'info' | 'debug' | 'trace';
  port: number;
  logisticsDatabaseUrl: string;
  jwtPublicKey: string;
  jwtIssuer: string;
  jwtAudience: string;
  orderServiceUrl: string;
  sellerServiceUrl: string;
  authServiceUrl: string;
  serviceHttpTimeoutMs: number;
  defaultShippingProvider: string;
  serviceJwtSecret: string;
  serviceTokenTtlSeconds: number;
}

export const config: Readonly<LogisticsServiceConfig> = Object.freeze({
  nodeEnv: parsed.NODE_ENV,
  databaseUrl: parsed.DATABASE_URL,
  redisUrl: parsed.REDIS_URL,
  logLevel: parsed.LOG_LEVEL,
  port: parsed.LOGISTICS_PORT,
  logisticsDatabaseUrl: parsed.LOGISTICS_DATABASE_URL,
  jwtPublicKey: decodeBase64Pem(parsed.JWT_PUBLIC_KEY),
  jwtIssuer: parsed.JWT_ISSUER,
  jwtAudience: parsed.JWT_AUDIENCE,
  orderServiceUrl: parsed.ORDER_SERVICE_URL,
  sellerServiceUrl: parsed.SELLER_SERVICE_URL,
  authServiceUrl: parsed.AUTH_SERVICE_URL,
  serviceHttpTimeoutMs: parsed.SERVICE_HTTP_TIMEOUT_MS,
  defaultShippingProvider: parsed.DEFAULT_SHIPPING_PROVIDER,
  serviceJwtSecret: parsed.SERVICE_JWT_SECRET,
  serviceTokenTtlSeconds: parsed.SERVICE_TOKEN_TTL_SECONDS,
});
