import path from 'node:path';
import { z } from 'zod';
import { baseEnvSchema, loadConfigWith } from '@youmart/config';

process.loadEnvFile(path.resolve(__dirname, '../../../.env'));

const returnsServiceEnvSchema = baseEnvSchema.extend({
  // Named RETURNS_PORT (not PORT): one shared root .env across services.
  RETURNS_PORT: z.coerce.number().int().positive().default(4010),
  // Connection string for the least-privilege `returns_svc` Postgres role
  // (Ch2 grants) - scoped to the returns schema only.
  RETURNS_DATABASE_URL: z.string().url(),
  // Shared across every service that verifies access tokens.
  JWT_PUBLIC_KEY: z.string().min(1),
  JWT_ISSUER: z.string().default('youmart-auth'),
  JWT_AUDIENCE: z.string().default('youmart'),
  // returns_svc cannot read orders/payments/inventory schemas
  // (cross-schema isolation) - order-item state, refunds, and stock all
  // come over HTTP via @youmart/service-client.
  ORDER_SERVICE_URL: z.string().url(),
  PAYMENT_SERVICE_URL: z.string().url(),
  INVENTORY_SERVICE_URL: z.string().url(),
  SERVICE_HTTP_TIMEOUT_MS: z.coerce.number().int().positive().default(5000),
  // TEMPORARY dev-only admin authorization gate for the return-management
  // endpoints - same pattern (and, in dev, the same list) as every other
  // service's ADMIN_USER_IDS. For launch (single-vendor), admin handles
  // every return - see returns.service.ts's seller-side foundation note.
  ADMIN_USER_IDS: z.string().default(''),
  // A DELIVERED item is returnable only within this many days of delivery
  // (delivered timestamp approximated by order_item.updated_at, same
  // proxy used by settlement-service's DELIVERED-detection, Ch5.3).
  RETURN_WINDOW_DAYS: z.coerce.number().int().positive().default(7),
});

const parsed = loadConfigWith(returnsServiceEnvSchema);

function decodeBase64Pem(value: string): string {
  return Buffer.from(value, 'base64').toString('utf8');
}

function parseAdminUserIds(value: string): string[] {
  return value
    .split(',')
    .map((id) => id.trim())
    .filter((id) => id.length > 0);
}

export interface ReturnsServiceConfig {
  nodeEnv: 'development' | 'test' | 'production';
  databaseUrl: string;
  redisUrl: string;
  logLevel: 'fatal' | 'error' | 'warn' | 'info' | 'debug' | 'trace';
  port: number;
  returnsDatabaseUrl: string;
  jwtPublicKey: string;
  jwtIssuer: string;
  jwtAudience: string;
  orderServiceUrl: string;
  paymentServiceUrl: string;
  inventoryServiceUrl: string;
  serviceHttpTimeoutMs: number;
  adminUserIds: string[];
  returnWindowDays: number;
}

export const config: Readonly<ReturnsServiceConfig> = Object.freeze({
  nodeEnv: parsed.NODE_ENV,
  databaseUrl: parsed.DATABASE_URL,
  redisUrl: parsed.REDIS_URL,
  logLevel: parsed.LOG_LEVEL,
  port: parsed.RETURNS_PORT,
  returnsDatabaseUrl: parsed.RETURNS_DATABASE_URL,
  jwtPublicKey: decodeBase64Pem(parsed.JWT_PUBLIC_KEY),
  jwtIssuer: parsed.JWT_ISSUER,
  jwtAudience: parsed.JWT_AUDIENCE,
  orderServiceUrl: parsed.ORDER_SERVICE_URL,
  paymentServiceUrl: parsed.PAYMENT_SERVICE_URL,
  inventoryServiceUrl: parsed.INVENTORY_SERVICE_URL,
  serviceHttpTimeoutMs: parsed.SERVICE_HTTP_TIMEOUT_MS,
  adminUserIds: parseAdminUserIds(parsed.ADMIN_USER_IDS),
  returnWindowDays: parsed.RETURN_WINDOW_DAYS,
});
