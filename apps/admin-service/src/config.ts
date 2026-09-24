import path from 'node:path';
import { z } from 'zod';
import { baseEnvSchema, loadConfigWith } from '@youmart/config';

process.loadEnvFile(path.resolve(__dirname, '../../../.env'));

const adminServiceEnvSchema = baseEnvSchema.extend({
  // Named ADMIN_PORT (not PORT): one shared root .env across services.
  ADMIN_PORT: z.coerce.number().int().positive().default(4015),
  // Connection string for the least-privilege `admin_svc` Postgres role
  // (Ch2 grants), scoped to the admin schema only - not the owner
  // DATABASE_URL.
  ADMIN_DATABASE_URL: z.string().url(),
  // RS256 keys, base64-encoded on a single line (same convention as
  // auth-service). admin-service holds BOTH keys: the PRIVATE key to sign
  // its own ADMIN tokens (key custody decision, see README) and the
  // PUBLIC key to verify them on its own requireAdmin-gated endpoints -
  // the SAME keypair auth-service uses for customer tokens, distinguished
  // only by the `typ` claim (`"admin"` vs `"access"`).
  JWT_PRIVATE_KEY: z.string().min(1),
  JWT_PUBLIC_KEY: z.string().min(1),
  JWT_ISSUER: z.string().default('youmart-auth'),
  JWT_AUDIENCE: z.string().default('youmart'),
  // Admin sessions are ACCESS-TOKEN-ONLY (no refresh) for launch
  // simplicity - staff re-log-in when this expires. A longer default than
  // the customer access token's 900s (Ch3) since admins aren't expected
  // to silently refresh in the background the way a shopping session
  // does. Named ADMIN_ACCESS_TOKEN_TTL_SECONDS (not the bare name) since
  // auth-service already declares its OWN ACCESS_TOKEN_TTL_SECONDS in the
  // same shared root .env - a bare name here would silently collide.
  ADMIN_ACCESS_TOKEN_TTL_SECONDS: z.coerce.number().int().positive().default(28800),
  // bcrypt cost factor for admin.password_hash - 12 is bcrypt's own
  // documented "good default" as of 2026 hardware.
  BCRYPT_ROUNDS: z.coerce.number().int().positive().default(12),
  // First SUPER_ADMIN, created by the idempotent seed script - dev
  // placeholder values; MUST be changed (a real password set via
  // `POST /admin/login` + a future admin-initiated password-change
  // endpoint, or a direct DB update) before any non-dev deploy.
  INITIAL_ADMIN_EMAIL: z.string().email(),
  INITIAL_ADMIN_PASSWORD: z.string().min(8),
});

const parsed = loadConfigWith(adminServiceEnvSchema);

function decodeBase64Pem(value: string): string {
  return Buffer.from(value, 'base64').toString('utf8');
}

export interface AdminServiceConfig {
  nodeEnv: 'development' | 'test' | 'production';
  databaseUrl: string;
  redisUrl: string;
  logLevel: 'fatal' | 'error' | 'warn' | 'info' | 'debug' | 'trace';
  port: number;
  adminDatabaseUrl: string;
  jwtPrivateKey: string;
  jwtPublicKey: string;
  jwtIssuer: string;
  jwtAudience: string;
  accessTokenTtlSeconds: number;
  bcryptRounds: number;
  initialAdminEmail: string;
  initialAdminPassword: string;
  serviceJwtSecret: string;
  serviceTokenTtlSeconds: number;
}

export const config: Readonly<AdminServiceConfig> = Object.freeze({
  nodeEnv: parsed.NODE_ENV,
  databaseUrl: parsed.DATABASE_URL,
  redisUrl: parsed.REDIS_URL,
  logLevel: parsed.LOG_LEVEL,
  port: parsed.ADMIN_PORT,
  adminDatabaseUrl: parsed.ADMIN_DATABASE_URL,
  jwtPrivateKey: decodeBase64Pem(parsed.JWT_PRIVATE_KEY),
  jwtPublicKey: decodeBase64Pem(parsed.JWT_PUBLIC_KEY),
  jwtIssuer: parsed.JWT_ISSUER,
  jwtAudience: parsed.JWT_AUDIENCE,
  accessTokenTtlSeconds: parsed.ADMIN_ACCESS_TOKEN_TTL_SECONDS,
  bcryptRounds: parsed.BCRYPT_ROUNDS,
  initialAdminEmail: parsed.INITIAL_ADMIN_EMAIL,
  initialAdminPassword: parsed.INITIAL_ADMIN_PASSWORD,
  serviceJwtSecret: parsed.SERVICE_JWT_SECRET,
  serviceTokenTtlSeconds: parsed.SERVICE_TOKEN_TTL_SECONDS,
});
