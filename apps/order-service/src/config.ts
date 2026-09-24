import path from 'node:path';
import { z } from 'zod';
import { baseEnvSchema, loadConfigWith } from '@youmart/config';

process.loadEnvFile(path.resolve(__dirname, '../../../.env'));

const orderServiceEnvSchema = baseEnvSchema.extend({
  // Named ORDER_PORT (not PORT): one shared root .env across services.
  ORDER_PORT: z.coerce.number().int().positive().default(4005),
  // Connection string for the least-privilege `orders_svc` Postgres role
  // (Ch2 grants) - scoped to the orders schema only.
  ORDER_DATABASE_URL: z.string().url(),
  // Shared across every service that verifies access tokens.
  JWT_PUBLIC_KEY: z.string().min(1),
  JWT_ISSUER: z.string().default('youmart-auth'),
  JWT_AUDIENCE: z.string().default('youmart'),
  // orders_svc cannot read cart/catalog/inventory schemas (cross-schema
  // isolation) - cart contents, authoritative prices, and stock all come
  // over HTTP via @youmart/service-client.
  CART_SERVICE_URL: z.string().url(),
  CATALOG_SERVICE_URL: z.string().url(),
  INVENTORY_SERVICE_URL: z.string().url(),
  // orders_svc cannot read the sellers schema either (cross-schema
  // isolation) - "is the caller an active seller, and which one" for the
  // seller-scoped order endpoints (Ch5.2) is resolved over HTTP too.
  SELLER_SERVICE_URL: z.string().url(),
  // orders_svc cannot read the addresses schema (cross-schema isolation) -
  // checkout validates + snapshots the caller's chosen shipping address
  // over HTTP via @youmart/service-client (Ch6.1).
  ADDRESS_SERVICE_URL: z.string().url(),
  // orders_svc cannot read the auth schema (cross-schema isolation) -
  // resolving the buyer's email for the order-confirmation notification
  // (Ch6.2) goes over HTTP too.
  AUTH_SERVICE_URL: z.string().url(),
  SERVICE_HTTP_TIMEOUT_MS: z.coerce.number().int().positive().default(5000),
});

const parsed = loadConfigWith(orderServiceEnvSchema);

function decodeBase64Pem(value: string): string {
  return Buffer.from(value, 'base64').toString('utf8');
}

export interface OrderServiceConfig {
  nodeEnv: 'development' | 'test' | 'production';
  databaseUrl: string;
  redisUrl: string;
  logLevel: 'fatal' | 'error' | 'warn' | 'info' | 'debug' | 'trace';
  port: number;
  orderDatabaseUrl: string;
  jwtPublicKey: string;
  jwtIssuer: string;
  jwtAudience: string;
  cartServiceUrl: string;
  catalogServiceUrl: string;
  inventoryServiceUrl: string;
  sellerServiceUrl: string;
  addressServiceUrl: string;
  authServiceUrl: string;
  serviceHttpTimeoutMs: number;
  serviceJwtSecret: string;
  serviceTokenTtlSeconds: number;
}

export const config: Readonly<OrderServiceConfig> = Object.freeze({
  nodeEnv: parsed.NODE_ENV,
  databaseUrl: parsed.DATABASE_URL,
  redisUrl: parsed.REDIS_URL,
  logLevel: parsed.LOG_LEVEL,
  port: parsed.ORDER_PORT,
  orderDatabaseUrl: parsed.ORDER_DATABASE_URL,
  jwtPublicKey: decodeBase64Pem(parsed.JWT_PUBLIC_KEY),
  jwtIssuer: parsed.JWT_ISSUER,
  jwtAudience: parsed.JWT_AUDIENCE,
  cartServiceUrl: parsed.CART_SERVICE_URL,
  catalogServiceUrl: parsed.CATALOG_SERVICE_URL,
  inventoryServiceUrl: parsed.INVENTORY_SERVICE_URL,
  sellerServiceUrl: parsed.SELLER_SERVICE_URL,
  addressServiceUrl: parsed.ADDRESS_SERVICE_URL,
  authServiceUrl: parsed.AUTH_SERVICE_URL,
  serviceHttpTimeoutMs: parsed.SERVICE_HTTP_TIMEOUT_MS,
  serviceJwtSecret: parsed.SERVICE_JWT_SECRET,
  serviceTokenTtlSeconds: parsed.SERVICE_TOKEN_TTL_SECONDS,
});
