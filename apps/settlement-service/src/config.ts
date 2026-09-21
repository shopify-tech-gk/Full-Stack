import path from 'node:path';
import { z } from 'zod';
import { baseEnvSchema, loadConfigWith } from '@youmart/config';

process.loadEnvFile(path.resolve(__dirname, '../../../.env'));

// Percent strings, not numbers - fed straight into @youmart/shared-utils'
// percentageOf(amount, ratePercent), which validates them itself; kept as
// plain z.string() here (no numeric coercion) so "10.00" round-trips
// exactly rather than through a JS number.
const PercentString = z.string().min(1);

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
  SERVICE_HTTP_TIMEOUT_MS: z.coerce.number().int().positive().default(5000),
  // TEMPORARY dev-only admin authorization gate for the settlement-run/list
  // endpoints - same pattern (and, in dev, the same list) as every other
  // service's ADMIN_USER_IDS. Real RBAC replaces this in Ch6.
  ADMIN_USER_IDS: z.string().default(''),

  // --- Settlement rules (Ch5.3) - TEMPORARY env-backed settings. Each
  // component is an independent enabled/disabled TOGGLE + a PERCENTAGE,
  // read via getSettlementRules() (settlement.service.ts) rather than
  // scattered `config.x` reads directly in the engine - this indirection
  // is what lets Ch6's admin dashboard swap the SOURCE (a real settings
  // table + toggle UI) for these env vars without changing a single line
  // of the settlement math itself.
  //
  // NOTE on booleans: z.coerce.boolean() is NOT used - it calls JS
  // `Boolean(value)`, so the STRING "false" would coerce to `true` (any
  // non-empty string is truthy). Comparing against the literal string
  // "true" instead (same pattern as auth-service's COOKIE_SECURE).
  COMMISSION_ENABLED: z
    .string()
    .default('true')
    .transform((v) => v === 'true'),
  // Applied only when the seller has no resolvable rate of their own -
  // in practice every seller always has one (default 10.00 at
  // registration, see 5.1), so this is a defensive platform-wide fallback,
  // not the normal path.
  COMMISSION_DEFAULT_PERCENT: PercentString.default('10.00'),
  TCS_ENABLED: z
    .string()
    .default('true')
    .transform((v) => v === 'true'),
  TCS_PERCENT: PercentString.default('1.00'),
  TDS_ENABLED: z
    .string()
    .default('false')
    .transform((v) => v === 'true'),
  TDS_PERCENT: PercentString.default('0.00'),
  // Cron pattern (BullMQ/node-cron syntax) for the repeatable weekly
  // settlement-run job - config-driven so dev can use a short interval
  // without a code change. Default: every Monday at 00:00.
  SETTLEMENT_SCHEDULE_CRON: z.string().default('0 0 * * 1'),
});

const parsed = loadConfigWith(settlementServiceEnvSchema);

function decodeBase64Pem(value: string): string {
  return Buffer.from(value, 'base64').toString('utf8');
}

function parseAdminUserIds(value: string): string[] {
  return value
    .split(',')
    .map((id) => id.trim())
    .filter((id) => id.length > 0);
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
  serviceHttpTimeoutMs: number;
  adminUserIds: string[];
  commissionEnabled: boolean;
  commissionDefaultPercent: string;
  tcsEnabled: boolean;
  tcsPercent: string;
  tdsEnabled: boolean;
  tdsPercent: string;
  settlementScheduleCron: string;
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
  serviceHttpTimeoutMs: parsed.SERVICE_HTTP_TIMEOUT_MS,
  adminUserIds: parseAdminUserIds(parsed.ADMIN_USER_IDS),
  commissionEnabled: parsed.COMMISSION_ENABLED,
  commissionDefaultPercent: parsed.COMMISSION_DEFAULT_PERCENT,
  tcsEnabled: parsed.TCS_ENABLED,
  tcsPercent: parsed.TCS_PERCENT,
  tdsEnabled: parsed.TDS_ENABLED,
  tdsPercent: parsed.TDS_PERCENT,
  settlementScheduleCron: parsed.SETTLEMENT_SCHEDULE_CRON,
});
