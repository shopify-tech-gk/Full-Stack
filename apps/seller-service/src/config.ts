import path from 'node:path';
import { z } from 'zod';
import { baseEnvSchema, loadConfigWith } from '@youmart/config';

// Repo-root .env is the single source of truth (same pattern as every
// other service's src/config.ts). Resolved from __dirname so it works from
// both src (dev, via tsx) and dist (built, via node) - both live 3 levels
// under the repo root.
process.loadEnvFile(path.resolve(__dirname, '../../../.env'));

const sellerServiceEnvSchema = baseEnvSchema.extend({
  // Named SELLER_PORT (not PORT): this repo loads ONE shared root .env
  // across every service, and other services already occupy PORT/other
  // *_PORT keys in that same file.
  SELLER_PORT: z.coerce.number().int().positive().default(4007),
  // Connection string for the least-privilege `sellers_svc` Postgres role
  // (Ch2 grants) - deliberately separate from the owner DATABASE_URL.
  SELLER_DATABASE_URL: z.string().url(),
  // Shared across every service that verifies access tokens - the same
  // values the auth service itself signs with (docs/contracts/auth-api.md).
  JWT_PUBLIC_KEY: z.string().min(1),
  JWT_ISSUER: z.string().default('youmart-auth'),
  JWT_AUDIENCE: z.string().default('youmart'),
  // Injected for now because sellers_svc cannot read admin.marketplace_settings
  // (cross-schema isolation). Ch6's admin service replaces this with a real
  // source of truth once it exists - today it's always DISABLED (hard-off),
  // so self-registration is blocked and only the seeded default seller sells.
  MARKETPLACE_MODE: z.enum(['ENABLED', 'DISABLED']).default('DISABLED'),
  // Default commission applied to a newly-registered (non-default) seller,
  // as a "0.00".."100.00" decimal string - Decimal(5,2) at the DB layer.
  DEFAULT_COMMISSION_PERCENT: z
    .string()
    .regex(/^\d{1,3}\.\d{2}$/)
    .default('10.00'),
  // HMAC key for hashing bank account numbers before they ever reach the
  // database - same discipline as auth-service's OTP_HASH_SECRET (a stolen
  // hash is useless without this server-side secret; keeps verification
  // possible without ever persisting/logging the raw number).
  BANK_ACCOUNT_HASH_SECRET: z.string().min(1),
});

const parsed = loadConfigWith(sellerServiceEnvSchema);

function decodeBase64Pem(value: string): string {
  return Buffer.from(value, 'base64').toString('utf8');
}

export interface SellerServiceConfig {
  nodeEnv: 'development' | 'test' | 'production';
  databaseUrl: string;
  redisUrl: string;
  logLevel: 'fatal' | 'error' | 'warn' | 'info' | 'debug' | 'trace';
  port: number;
  sellerDatabaseUrl: string;
  jwtPublicKey: string;
  jwtIssuer: string;
  jwtAudience: string;
  marketplaceMode: 'ENABLED' | 'DISABLED';
  defaultCommissionPercent: string;
  bankAccountHashSecret: string;
  serviceJwtSecret: string;
  serviceTokenTtlSeconds: number;
}

export const config: Readonly<SellerServiceConfig> = Object.freeze({
  nodeEnv: parsed.NODE_ENV,
  databaseUrl: parsed.DATABASE_URL,
  redisUrl: parsed.REDIS_URL,
  logLevel: parsed.LOG_LEVEL,
  port: parsed.SELLER_PORT,
  sellerDatabaseUrl: parsed.SELLER_DATABASE_URL,
  jwtPublicKey: decodeBase64Pem(parsed.JWT_PUBLIC_KEY),
  jwtIssuer: parsed.JWT_ISSUER,
  jwtAudience: parsed.JWT_AUDIENCE,
  marketplaceMode: parsed.MARKETPLACE_MODE,
  defaultCommissionPercent: parsed.DEFAULT_COMMISSION_PERCENT,
  bankAccountHashSecret: parsed.BANK_ACCOUNT_HASH_SECRET,
  serviceJwtSecret: parsed.SERVICE_JWT_SECRET,
  serviceTokenTtlSeconds: parsed.SERVICE_TOKEN_TTL_SECONDS,
});
