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
  OTP_TTL_SECONDS: z.coerce.number().int().positive().default(300),
  OTP_LENGTH: z.coerce.number().int().positive().default(6),
  OTP_MAX_ATTEMPTS: z.coerce.number().int().positive().default(5),
  OTP_RESEND_COOLDOWN_SECONDS: z.coerce.number().int().positive().default(60),
  OTP_RATE_LIMIT_PER_HOUR: z.coerce.number().int().positive().default(5),
  // HMAC key used to hash OTP codes (src/otp/otp.util.ts). Dev placeholder
  // here; production value is a deploy-chapter secrets-management concern.
  OTP_HASH_SECRET: z.string().min(16),
  // RS256 keys are stored base64-encoded on a single line - the most robust
  // way to hold a multiline PEM in a .env file cross-platform (avoids
  // CRLF/quoting issues with embedded newlines on Windows). Decoded below.
  JWT_PRIVATE_KEY: z.string().min(1),
  JWT_PUBLIC_KEY: z.string().min(1),
  JWT_ISSUER: z.string().default('youmart-auth'),
  JWT_AUDIENCE: z.string().default('youmart'),
  ACCESS_TOKEN_TTL_SECONDS: z.coerce.number().int().positive().default(900),
  REFRESH_TOKEN_TTL_SECONDS: z.coerce.number().int().positive().default(1209600),
  REFRESH_COOKIE_NAME: z.string().default('ym_rt'),
  // Must be true in every non-dev environment - the httpOnly refresh cookie
  // must never travel over plain HTTP outside local development.
  // NOTE: z.coerce.boolean() is NOT used here - it calls JS `Boolean(value)`,
  // so the STRING "false" coerces to `true` (any non-empty string is
  // truthy). Comparing against the literal string "true" instead.
  COOKIE_SECURE: z
    .string()
    .default('false')
    .transform((v) => v === 'true'),
  COOKIE_DOMAIN: z.string().optional(),
});

const parsed = loadConfigWith(authServiceEnvSchema);

function decodeBase64Pem(value: string): string {
  return Buffer.from(value, 'base64').toString('utf8');
}

export interface AuthServiceConfig {
  nodeEnv: 'development' | 'test' | 'production';
  databaseUrl: string;
  redisUrl: string;
  logLevel: 'fatal' | 'error' | 'warn' | 'info' | 'debug' | 'trace';
  port: number;
  authDatabaseUrl: string;
  otpTtlSeconds: number;
  otpLength: number;
  otpMaxAttempts: number;
  otpResendCooldownSeconds: number;
  otpRateLimitPerHour: number;
  otpHashSecret: string;
  jwtPrivateKey: string;
  jwtPublicKey: string;
  jwtIssuer: string;
  jwtAudience: string;
  accessTokenTtlSeconds: number;
  refreshTokenTtlSeconds: number;
  refreshCookieName: string;
  cookieSecure: boolean;
  cookieDomain: string | undefined;
}

export const config: Readonly<AuthServiceConfig> = Object.freeze({
  nodeEnv: parsed.NODE_ENV,
  databaseUrl: parsed.DATABASE_URL,
  redisUrl: parsed.REDIS_URL,
  logLevel: parsed.LOG_LEVEL,
  port: parsed.PORT,
  authDatabaseUrl: parsed.AUTH_DATABASE_URL,
  otpTtlSeconds: parsed.OTP_TTL_SECONDS,
  otpLength: parsed.OTP_LENGTH,
  otpMaxAttempts: parsed.OTP_MAX_ATTEMPTS,
  otpResendCooldownSeconds: parsed.OTP_RESEND_COOLDOWN_SECONDS,
  otpRateLimitPerHour: parsed.OTP_RATE_LIMIT_PER_HOUR,
  otpHashSecret: parsed.OTP_HASH_SECRET,
  jwtPrivateKey: decodeBase64Pem(parsed.JWT_PRIVATE_KEY),
  jwtPublicKey: decodeBase64Pem(parsed.JWT_PUBLIC_KEY),
  jwtIssuer: parsed.JWT_ISSUER,
  jwtAudience: parsed.JWT_AUDIENCE,
  accessTokenTtlSeconds: parsed.ACCESS_TOKEN_TTL_SECONDS,
  refreshTokenTtlSeconds: parsed.REFRESH_TOKEN_TTL_SECONDS,
  refreshCookieName: parsed.REFRESH_COOKIE_NAME,
  cookieSecure: parsed.COOKIE_SECURE,
  cookieDomain: parsed.COOKIE_DOMAIN,
});
