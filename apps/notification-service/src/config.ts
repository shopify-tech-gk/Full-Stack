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
  // Shared across every service that verifies access tokens - W9: the signed-in customer
  // help-ticket routes (/support/tickets) verify the customer's token with it.
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
  // Email only (default on): false keeps EMAIL simulated while WhatsApp still sends for real -
  // e.g. in development while the sending domain isn't live.
  EMAIL_SENDING_ENABLED: z
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
  // W9: refunds now go to the YouMart Wallet. The approved "youmart_refund_processed" text says
  // the money "will reflect in 5-7 business days", which is no longer true - once a wallet-refund
  // UTILITY template is approved in MSG91 ({{1}}=customerName, {{2}}=amount, {{3}}=orderNumber,
  // e.g. "...Rs {{2}} for order {{3}} has been added to your YouMart Wallet"), set its name here.
  // Until then refund WhatsApps are skipped (email still goes out) rather than sending wrong text.
  MSG91_WHATSAPP_WALLET_REFUND_TEMPLATE: z.string().optional(),
  /** v1.17 "back in stock" WhatsApp - an approved MSG91 template; unset = WhatsApp leg skipped. */
  MSG91_WHATSAPP_RESTOCK_TEMPLATE: z.string().optional(),
  /** v1.17 the storefront's public address, for links in emails ("View on website"). */
  STOREFRONT_URL: z.string().url().default('http://localhost:3000'),
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

  // W1: where public contact-form messages are forwarded (EMAIL). Not a secret.
  SUPPORT_INBOX_EMAIL: z.string().email().default('info@youmart.in'),
  // v1.17 AI help (Claude). Empty key = the assistant is off (503, the Help screen hides it).
  ANTHROPIC_API_KEY: z.string().default(''),
  ASSISTANT_MODEL: z.string().min(1).default('claude-haiku-5-5'),
  /** Questions per customer (or per IP when signed out) per day. */
  ASSISTANT_DAILY_LIMIT: z.coerce.number().int().positive().default(40),

  // W9: customer help tickets (signed-in) + per-customer notification settings.
  ORDER_SERVICE_URL: z.string().url(),
  AUTH_SERVICE_URL: z.string().url(),
  /** v1.17 YouMart AI: product search for shopping questions. */
  SEARCH_SERVICE_URL: z.string().url().default('http://localhost:4013'),
  SERVICE_HTTP_TIMEOUT_MS: z.coerce.number().int().positive().default(5000),
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
  emailSendingEnabled: boolean;
  msg91AuthKey: string;
  msg91IntegratedNumber: string;
  msg91WhatsappNamespace: string;
  msg91WhatsappOtpTemplate: string;
  msg91WhatsappOtpNamespace: string;
  msg91WhatsappOrderPlacedTemplate: string;
  msg91WhatsappOrderShippedTemplate: string;
  msg91WhatsappOrderDeliveredTemplate: string;
  msg91WhatsappRefundTemplate: string;
  msg91WhatsappWalletRefundTemplate: string | undefined;
  msg91WhatsappRestockTemplate: string | undefined;
  storefrontUrl: string;
  msg91SenderId: string;
  msg91OtpTemplateId: string | undefined;
  zohoClientId: string;
  zohoClientSecret: string;
  zohoRefreshToken: string;
  zohoFromEmail: string;
  zohoAccountRegion: string;
  zohoAccountId: string;
  supportInboxEmail: string;
  anthropicApiKey: string;
  assistantModel: string;
  assistantDailyLimit: number;
  orderServiceUrl: string;
  authServiceUrl: string;
  searchServiceUrl: string;
  serviceHttpTimeoutMs: number;
  serviceJwtSecret: string;
  serviceTokenTtlSeconds: number;
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
  emailSendingEnabled: parsed.EMAIL_SENDING_ENABLED,
  msg91AuthKey: parsed.MSG91_AUTH_KEY,
  msg91IntegratedNumber: parsed.MSG91_INTEGRATED_NUMBER,
  msg91WhatsappNamespace: parsed.MSG91_WHATSAPP_NAMESPACE,
  msg91WhatsappOtpTemplate: parsed.MSG91_WHATSAPP_OTP_TEMPLATE,
  msg91WhatsappOtpNamespace: parsed.MSG91_WHATSAPP_OTP_NAMESPACE || parsed.MSG91_WHATSAPP_NAMESPACE,
  msg91WhatsappOrderPlacedTemplate: parsed.MSG91_WHATSAPP_ORDER_PLACED_TEMPLATE,
  msg91WhatsappOrderShippedTemplate: parsed.MSG91_WHATSAPP_ORDER_SHIPPED_TEMPLATE,
  msg91WhatsappOrderDeliveredTemplate: parsed.MSG91_WHATSAPP_ORDER_DELIVERED_TEMPLATE,
  msg91WhatsappRefundTemplate: parsed.MSG91_WHATSAPP_REFUND_TEMPLATE,
  msg91WhatsappWalletRefundTemplate: parsed.MSG91_WHATSAPP_WALLET_REFUND_TEMPLATE || undefined,
  msg91WhatsappRestockTemplate: parsed.MSG91_WHATSAPP_RESTOCK_TEMPLATE || undefined,
  storefrontUrl: parsed.STOREFRONT_URL.replace(/\/+$/, ''),
  msg91SenderId: parsed.MSG91_SENDER_ID,
  msg91OtpTemplateId: parsed.MSG91_OTP_TEMPLATE_ID,
  zohoClientId: parsed.ZOHO_CLIENT_ID,
  zohoClientSecret: parsed.ZOHO_CLIENT_SECRET,
  zohoRefreshToken: parsed.ZOHO_REFRESH_TOKEN,
  zohoFromEmail: parsed.ZOHO_FROM_EMAIL,
  zohoAccountRegion: parsed.ZOHO_ACCOUNT_REGION,
  zohoAccountId: parsed.ZOHO_ACCOUNT_ID,
  supportInboxEmail: parsed.SUPPORT_INBOX_EMAIL,
  anthropicApiKey: parsed.ANTHROPIC_API_KEY,
  assistantModel: parsed.ASSISTANT_MODEL,
  assistantDailyLimit: parsed.ASSISTANT_DAILY_LIMIT,
  orderServiceUrl: parsed.ORDER_SERVICE_URL,
  authServiceUrl: parsed.AUTH_SERVICE_URL,
  searchServiceUrl: parsed.SEARCH_SERVICE_URL,
  serviceHttpTimeoutMs: parsed.SERVICE_HTTP_TIMEOUT_MS,
  serviceJwtSecret: parsed.SERVICE_JWT_SECRET,
  serviceTokenTtlSeconds: parsed.SERVICE_TOKEN_TTL_SECONDS,
});
