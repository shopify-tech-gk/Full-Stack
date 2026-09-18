import { z } from 'zod';

/**
 * Env vars every backend service shares. Individual services extend this
 * with their own required vars via `baseEnvSchema.extend({ ... })`.
 */
export const baseEnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  DATABASE_URL: z.string().url(),
  REDIS_URL: z.string().url(),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
});

/**
 * Validates `rawEnv` against `schema`. On success, returns a frozen
 * (Object.freeze) copy of the parsed data. On failure, throws ONE Error
 * whose message enumerates every validation issue at once - not just the
 * first - so a misconfigured service fails fast with a complete diagnosis.
 */
export function loadConfigWith<TSchema extends z.ZodType>(
  schema: TSchema,
  rawEnv: Record<string, string | undefined> = process.env,
): Readonly<z.infer<TSchema>> {
  const result = schema.safeParse(rawEnv);

  if (!result.success) {
    const issues = result.error.issues
      .map((issue) => `  - ${issue.path.join('.') || '(root)'}: ${issue.message}`)
      .join('\n');
    throw new Error(`Invalid environment configuration:\n${issues}`);
  }

  return Object.freeze(result.data);
}

export interface Config {
  nodeEnv: 'development' | 'test' | 'production';
  databaseUrl: string;
  redisUrl: string;
  logLevel: 'fatal' | 'error' | 'warn' | 'info' | 'debug' | 'trace';
}

/**
 * Loads and validates the common base config. Returns a frozen, camelCase
 * config object - the one source of truth services should read from
 * instead of scattering raw `process.env` access.
 */
export function loadConfig(
  rawEnv: Record<string, string | undefined> = process.env,
): Readonly<Config> {
  const parsed = loadConfigWith(baseEnvSchema, rawEnv);

  return Object.freeze({
    nodeEnv: parsed.NODE_ENV,
    databaseUrl: parsed.DATABASE_URL,
    redisUrl: parsed.REDIS_URL,
    logLevel: parsed.LOG_LEVEL,
  });
}
