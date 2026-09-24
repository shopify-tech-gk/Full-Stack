import path from 'node:path';
import { z } from 'zod';
import { baseEnvSchema, loadConfigWith } from '@youmart/config';

process.loadEnvFile(path.resolve(__dirname, '../../../.env'));

const settlementServiceEnvSchema = baseEnvSchema.extend({
  // Named SETTLEMENT_PORT (not PORT): one shared root .env across services.
  SETTLEMENT_PORT: z.coerce.number().int().positive().default(4008),
  // Connection string for the least-privilege `settlements_svc` Postgres
  // role (Ch2 grants) - scoped to the settlements schema only.
  SETTLEMENT_DATABASE_URL: z.string().url(),
  // Shared across every service that verifies access tokens.
  JWT_PUBLIC_KEY: z.string().min(1),
  JWT_ISSUER: z.string().default('youmart-auth'),
  JWT_AUDIENCE: z.string().default('youmart'),
  // settlements_svc cannot read the orders/sellers schemas (cross-schema
  // isolation) - settleable items and seller identity/commission rate come
  // over HTTP via @youmart/service-client.
  ORDER_SERVICE_URL: z.string().url(),
  SELLER_SERVICE_URL: z.string().url(),
  // Ch6.7b: commission/TCS/TDS rules now come from admin-service (the
  // authoritative platform settings row), via @youmart/service-client's
  // settings client (cached) - no longer this service's own env vars.
  ADMIN_SERVICE_URL: z.string().url(),
  SERVICE_HTTP_TIMEOUT_MS: z.coerce.number().int().positive().default(5000),

  // Cron pattern (BullMQ/node-cron syntax) for the repeatable weekly
  // settlement-run job - config-driven so dev can use a short interval
  // without a code change. Default: every Monday at 00:00.
  SETTLEMENT_SCHEDULE_CRON: z.string().default('0 0 * * 1'),
});

const parsed = loadConfigWith(settlementServiceEnvSchema);

function decodeBase64Pem(value: string): string {
  return Buffer.from(value, 'base64').toString('utf8');
}

export interface SettlementServiceConfig {
  nodeEnv: 'development' | 'test' | 'production';
  databaseUrl: string;
  redisUrl: string;
  logLevel: 'fatal' | 'error' | 'warn' | 'info' | 'debug' | 'trace';
  port: number;
  settlementDatabaseUrl: string;
  jwtPublicKey: string;
  jwtIssuer: string;
  jwtAudience: string;
  orderServiceUrl: string;
  sellerServiceUrl: string;
  adminServiceUrl: string;
  serviceHttpTimeoutMs: number;
  settlementScheduleCron: string;
  serviceJwtSecret: string;
  serviceTokenTtlSeconds: number;
}

export const config: Readonly<SettlementServiceConfig> = Object.freeze({
  nodeEnv: parsed.NODE_ENV,
  databaseUrl: parsed.DATABASE_URL,
  redisUrl: parsed.REDIS_URL,
  logLevel: parsed.LOG_LEVEL,
  port: parsed.SETTLEMENT_PORT,
  settlementDatabaseUrl: parsed.SETTLEMENT_DATABASE_URL,
  jwtPublicKey: decodeBase64Pem(parsed.JWT_PUBLIC_KEY),
  jwtIssuer: parsed.JWT_ISSUER,
  jwtAudience: parsed.JWT_AUDIENCE,
  orderServiceUrl: parsed.ORDER_SERVICE_URL,
  sellerServiceUrl: parsed.SELLER_SERVICE_URL,
  adminServiceUrl: parsed.ADMIN_SERVICE_URL,
  serviceHttpTimeoutMs: parsed.SERVICE_HTTP_TIMEOUT_MS,
  settlementScheduleCron: parsed.SETTLEMENT_SCHEDULE_CRON,
  serviceJwtSecret: parsed.SERVICE_JWT_SECRET,
  serviceTokenTtlSeconds: parsed.SERVICE_TOKEN_TTL_SECONDS,
});
