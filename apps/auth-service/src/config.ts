import path from 'node:path';
import { z } from 'zod';
import { baseEnvSchema, loadConfigWith } from '@youmart/config';

// Repo-root .env is the single source of truth (same pattern as packages/db's
// prisma.config.ts). Resolved from __dirname so it works from both src (dev,
// via tsx) and dist (built, via node) - both live 3 levels under the repo root.
process.loadEnvFile(path.resolve(__dirname, '../../../.env'));

const authServiceEnvSchema = baseEnvSchema.extend({
  PORT: z.coerce.number().int().positive().default(4001),
  // Connection string for the least-privilege `auth_svc` Postgres role
  // (Ch2 grants) - deliberately separate from the owner DATABASE_URL. This
  // service never connects as the migration/owner role.
  AUTH_DATABASE_URL: z.string().url(),
});

const parsed = loadConfigWith(authServiceEnvSchema);

export interface AuthServiceConfig {
  nodeEnv: 'development' | 'test' | 'production';
  databaseUrl: string;
  redisUrl: string;
  logLevel: 'fatal' | 'error' | 'warn' | 'info' | 'debug' | 'trace';
  port: number;
  authDatabaseUrl: string;
}

export const config: Readonly<AuthServiceConfig> = Object.freeze({
  nodeEnv: parsed.NODE_ENV,
  databaseUrl: parsed.DATABASE_URL,
  redisUrl: parsed.REDIS_URL,
  logLevel: parsed.LOG_LEVEL,
  port: parsed.PORT,
  authDatabaseUrl: parsed.AUTH_DATABASE_URL,
});
