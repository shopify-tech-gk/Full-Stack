import path from 'node:path';
import { z } from 'zod';
import { baseEnvSchema, loadConfigWith } from '@youmart/config';

process.loadEnvFile(path.resolve(__dirname, '../../../.env'));

const cartServiceEnvSchema = baseEnvSchema.extend({
  // Named CART_PORT (not PORT): one shared root .env across services.
  CART_PORT: z.coerce.number().int().positive().default(4004),
  // Connection string for the least-privilege `cart_svc` Postgres role
  // (Ch2 grants) - scoped to the cart schema only.
  CART_DATABASE_URL: z.string().url(),
  // Shared across every service that verifies access tokens.
  JWT_PUBLIC_KEY: z.string().min(1),
  JWT_ISSUER: z.string().default('youmart-auth'),
  JWT_AUDIENCE: z.string().default('youmart'),
  // cart_svc cannot read catalog/inventory schemas (cross-schema isolation)
  // - SKU/price and stock data come over HTTP via @youmart/service-client.
  CATALOG_SERVICE_URL: z.string().url(),
  INVENTORY_SERVICE_URL: z.string().url(),
  SERVICE_HTTP_TIMEOUT_MS: z.coerce.number().int().positive().default(5000),
});

const parsed = loadConfigWith(cartServiceEnvSchema);

function decodeBase64Pem(value: string): string {
  return Buffer.from(value, 'base64').toString('utf8');
}

export interface CartServiceConfig {
  nodeEnv: 'development' | 'test' | 'production';
  databaseUrl: string;
  redisUrl: string;
  logLevel: 'fatal' | 'error' | 'warn' | 'info' | 'debug' | 'trace';
  port: number;
  cartDatabaseUrl: string;
  jwtPublicKey: string;
  jwtIssuer: string;
  jwtAudience: string;
  catalogServiceUrl: string;
  inventoryServiceUrl: string;
  serviceHttpTimeoutMs: number;
  serviceJwtSecret: string;
  serviceTokenTtlSeconds: number;
}

export const config: Readonly<CartServiceConfig> = Object.freeze({
  nodeEnv: parsed.NODE_ENV,
  databaseUrl: parsed.DATABASE_URL,
  redisUrl: parsed.REDIS_URL,
  logLevel: parsed.LOG_LEVEL,
  port: parsed.CART_PORT,
  cartDatabaseUrl: parsed.CART_DATABASE_URL,
  jwtPublicKey: decodeBase64Pem(parsed.JWT_PUBLIC_KEY),
  jwtIssuer: parsed.JWT_ISSUER,
  jwtAudience: parsed.JWT_AUDIENCE,
  catalogServiceUrl: parsed.CATALOG_SERVICE_URL,
  inventoryServiceUrl: parsed.INVENTORY_SERVICE_URL,
  serviceHttpTimeoutMs: parsed.SERVICE_HTTP_TIMEOUT_MS,
  serviceJwtSecret: parsed.SERVICE_JWT_SECRET,
  serviceTokenTtlSeconds: parsed.SERVICE_TOKEN_TTL_SECONDS,
});
