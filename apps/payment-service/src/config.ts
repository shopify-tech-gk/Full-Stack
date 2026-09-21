import path from 'node:path';
import { z } from 'zod';
import { baseEnvSchema, loadConfigWith } from '@youmart/config';

process.loadEnvFile(path.resolve(__dirname, '../../../.env'));

const paymentServiceEnvSchema = baseEnvSchema.extend({
  // Named PAYMENT_PORT (not PORT): one shared root .env across services.
  PAYMENT_PORT: z.coerce.number().int().positive().default(4006),
  // Connection string for the least-privilege `payments_svc` Postgres role
  // (Ch2 grants) - scoped to the payments schema only.
  PAYMENT_DATABASE_URL: z.string().url(),
  // Shared across every service that verifies access tokens.
  JWT_PUBLIC_KEY: z.string().min(1),
  JWT_ISSUER: z.string().default('youmart-auth'),
  JWT_AUDIENCE: z.string().default('youmart'),
  // payments_svc cannot read the orders schema (cross-schema isolation) -
  // order lookup/confirm/cancel all go over HTTP via @youmart/service-client.
  // NOTE: no INVENTORY_SERVICE_URL here - order-service owns
  // confirm->commit-stock / cancel->release-stock (see order.service.ts),
  // so payment-service never talks to inventory-service directly.
  ORDER_SERVICE_URL: z.string().url(),
  // Test-mode keys from the Razorpay dashboard - dev values in .env only,
  // .env.example has placeholders. Never logged, never returned to a client.
  RAZORPAY_KEY_ID: z.string().min(1),
  RAZORPAY_KEY_SECRET: z.string().min(1),
  RAZORPAY_WEBHOOK_SECRET: z.string().min(1),
  SERVICE_HTTP_TIMEOUT_MS: z.coerce.number().int().positive().default(5000),
});

const parsed = loadConfigWith(paymentServiceEnvSchema);

function decodeBase64Pem(value: string): string {
  return Buffer.from(value, 'base64').toString('utf8');
}

export interface PaymentServiceConfig {
  nodeEnv: 'development' | 'test' | 'production';
  databaseUrl: string;
  redisUrl: string;
  logLevel: 'fatal' | 'error' | 'warn' | 'info' | 'debug' | 'trace';
  port: number;
  paymentDatabaseUrl: string;
  jwtPublicKey: string;
  jwtIssuer: string;
  jwtAudience: string;
  orderServiceUrl: string;
  razorpayKeyId: string;
  razorpayKeySecret: string;
  razorpayWebhookSecret: string;
  serviceHttpTimeoutMs: number;
}

export const config: Readonly<PaymentServiceConfig> = Object.freeze({
  nodeEnv: parsed.NODE_ENV,
  databaseUrl: parsed.DATABASE_URL,
  redisUrl: parsed.REDIS_URL,
  logLevel: parsed.LOG_LEVEL,
  port: parsed.PAYMENT_PORT,
  paymentDatabaseUrl: parsed.PAYMENT_DATABASE_URL,
  jwtPublicKey: decodeBase64Pem(parsed.JWT_PUBLIC_KEY),
  jwtIssuer: parsed.JWT_ISSUER,
  jwtAudience: parsed.JWT_AUDIENCE,
  orderServiceUrl: parsed.ORDER_SERVICE_URL,
  razorpayKeyId: parsed.RAZORPAY_KEY_ID,
  razorpayKeySecret: parsed.RAZORPAY_KEY_SECRET,
  razorpayWebhookSecret: parsed.RAZORPAY_WEBHOOK_SECRET,
  serviceHttpTimeoutMs: parsed.SERVICE_HTTP_TIMEOUT_MS,
});
