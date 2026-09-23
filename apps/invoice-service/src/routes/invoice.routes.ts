import fs from 'node:fs';
import type { Request } from 'express';
import { Router } from 'express';
import { AppError } from '@youmart/errors';
import { requireAuth, requireServiceOrUser } from '../authMiddleware';
import { requireUserId } from '../authToken';
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
