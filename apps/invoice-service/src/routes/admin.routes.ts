import { Router } from 'express';
import { AppError } from '@youmart/errors';
import { requireAdmin } from '../authMiddleware';
import { listInvoices, getInvoiceById, generateInvoice } from '../invoice/invoice.service';

export const adminInvoiceRouter: Router = Router();

adminInvoiceRouter.get('/', requireAdmin('invoices.view'), async (_req, res) => {
  const items = await listInvoices();
  res.status(200).json({ items });
});

adminInvoiceRouter.get('/:id', requireAdmin('invoices.view'), async (req, res) => {
  const id = typeof req.params.id === 'string' ? req.params.id : '';
  const invoice = await getInvoiceById(id);
  if (!invoice) {
    throw new AppError('NOT_FOUND', 404, 'Invoice not found');
  }
  res.status(200).json(invoice);
});

// "Regenerate" is intentionally NOT a fresh invoice - generateInvoice() is
// idempotent (an existing invoice for the order is returned as-is, never
// duplicated / never issued a second invoice number). This endpoint exists
// for ops to (re)trigger generation for an order whose queued job failed
// or was never enqueued (e.g. a pre-Ch6.4 CONFIRMED order).
adminInvoiceRouter.post(
  '/regenerate/:orderId',
  requireAdmin('invoices.manage'),
  async (req, res) => {
    const orderId = typeof req.params.orderId === 'string' ? req.params.orderId : '';
    const invoice = await generateInvoice(orderId);
    res.status(200).json(invoice);
  },
);
