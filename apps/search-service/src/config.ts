import path from 'node:path';
import { z } from 'zod';
import { loadConfigWith } from '@youmart/config';

process.loadEnvFile(path.resolve(__dirname, '../../../.env'));

/**
 * search-service is the ONE service in this repo that is NOT a Postgres
 * client - it owns no schema, has no `_svc` role, and never imports
 * `@youmart/db`. Postgres (via catalog-service) is the source of truth;
 * Typesense here is a rebuildable, derived read model. Consequently this
 * does NOT extend `@youmart/config`'s `baseEnvSchema` (which requires
 * `DATABASE_URL`) - it defines its own minimal schema instead, reusing
 * only `loadConfigWith`'s generic validate-and-freeze helper.
 */
const searchServiceEnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
  REDIS_URL: z.string().url(),
  // Named SEARCH_PORT (not PORT): one shared root .env across services.
  SEARCH_PORT: z.coerce.number().int().positive().default(4013),
  TYPESENSE_HOST: z.string().min(1).default('localhost'),
  TYPESENSE_PORT: z.coerce.number().int().positive().default(8108),
  TYPESENSE_PROTOCOL: z.enum(['http', 'https']).default('http'),
  TYPESENSE_API_KEY: z.string().min(1),
  // catalog-service is the source of truth this service reads FROM (never
  // the other way around) - product data for indexing comes over HTTP.
  CATALOG_SERVICE_URL: z.string().url(),
  // Shared across every service that verifies access tokens - used only by
  // the admin manual-reindex-trigger endpoint (the public search/suggest
  // endpoints are unauthenticated/optionalAuth).
  JWT_PUBLIC_KEY: z.string().min(1),
  JWT_ISSUER: z.string().default('youmart-auth'),
  JWT_AUDIENCE: z.string().default('youmart'),
  SERVICE_HTTP_TIMEOUT_MS: z.coerce.number().int().positive().default(5000),
  // Cron pattern (BullMQ repeatable job) for the nightly full-reindex
  // safety net - config-driven so dev can use a short interval without a
  // code change. Default: 2 AM daily.
  FULL_REINDEX_SCHEDULE_CRON: z.string().default('0 2 * * *'),
  // Ch6.5: shared symmetric secret for self-minted service-to-service
  // HS256 tokens - DEDICATED, separate from the JWT_PUBLIC_KEY above (not
  // part of baseEnvSchema here since this service defines its own schema).
  SERVICE_JWT_SECRET: z.string().min(32),
  SERVICE_TOKEN_TTL_SECONDS: z.coerce.number().int().positive().default(300),
});

const parsed = loadConfigWith(searchServiceEnvSchema);

function decodeBase64Pem(value: string): string {
  return Buffer.from(value, 'base64').toString('utf8');
}

export interface SearchServiceConfig {
  nodeEnv: 'development' | 'test' | 'production';
  logLevel: 'fatal' | 'error' | 'warn' | 'info' | 'debug' | 'trace';
  redisUrl: string;
  port: number;
  typesenseHost: string;
  typesensePort: number;
  typesenseProtocol: 'http' | 'https';
  typesenseApiKey: string;
  catalogServiceUrl: string;
  jwtPublicKey: string;
  jwtIssuer: string;
  jwtAudience: string;
  serviceHttpTimeoutMs: number;
  fullReindexScheduleCron: string;
  serviceJwtSecret: string;
  serviceTokenTtlSeconds: number;
}

export const config: Readonly<SearchServiceConfig> = Object.freeze({
  nodeEnv: parsed.NODE_ENV,
  logLevel: parsed.LOG_LEVEL,
  redisUrl: parsed.REDIS_URL,
  port: parsed.SEARCH_PORT,
  typesenseHost: parsed.TYPESENSE_HOST,
  typesensePort: parsed.TYPESENSE_PORT,
  typesenseProtocol: parsed.TYPESENSE_PROTOCOL,
  typesenseApiKey: parsed.TYPESENSE_API_KEY,
  catalogServiceUrl: parsed.CATALOG_SERVICE_URL,
  jwtPublicKey: decodeBase64Pem(parsed.JWT_PUBLIC_KEY),
  jwtIssuer: parsed.JWT_ISSUER,
  jwtAudience: parsed.JWT_AUDIENCE,
  serviceHttpTimeoutMs: parsed.SERVICE_HTTP_TIMEOUT_MS,
  fullReindexScheduleCron: parsed.FULL_REINDEX_SCHEDULE_CRON,
  serviceJwtSecret: parsed.SERVICE_JWT_SECRET,
  serviceTokenTtlSeconds: parsed.SERVICE_TOKEN_TTL_SECONDS,
});
