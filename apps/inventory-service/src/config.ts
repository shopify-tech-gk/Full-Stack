import path from 'node:path';
import { z } from 'zod';
import { baseEnvSchema, loadConfigWith } from '@youmart/config';

process.loadEnvFile(path.resolve(__dirname, '../../../.env'));

const inventoryServiceEnvSchema = baseEnvSchema.extend({
  // Named INVENTORY_PORT (not PORT): one shared root .env across services,
  // auth already owns PORT=4001 and catalog CATALOG_PORT=4002.
  INVENTORY_PORT: z.coerce.number().int().positive().default(4003),
  // Connection string for the least-privilege `inventory_svc` Postgres role
  // (Ch2 grants) - deliberately separate from the owner DATABASE_URL.
  INVENTORY_DATABASE_URL: z.string().url(),
  // Shared across every service that verifies access tokens.
  JWT_PUBLIC_KEY: z.string().min(1),
  JWT_ISSUER: z.string().default('youmart-auth'),
  JWT_AUDIENCE: z.string().default('youmart'),
});

const parsed = loadConfigWith(inventoryServiceEnvSchema);

function decodeBase64Pem(value: string): string {
  return Buffer.from(value, 'base64').toString('utf8');
}

export interface InventoryServiceConfig {
  nodeEnv: 'development' | 'test' | 'production';
  databaseUrl: string;
  redisUrl: string;
  logLevel: 'fatal' | 'error' | 'warn' | 'info' | 'debug' | 'trace';
  port: number;
  inventoryDatabaseUrl: string;
  jwtPublicKey: string;
  jwtIssuer: string;
  jwtAudience: string;
  serviceJwtSecret: string;
  serviceTokenTtlSeconds: number;
}

export const config: Readonly<InventoryServiceConfig> = Object.freeze({
  nodeEnv: parsed.NODE_ENV,
  databaseUrl: parsed.DATABASE_URL,
  redisUrl: parsed.REDIS_URL,
  logLevel: parsed.LOG_LEVEL,
  port: parsed.INVENTORY_PORT,
  inventoryDatabaseUrl: parsed.INVENTORY_DATABASE_URL,
  jwtPublicKey: decodeBase64Pem(parsed.JWT_PUBLIC_KEY),
  jwtIssuer: parsed.JWT_ISSUER,
  jwtAudience: parsed.JWT_AUDIENCE,
  serviceJwtSecret: parsed.SERVICE_JWT_SECRET,
  serviceTokenTtlSeconds: parsed.SERVICE_TOKEN_TTL_SECONDS,
});
