import { createHmac, timingSafeEqual } from 'node:crypto';
import fs from 'node:fs';
import type { Request } from 'express';
import { Router } from 'express';
import { AppError } from '@youmart/errors';
import { requireAuth, requireServiceOrUser } from '../authMiddleware';
import { requireUserId } from '../authToken';
import { config } from '../config';
import { getInvoiceByOrderId, type InvoiceView } from '../invoice/invoice.service';

export const invoiceRouter: Router = Router();

// A customer may only ever see/download THEIR OWN order's invoice - a
// mismatch (or no invoice at all yet) is a 404, indistinguishable from
// "doesn't exist", same principle as every other ownership check in this
// repo (e.g. catalog's seller-scope 404s). A SERVICE caller (Ch6.5 -
// `req.service` set by `requireServiceOrUser`) is trusted as-is - the
// service token authenticates a legitimate internal caller, not a
// specific end-user, so there is no "owner" to compare against.
async function loadInvoiceOrNotFound(req: Request, orderId: string): Promise<InvoiceView> {
  const invoice = await getInvoiceByOrderId(orderId);
  if (!invoice) {
    throw new AppError('NOT_FOUND', 404, 'Invoice not found');
  }
  if (req.service) {
    return invoice;
  }
  const userId = requireUserId(req);
  if (invoice.userId !== userId) {
    throw new AppError('NOT_FOUND', 404, 'Invoice not found');
  }
  return invoice;
}

invoiceRouter.get('/order/:orderId', requireAuth, async (req, res) => {
  const orderId = typeof req.params.orderId === 'string' ? req.params.orderId : '';
  const invoice = await loadInvoiceOrNotFound(req, orderId);
  res.status(200).json(invoice);
});

// SERVICE-OR-USER (Ch6.5): the owning customer may download their own
// invoice directly; a backend service (e.g. a future admin/export flow)
// may also fetch it with a service token.
invoiceRouter.get('/order/:orderId/download', requireServiceOrUser, async (req, res) => {
  const orderId = typeof req.params.orderId === 'string' ? req.params.orderId : '';
  const invoice = await loadInvoiceOrNotFound(req, orderId);

  if (!fs.existsSync(invoice.pdfPath)) {
    throw new AppError('NOT_FOUND', 404, 'Invoice PDF not found');
  }
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader(
    'Content-Disposition',
    `attachment; filename="${invoice.invoiceNumber.replace(/\//g, '-')}.pdf"`,
  );
  res.sendFile(invoice.pdfPath);
});

// W9: a short-lived download LINK for the customer's own invoice - lets the mobile app open the
// PDF in the system browser (which can't send the in-memory bearer token). The link carries an
// HMAC-signed { orderId, userId, expiry } and is valid for 5 minutes; anything else is a 404.
const LINK_TTL_SECONDS = 5 * 60;

function signLink(payload: string): string {
  return createHmac('sha256', config.serviceJwtSecret)
    .update(`invoice-download-link:${payload}`)
    .digest('base64url');
}

invoiceRouter.post('/order/:orderId/download-link', requireAuth, async (req, res) => {
  const orderId = typeof req.params.orderId === 'string' ? req.params.orderId : '';
  const invoice = await loadInvoiceOrNotFound(req, orderId);
  const expiresAt = Math.floor(Date.now() / 1000) + LINK_TTL_SECONDS;
  const payload = Buffer.from(
    JSON.stringify({ o: invoice.orderId, u: invoice.userId, e: expiresAt }),
  ).toString('base64url');
  res.status(201).json({
    /** Relative to the API base URL (the client prefixes its own `/api` origin). */
    path: `/invoices/download/${payload}.${signLink(payload)}`,
    expiresAt: new Date(expiresAt * 1000).toISOString(),
  });
});

invoiceRouter.get('/download/:token', async (req, res) => {
  const token = typeof req.params.token === 'string' ? req.params.token : '';
  const [payload, signature] = token.split('.');
  const notFound = new AppError('NOT_FOUND', 404, 'This download link is invalid or has expired');
  if (!payload || !signature) throw notFound;

  const expected = Buffer.from(signLink(payload));
  const actual = Buffer.from(signature);
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) throw notFound;

  let claims: { o?: unknown; u?: unknown; e?: unknown };
  try {
    claims = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as typeof claims;
  } catch {
    throw notFound;
  }
  if (
    typeof claims.o !== 'string' ||
    typeof claims.u !== 'string' ||
    typeof claims.e !== 'number'
  ) {
    throw notFound;
  }
  if (claims.e < Math.floor(Date.now() / 1000)) throw notFound;

  const invoice = await getInvoiceByOrderId(claims.o);
  if (!invoice || invoice.userId !== claims.u || !fs.existsSync(invoice.pdfPath)) throw notFound;

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader(
    'Content-Disposition',
    `inline; filename="${invoice.invoiceNumber.replace(/\//g, '-')}.pdf"`,
  );
  res.setHeader('Cache-Control', 'private, no-store');
  res.sendFile(invoice.pdfPath);
});
