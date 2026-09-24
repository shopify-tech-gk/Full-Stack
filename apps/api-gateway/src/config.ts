import path from 'node:path';
import { z } from 'zod';
import { loadConfigWith } from '@youmart/config';

process.loadEnvFile(path.resolve(__dirname, '../../../.env'));

/**
 * api-gateway is a PURE PROXY - no database, no `_svc` role, no Redis/queue
 * connection either (it enqueues nothing). Consequently this does NOT
 * extend `@youmart/config`'s `baseEnvSchema` (which requires `DATABASE_URL`
 * and `REDIS_URL`) - it defines its own minimal schema instead, reusing
 * only `loadConfigWith`'s generic validate-and-freeze helper (same pattern
 * as search-service, Ch6.3).
 */
const apiGatewayEnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
  // The ONE public port - everything else lives behind this.
  GATEWAY_PORT: z.coerce.number().int().positive().default(4000),

  // Downstream service base URLs - one explicit `<NAME>_SERVICE_URL` var
  // per service, matching the SAME naming convention every other service
  // already uses for its own outbound service-client URLs (e.g.
  // order-service's ORDER_SERVICE_URL et al) - chosen over a single
  // "SERVICES_BASE + port map" for consistency with the rest of the repo
  // and because each service's actual host may differ in a real deploy
  // (not just a port on localhost).
  AUTH_SERVICE_URL: z.string().url(),
  CATALOG_SERVICE_URL: z.string().url(),
  INVENTORY_SERVICE_URL: z.string().url(),
  CART_SERVICE_URL: z.string().url(),
  ORDER_SERVICE_URL: z.string().url(),
  PAYMENT_SERVICE_URL: z.string().url(),
  SELLER_SERVICE_URL: z.string().url(),
  SETTLEMENT_SERVICE_URL: z.string().url(),
  LOGISTICS_SERVICE_URL: z.string().url(),
  RETURNS_SERVICE_URL: z.string().url(),
  ADDRESS_SERVICE_URL: z.string().url(),
  NOTIFICATION_SERVICE_URL: z.string().url(),
  SEARCH_SERVICE_URL: z.string().url(),
  INVOICE_SERVICE_URL: z.string().url(),
  // Ch6.7a: admin-service (email/password login + RBAC), routed at
  // /api/admin - registered LAST in the gateway's routing table so it
  // never swallows the more specific /api/admin/<x> prefixes.
  ADMIN_SERVICE_URL: z.string().url(),

  // Comma-separated list of allowed CORS origins - dev localhost origins +
  // the future frontend's real origin(s), added as they're known.
  CORS_ALLOWED_ORIGINS: z.string().default('http://localhost:3000,http://localhost:5173'),

  // Coarse, IP-level rate limit applied to EVERY request through the
  // gateway - a defense-in-depth backstop, not a replacement for
  // endpoint-specific limits already enforced inside services (e.g.
  // auth-service's per-phone OTP rate limit, Ch3, is unaffected/untouched).
  RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(60_000),
  RATE_LIMIT_MAX: z.coerce.number().int().positive().default(300),
});

const parsed = loadConfigWith(apiGatewayEnvSchema);

function parseOrigins(value: string): string[] {
  return value
    .split(',')
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0);
}

export interface ApiGatewayConfig {
  nodeEnv: 'development' | 'test' | 'production';
  logLevel: 'fatal' | 'error' | 'warn' | 'info' | 'debug' | 'trace';
  port: number;
  services: {
    auth: string;
    catalog: string;
    inventory: string;
    cart: string;
    order: string;
    payment: string;
    seller: string;
    settlement: string;
    logistics: string;
    returns: string;
    address: string;
    notification: string;
    search: string;
    invoice: string;
    admin: string;
  };
  corsAllowedOrigins: string[];
  rateLimitWindowMs: number;
  rateLimitMax: number;
}

export const config: Readonly<ApiGatewayConfig> = Object.freeze({
  nodeEnv: parsed.NODE_ENV,
  logLevel: parsed.LOG_LEVEL,
  port: parsed.GATEWAY_PORT,
  services: Object.freeze({
    auth: parsed.AUTH_SERVICE_URL,
    catalog: parsed.CATALOG_SERVICE_URL,
    inventory: parsed.INVENTORY_SERVICE_URL,
    cart: parsed.CART_SERVICE_URL,
    order: parsed.ORDER_SERVICE_URL,
    payment: parsed.PAYMENT_SERVICE_URL,
    seller: parsed.SELLER_SERVICE_URL,
    settlement: parsed.SETTLEMENT_SERVICE_URL,
    logistics: parsed.LOGISTICS_SERVICE_URL,
    returns: parsed.RETURNS_SERVICE_URL,
    address: parsed.ADDRESS_SERVICE_URL,
    notification: parsed.NOTIFICATION_SERVICE_URL,
    search: parsed.SEARCH_SERVICE_URL,
    invoice: parsed.INVOICE_SERVICE_URL,
    admin: parsed.ADMIN_SERVICE_URL,
  }),
  corsAllowedOrigins: parseOrigins(parsed.CORS_ALLOWED_ORIGINS),
  rateLimitWindowMs: parsed.RATE_LIMIT_WINDOW_MS,
  rateLimitMax: parsed.RATE_LIMIT_MAX,
});
