import fs from 'node:fs';
import { Router } from 'express';
import { AppError } from '@youmart/errors';
import { requireAuth } from '../authMiddleware';
import { requireUserId } from '../authToken';
import { getInvoiceByOrderId } from '../invoice/invoice.service';

export const invoiceRouter: Router = Router();

// A customer may only ever see/download THEIR OWN order's invoice - a
// mismatch (or no invoice at all yet) is a 404, indistinguishable from
// "doesn't exist", same principle as every other ownership check in this
// repo (e.g. catalog's seller-scope 404s).
async function loadOwnInvoiceOrNotFound(orderId: string, userId: string) {
  const invoice = await getInvoiceByOrderId(orderId);
  if (!invoice || invoice.userId !== userId) {
    throw new AppError('NOT_FOUND', 404, 'Invoice not found');
  }
  return invoice;
}

invoiceRouter.get('/order/:orderId', requireAuth, async (req, res) => {
  const userId = requireUserId(req);
  const orderId = typeof req.params.orderId === 'string' ? req.params.orderId : '';
  const invoice = await loadOwnInvoiceOrNotFound(orderId, userId);
  res.status(200).json(invoice);
});

invoiceRouter.get('/order/:orderId/download', requireAuth, async (req, res) => {
  const userId = requireUserId(req);
  const orderId = typeof req.params.orderId === 'string' ? req.params.orderId : '';
  const invoice = await loadOwnInvoiceOrNotFound(orderId, userId);

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
