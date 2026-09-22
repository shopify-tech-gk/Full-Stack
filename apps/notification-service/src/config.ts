import path from 'node:path';
import { z } from 'zod';
import { baseEnvSchema, loadConfigWith } from '@youmart/config';

process.loadEnvFile(path.resolve(__dirname, '../../../.env'));

const notificationServiceEnvSchema = baseEnvSchema.extend({
  // Named NOTIFICATION_PORT (not PORT): one shared root .env across services.
  NOTIFICATION_PORT: z.coerce.number().int().positive().default(4012),
  // Connection string for the least-privilege `notifications_svc` Postgres
  // role (Ch2 grants) - scoped to the notifications schema only.
  NOTIFICATION_DATABASE_URL: z.string().url(),
  // Shared across every service that verifies access tokens. Not consumed
  // by any route today (this service has no protected HTTP surface beyond
  // health/ready) - reserved for a future authenticated admin endpoint
  // (e.g. list/retry notification_log rows).
  JWT_PUBLIC_KEY: z.string().min(1),
  JWT_ISSUER: z.string().default('youmart-auth'),
  JWT_AUDIENCE: z.string().default('youmart'),

  // Master switch: false => log-only/simulated sends, NO real provider
  // calls (dev/test default-safe path - avoids spending SMS/WhatsApp
  // credits or hitting rate limits). See providers/noop.provider.ts.
  NOTIFICATIONS_ENABLED: z
    .string()
    .default('true')
    .transform((v) => v === 'true'),

  // --- MSG91 (WhatsApp - 5 final approved templates, Ch6.2c) ---
  MSG91_AUTH_KEY: z.string().min(1),
  MSG91_INTEGRATED_NUMBER: z.string().min(1),
  // Shared WhatsApp Business namespace for every UTILITY template below
  // (order placed/shipped/delivered, refund) - all created together in
  // the same MSG91/Meta WABA.
  MSG91_WHATSAPP_NAMESPACE: z.string().min(1),
  // AUTHENTICATION-category template for OTP - a SEPARATE template from
  // the UTILITY ones (order/marketing templates cannot carry an OTP, Meta
  // rejects it). Template NAMES are not secret (only MSG91_AUTH_KEY is) -
  // a rename is an env change, never a code change.
  MSG91_WHATSAPP_OTP_TEMPLATE: z.string().min(1),
  // Optional - only set if the OTP auth template was approved under a
  // DIFFERENT WhatsApp namespace than the UTILITY templates; otherwise it
  // reuses MSG91_WHATSAPP_NAMESPACE (see config object below).
  MSG91_WHATSAPP_OTP_NAMESPACE: z.string().optional(),
  // UTILITY templates - one env var per notification event (Ch6.2c final
  // set; the old single MSG91_WHATSAPP_TEMPLATE "youmart_order_confirmation"
  // is DELETED/replaced by these four).
  MSG91_WHATSAPP_ORDER_PLACED_TEMPLATE: z.string().min(1),
  MSG91_WHATSAPP_ORDER_SHIPPED_TEMPLATE: z.string().min(1),
  MSG91_WHATSAPP_ORDER_DELIVERED_TEMPLATE: z.string().min(1),
  MSG91_WHATSAPP_REFUND_TEMPLATE: z.string().min(1),
  // Sender id for MSG91's legacy plain-text SMS API - SMS is DROPPED as an
  // active routing target (WhatsApp+email only, Ch6.2b); Msg91SmsProvider
  // and this setting are kept for a possible future fallback, not read by
  // any template today.
  MSG91_SENDER_ID: z.string().min(1),
  // Optional: MSG91's OTP API only requires this when the account has more
  // than one registered OTP template. Unused now that OTP routes over
  // WhatsApp (Ch6.2b) - kept for the dormant SMS path.
  MSG91_OTP_TEMPLATE_ID: z.string().optional(),

  // --- Zoho Mail (transactional email via OAuth refresh flow) ---
  ZOHO_CLIENT_ID: z.string().min(1),
  ZOHO_CLIENT_SECRET: z.string().min(1),
  ZOHO_REFRESH_TOKEN: z.string().min(1),
  ZOHO_FROM_EMAIL: z.string().min(1),
  // Zoho's data-center region suffix (.com / .in / .eu / .com.au / .jp) -
  // both the OAuth token endpoint and the Mail API live under this TLD.
  ZOHO_ACCOUNT_REGION: z.string().min(1).default('in'),
  // The numeric Zoho Mail account id the "send message" endpoint requires
  // (`/api/accounts/{accountId}/messages`) - NOT explicitly listed in the
  // original request but required by Zoho Mail's actual API; documented in
  // the Ch6.2 report as a decision made to fill that gap.
  ZOHO_ACCOUNT_ID: z.string().min(1),
});

const parsed = loadConfigWith(notificationServiceEnvSchema);

function decodeBase64Pem(value: string): string {
  return Buffer.from(value, 'base64').toString('utf8');
}

export interface NotificationServiceConfig {
  nodeEnv: 'development' | 'test' | 'production';
  databaseUrl: string;
  redisUrl: string;
  logLevel: 'fatal' | 'error' | 'warn' | 'info' | 'debug' | 'trace';
  port: number;
  notificationDatabaseUrl: string;
  jwtPublicKey: string;
  jwtIssuer: string;
  jwtAudience: string;
  notificationsEnabled: boolean;
  msg91AuthKey: string;
  msg91IntegratedNumber: string;
  msg91WhatsappNamespace: string;
  msg91WhatsappOtpTemplate: string;
  msg91WhatsappOtpNamespace: string;
  msg91WhatsappOrderPlacedTemplate: string;
  msg91WhatsappOrderShippedTemplate: string;
  msg91WhatsappOrderDeliveredTemplate: string;
  msg91WhatsappRefundTemplate: string;
  msg91SenderId: string;
  msg91OtpTemplateId: string | undefined;
  zohoClientId: string;
  zohoClientSecret: string;
  zohoRefreshToken: string;
  zohoFromEmail: string;
  zohoAccountRegion: string;
  zohoAccountId: string;
}

export const config: Readonly<NotificationServiceConfig> = Object.freeze({
  nodeEnv: parsed.NODE_ENV,
  databaseUrl: parsed.DATABASE_URL,
  redisUrl: parsed.REDIS_URL,
  logLevel: parsed.LOG_LEVEL,
  port: parsed.NOTIFICATION_PORT,
  notificationDatabaseUrl: parsed.NOTIFICATION_DATABASE_URL,
  jwtPublicKey: decodeBase64Pem(parsed.JWT_PUBLIC_KEY),
  jwtIssuer: parsed.JWT_ISSUER,
  jwtAudience: parsed.JWT_AUDIENCE,
  notificationsEnabled: parsed.NOTIFICATIONS_ENABLED,
  msg91AuthKey: parsed.MSG91_AUTH_KEY,
  msg91IntegratedNumber: parsed.MSG91_INTEGRATED_NUMBER,
  msg91WhatsappNamespace: parsed.MSG91_WHATSAPP_NAMESPACE,
  msg91WhatsappOtpTemplate: parsed.MSG91_WHATSAPP_OTP_TEMPLATE,
  msg91WhatsappOtpNamespace: parsed.MSG91_WHATSAPP_OTP_NAMESPACE || parsed.MSG91_WHATSAPP_NAMESPACE,
  msg91WhatsappOrderPlacedTemplate: parsed.MSG91_WHATSAPP_ORDER_PLACED_TEMPLATE,
  msg91WhatsappOrderShippedTemplate: parsed.MSG91_WHATSAPP_ORDER_SHIPPED_TEMPLATE,
  msg91WhatsappOrderDeliveredTemplate: parsed.MSG91_WHATSAPP_ORDER_DELIVERED_TEMPLATE,
  msg91WhatsappRefundTemplate: parsed.MSG91_WHATSAPP_REFUND_TEMPLATE,
  msg91SenderId: parsed.MSG91_SENDER_ID,
  msg91OtpTemplateId: parsed.MSG91_OTP_TEMPLATE_ID,
  zohoClientId: parsed.ZOHO_CLIENT_ID,
  zohoClientSecret: parsed.ZOHO_CLIENT_SECRET,
  zohoRefreshToken: parsed.ZOHO_REFRESH_TOKEN,
  zohoFromEmail: parsed.ZOHO_FROM_EMAIL,
  zohoAccountRegion: parsed.ZOHO_ACCOUNT_REGION,
  zohoAccountId: parsed.ZOHO_ACCOUNT_ID,
});
