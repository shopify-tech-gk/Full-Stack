import path from 'node:path';
import { z } from 'zod';
import { baseEnvSchema, loadConfigWith } from '@youmart/config';

process.loadEnvFile(path.resolve(__dirname, '../../../.env'));

// Percent string, not a number - fed straight into @youmart/shared-utils'
// gstBackCalculate(ratePercent), which validates it itself.
const PercentString = z.string().min(1);

const invoiceServiceEnvSchema = baseEnvSchema.extend({
  // Named INVOICE_PORT (not PORT): one shared root .env across services.
  INVOICE_PORT: z.coerce.number().int().positive().default(4014),
  // Connection string for the least-privilege `invoices_svc` Postgres role
  // (Ch6.4 grants) - scoped to the invoices schema only.
  INVOICE_DATABASE_URL: z.string().url(),
  JWT_PUBLIC_KEY: z.string().min(1),
  JWT_ISSUER: z.string().default('youmart-auth'),
  JWT_AUDIENCE: z.string().default('youmart'),
  // invoices_svc cannot read the orders/catalog schemas (cross-schema
  // isolation) - the order + its lines, and each SKU's HSN/GST rate, come
  // over HTTP via @youmart/service-client.
  ORDER_SERVICE_URL: z.string().url(),
  CATALOG_SERVICE_URL: z.string().url(),
  SERVICE_HTTP_TIMEOUT_MS: z.coerce.number().int().positive().default(5000),
  // TEMPORARY dev-only admin authorization gate for the admin invoice
  // endpoints - same pattern as every other service's ADMIN_USER_IDS.
  ADMIN_USER_IDS: z.string().default(''),

  // --- Business (seller) GST identity - SNAPSHOTTED onto every invoice at
  // generation time (never re-read from config afterwards), same principle
  // as the order's ship_* address snapshot (Ch6.1): a later change here
  // must never alter an already-issued invoice. Vijesh fills real values
  // in .env; .env.example carries placeholders only.
  BUSINESS_LEGAL_NAME: z.string().min(1),
  BUSINESS_GSTIN: z.string().min(1),
  BUSINESS_ADDRESS: z.string().min(1),
  BUSINESS_STATE: z.string().min(1),
  BUSINESS_STATE_CODE: z.string().min(1),

  // --- GST hybrid per-product-with-platform-default fallback (see
  // catalog.Product.hsnCode/gstRatePercent, Ch6.4).
  DEFAULT_GST_RATE_PERCENT: PercentString.default('18.00'),
  DEFAULT_HSN_CODE: z.string().optional(),

  INVOICE_NUMBER_PREFIX: z.string().min(1).default('YM'),
  // Dev-only local filesystem directory the generated PDFs are written to.
  // Production swaps this for S3/CDN storage (env-driven, never
  // hardcoded) - see pdf.service.ts's doc comment.
  INVOICE_STORAGE_DIR: z.string().min(1).default('./storage/invoices'),
});

const parsed = loadConfigWith(invoiceServiceEnvSchema);

function decodeBase64Pem(value: string): string {
  return Buffer.from(value, 'base64').toString('utf8');
}

function parseAdminUserIds(value: string): string[] {
  return value
    .split(',')
    .map((id) => id.trim())
    .filter((id) => id.length > 0);
}

export interface InvoiceServiceConfig {
  nodeEnv: 'development' | 'test' | 'production';
  databaseUrl: string;
  redisUrl: string;
  logLevel: 'fatal' | 'error' | 'warn' | 'info' | 'debug' | 'trace';
  port: number;
  invoiceDatabaseUrl: string;
  jwtPublicKey: string;
  jwtIssuer: string;
  jwtAudience: string;
  orderServiceUrl: string;
  catalogServiceUrl: string;
  serviceHttpTimeoutMs: number;
  adminUserIds: string[];
  businessLegalName: string;
  businessGstin: string;
  businessAddress: string;
  businessState: string;
  businessStateCode: string;
  defaultGstRatePercent: string;
  defaultHsnCode: string | null;
  invoiceNumberPrefix: string;
  invoiceStorageDir: string;
}

export const config: Readonly<InvoiceServiceConfig> = Object.freeze({
  nodeEnv: parsed.NODE_ENV,
  databaseUrl: parsed.DATABASE_URL,
  redisUrl: parsed.REDIS_URL,
  logLevel: parsed.LOG_LEVEL,
  port: parsed.INVOICE_PORT,
  invoiceDatabaseUrl: parsed.INVOICE_DATABASE_URL,
  jwtPublicKey: decodeBase64Pem(parsed.JWT_PUBLIC_KEY),
  jwtIssuer: parsed.JWT_ISSUER,
  jwtAudience: parsed.JWT_AUDIENCE,
  orderServiceUrl: parsed.ORDER_SERVICE_URL,
  catalogServiceUrl: parsed.CATALOG_SERVICE_URL,
  serviceHttpTimeoutMs: parsed.SERVICE_HTTP_TIMEOUT_MS,
  adminUserIds: parseAdminUserIds(parsed.ADMIN_USER_IDS),
  businessLegalName: parsed.BUSINESS_LEGAL_NAME,
  businessGstin: parsed.BUSINESS_GSTIN,
  businessAddress: parsed.BUSINESS_ADDRESS,
  businessState: parsed.BUSINESS_STATE,
  businessStateCode: parsed.BUSINESS_STATE_CODE,
  defaultGstRatePercent: parsed.DEFAULT_GST_RATE_PERCENT,
  defaultHsnCode: parsed.DEFAULT_HSN_CODE ?? null,
  invoiceNumberPrefix: parsed.INVOICE_NUMBER_PREFIX,
  // Resolved to an ABSOLUTE path once here - Express's res.sendFile()
  // requires an absolute path, and every other consumer benefits from a
  // single, unambiguous storage location regardless of process cwd.
  invoiceStorageDir: path.resolve(__dirname, '../../..', parsed.INVOICE_STORAGE_DIR),
});
