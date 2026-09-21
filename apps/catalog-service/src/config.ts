import path from 'node:path';
import { z } from 'zod';
import { baseEnvSchema, loadConfigWith } from '@youmart/config';

// Repo-root .env is the single source of truth (same pattern as
// auth-service's src/config.ts). Resolved from __dirname so it works from
// both src (dev, via tsx) and dist (built, via node) - both live 3 levels
// under the repo root.
process.loadEnvFile(path.resolve(__dirname, '../../../.env'));

const catalogServiceEnvSchema = baseEnvSchema.extend({
  // Named CATALOG_PORT (not PORT): this repo loads ONE shared root .env
  // across every service, and auth-service already occupies "PORT=4001" in
  // that same file - a plain "PORT" key here would silently read auth's
  // value instead of falling back to this service's own default.
  CATALOG_PORT: z.coerce.number().int().positive().default(4002),
  // Connection string for the least-privilege `catalog_svc` Postgres role
  // (Ch2 grants) - deliberately separate from the owner DATABASE_URL.
  CATALOG_DATABASE_URL: z.string().url(),
  // Shared across every service that verifies access tokens - the same
  // values the auth service itself signs with (docs/contracts/auth-api.md).
  // Stored base64-encoded on a single line (same approach auth-service
  // uses for its keys), decoded below.
  JWT_PUBLIC_KEY: z.string().min(1),
  JWT_ISSUER: z.string().default('youmart-auth'),
  JWT_AUDIENCE: z.string().default('youmart'),
  // Prepended to stored image paths/keys to build absolute URLs - never a
  // hardcoded CDN domain in code.
  CDN_BASE_URL: z.string().url(),
  // Hard-off multivendor: sellers can't register yet, so every product
  // created here is owned by this one default seller. catalog_svc cannot
  // read the sellers schema (cross-schema isolation), so this id is
  // injected via env rather than looked up - looked up once via the owner
  // role, see apps/catalog-service/README.md.
  DEFAULT_SELLER_ID: z.string().uuid(),
  // Injected for now because catalog_svc cannot read admin.marketplace_settings.
  // Ch6 replaces this with a real lookup/cache once the admin schema and
  // seller registration exist - today it's always DISABLED (hard-off).
  MARKETPLACE_MODE: z.enum(['ENABLED', 'DISABLED']).default('DISABLED'),
  // TEMPORARY dev-only catalog-write authorization gate: comma-separated
  // user ids allowed to manage the catalog. There is no admin/role claim
  // on access tokens yet - real RBAC replaces this in Ch6.
  ADMIN_USER_IDS: z.string().default(''),
});

const parsed = loadConfigWith(catalogServiceEnvSchema);

function decodeBase64Pem(value: string): string {
  return Buffer.from(value, 'base64').toString('utf8');
}

function parseAdminUserIds(value: string): string[] {
  return value
    .split(',')
    .map((id) => id.trim())
    .filter((id) => id.length > 0);
}

export interface CatalogServiceConfig {
  nodeEnv: 'development' | 'test' | 'production';
  databaseUrl: string;
  redisUrl: string;
  logLevel: 'fatal' | 'error' | 'warn' | 'info' | 'debug' | 'trace';
  port: number;
  catalogDatabaseUrl: string;
  jwtPublicKey: string;
  jwtIssuer: string;
  jwtAudience: string;
  cdnBaseUrl: string;
  defaultSellerId: string;
  marketplaceMode: 'ENABLED' | 'DISABLED';
  adminUserIds: string[];
}

export const config: Readonly<CatalogServiceConfig> = Object.freeze({
  nodeEnv: parsed.NODE_ENV,
  databaseUrl: parsed.DATABASE_URL,
  redisUrl: parsed.REDIS_URL,
  logLevel: parsed.LOG_LEVEL,
  port: parsed.CATALOG_PORT,
  catalogDatabaseUrl: parsed.CATALOG_DATABASE_URL,
  jwtPublicKey: decodeBase64Pem(parsed.JWT_PUBLIC_KEY),
  jwtIssuer: parsed.JWT_ISSUER,
  jwtAudience: parsed.JWT_AUDIENCE,
  cdnBaseUrl: parsed.CDN_BASE_URL,
  defaultSellerId: parsed.DEFAULT_SELLER_ID,
  marketplaceMode: parsed.MARKETPLACE_MODE,
  adminUserIds: parseAdminUserIds(parsed.ADMIN_USER_IDS),
});
