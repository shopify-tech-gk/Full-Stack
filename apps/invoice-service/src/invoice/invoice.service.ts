import { v7 as uuidv7 } from 'uuid';
import { Prisma } from '@youmart/db';
import type { Money } from '@youmart/shared-types';
import { add, sum, compare, gstBackCalculate, splitTaxEqually } from '@youmart/shared-utils';
import { AppError } from '@youmart/errors';
import { prisma } from '../db';
import { config } from '../config';
import { logger } from '../logger';
import { orderClient, catalogClient } from '../serviceClients';
import { generateInvoiceNumber } from './invoiceNumber.service';
import { renderInvoicePdf } from './pdf.service';

function decimalToMoney(value: Prisma.Decimal): Money {
  return value.toFixed(2) as Money;
}

const ZERO: Money = '0.00' as Money;

export interface InvoiceLineView {
  productId: string;
  skuId: string;
  titleSnapshot: string;
  hsnCode: string;
  quantity: number;
  unitPrice: Money;
  taxableValue: Money;
  gstRatePercent: string;
  cgstAmount: Money;
  sgstAmount: Money;
  igstAmount: Money;
  lineTotal: Money;
}

export interface InvoiceView {
  id: string;
  orderId: string;
  userId: string;
  invoiceNumber: string;
  invoiceDate: string;
  buyerName: string;
  buyerAddress: string;
  buyerState: string;
  buyerGstin: string | null;
  businessName: string;
  businessGstin: string;
  businessAddress: string;
  businessState: string;
  subtotalTaxable: Money;
  totalCgst: Money;
  totalSgst: Money;
  totalIgst: Money;
  totalTax: Money;
  grandTotal: Money;
  placeOfSupply: string;
  taxType: 'CGST_SGST' | 'IGST';
  pdfPath: string;
  lines: InvoiceLineView[];
}

type InvoiceWithLines = Prisma.InvoiceGetPayload<{ include: { lines: true } }>;

function toInvoiceView(invoice: InvoiceWithLines): InvoiceView {
  return {
    id: invoice.id,
    orderId: invoice.orderId,
    userId: invoice.userId,
    invoiceNumber: invoice.invoiceNumber,
    invoiceDate: invoice.invoiceDate.toISOString(),
    buyerName: invoice.buyerName,
    buyerAddress: invoice.buyerAddress,
    buyerState: invoice.buyerState,
    buyerGstin: invoice.buyerGstin,
    businessName: invoice.businessName,
    businessGstin: invoice.businessGstin,
    businessAddress: invoice.businessAddress,
    businessState: invoice.businessState,
    subtotalTaxable: decimalToMoney(invoice.subtotalTaxable),
    totalCgst: decimalToMoney(invoice.totalCgst),
    totalSgst: decimalToMoney(invoice.totalSgst),
    totalIgst: decimalToMoney(invoice.totalIgst),
    totalTax: decimalToMoney(invoice.totalTax),
    grandTotal: decimalToMoney(invoice.grandTotal),
    placeOfSupply: invoice.placeOfSupply,
    taxType: invoice.taxType,
    pdfPath: invoice.pdfPath,
    lines: invoice.lines.map((line) => ({
      productId: line.productId,
      skuId: line.skuId,
      titleSnapshot: line.titleSnapshot,
      hsnCode: line.hsnCode,
      quantity: line.quantity,
      unitPrice: decimalToMoney(line.unitPrice),
      taxableValue: decimalToMoney(line.taxableValue),
      gstRatePercent: line.gstRatePercent.toFixed(2),
      cgstAmount: decimalToMoney(line.cgstAmount),
      sgstAmount: decimalToMoney(line.sgstAmount),
      igstAmount: decimalToMoney(line.igstAmount),
      lineTotal: decimalToMoney(line.lineTotal),
    })),
  };
}

async function findActiveInvoiceByOrderId(orderId: string): Promise<InvoiceWithLines | null> {
  return prisma.invoice.findFirst({
    where: { orderId, deletedAt: null },
    include: { lines: true },
  });
}

/**
 * Generates the GST tax invoice PDF + record for a CONFIRMED order.
 * IDEMPOTENT by construction: if an invoice already exists for this order,
 * it is returned as-is - NEVER regenerated, NEVER a second invoice number
 * issued for the same order (both the queued event-driven path on order
 * confirm, and the admin "regenerate" endpoint, funnel through this same
 * check).
 */
export async function generateInvoice(orderId: string): Promise<InvoiceView> {
  const existing = await findActiveInvoiceByOrderId(orderId);
  if (existing) {
    return toInvoiceView(existing);
  }

  const order = await orderClient.getInternalOrderForInvoice(orderId);
  if (order.status !== 'CONFIRMED') {
    throw new AppError(
      'CONFLICT',
      409,
      `Cannot generate an invoice for an order in status ${order.status}`,
    );
  }
  if (!order.shippingAddress) {
    throw new AppError(
      'CONFLICT',
      409,
      'Order has no shipping address snapshot; cannot generate invoice',
    );
  }
  if (order.items.length === 0) {
    throw new AppError('CONFLICT', 409, 'Order has no line items; cannot generate invoice');
  }

  const buyerState = order.shippingAddress.state;
  // Intra-state (CGST+SGST) vs inter-state (IGST), per the buyer's
  // shipping-snapshot state vs YouMart's own registered business state
  // (Ch6.4). Compared case-insensitively on the state NAME - the address
  // schema (Ch6.1) has no separate state-code column; a production system
  // would compare GST state CODES instead, a documented simplification.
  const taxType: 'CGST_SGST' | 'IGST' =
    buyerState.trim().toLowerCase() === config.businessState.trim().toLowerCase()
      ? 'CGST_SGST'
      : 'IGST';

  const lineInputs: InvoiceLineView[] = [];
  for (const item of order.items) {
    const sku = await catalogClient.getSku(item.skuId);
    const ratePercent = sku.gstRatePercent ?? config.defaultGstRatePercent;
    const hsnCode = sku.hsnCode ?? config.defaultHsnCode ?? '';

    // GST-INCLUSIVE back-calc: taxableValue + tax === lineTotal EXACTLY
    // (gstBackCalculate derives tax via subtraction, never a second
    // division - see shared-utils/money.ts).
    const { taxableValue, tax } = gstBackCalculate(item.lineTotal, ratePercent);

    let cgstAmount: Money = ZERO;
    let sgstAmount: Money = ZERO;
    let igstAmount: Money = ZERO;
    if (taxType === 'CGST_SGST') {
      // Odd-paisa handling: CGST gets the leftover paisa when `tax` can't
      // be split perfectly in half (see splitTaxEqually's doc comment) -
      // cgst + sgst === tax EXACTLY either way.
      const split = splitTaxEqually(tax);
      cgstAmount = split.first;
      sgstAmount = split.second;
    } else {
      igstAmount = tax;
    }

    lineInputs.push({
      productId: item.productId,
      skuId: item.skuId,
      titleSnapshot: item.title,
      hsnCode,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      taxableValue,
      gstRatePercent: ratePercent,
      cgstAmount,
      sgstAmount,
      igstAmount,
      lineTotal: item.lineTotal,
    });
  }

  const subtotalTaxable = sum(lineInputs.map((l) => l.taxableValue));
  const totalCgst = sum(lineInputs.map((l) => l.cgstAmount));
  const totalSgst = sum(lineInputs.map((l) => l.sgstAmount));
  const totalIgst = sum(lineInputs.map((l) => l.igstAmount));
  const totalTax = add(add(totalCgst, totalSgst), totalIgst);
  const grandTotal = add(subtotalTaxable, totalTax);

  // Reconciliation: grandTotal here is exactly sum(lineTotal) by
  // construction (taxableValue+tax reconstructs each lineTotal exactly),
  // so this should always equal order.grandTotal today (shippingTotal is
  // hard-coded "0.00" as of Ch4/Ch6 - see order.service.ts's checkout()).
  // Logged (never thrown) so a future non-zero shipping/discount charge
  // that isn't reflected per-line surfaces loudly instead of silently
  // producing a non-reconciling invoice.
  if (compare(grandTotal, order.grandTotal) !== 0) {
    logger.warn(
      { orderId, invoiceGrandTotal: grandTotal, orderGrandTotal: order.grandTotal },
      'invoice grand_total does not reconcile with order grand_total',
    );
  }

  const invoiceDate = new Date();
  const invoiceNumber = await generateInvoiceNumber(invoiceDate);
  const invoiceId = uuidv7();

  const buyerName = order.shippingAddress.fullName;
  const buyerAddress = [
    order.shippingAddress.line1,
    order.shippingAddress.line2,
    order.shippingAddress.landmark,
    order.shippingAddress.city,
    order.shippingAddress.pincode,
  ]
    .filter(Boolean)
    .join(', ');

  const pdfPath = await renderInvoicePdf(invoiceId, {
    invoiceNumber,
    invoiceDate,
    placeOfSupply: buyerState,
    taxType,
    businessName: config.businessLegalName,
    businessGstin: config.businessGstin,
    businessAddress: config.businessAddress,
    businessState: config.businessState,
    buyerName,
    buyerAddress,
    buyerState,
    buyerGstin: null, // B2C storefront - no buyer GSTIN capture exists yet
    lines: lineInputs,
    subtotalTaxable,
    totalCgst,
    totalSgst,
    totalIgst,
    totalTax,
    grandTotal,
  });

  const created = await prisma.$transaction(async (tx) => {
    const invoice = await tx.invoice.create({
      data: {
        id: invoiceId,
        orderId,
        userId: order.userId,
        invoiceNumber,
        invoiceDate,
        buyerName,
        buyerAddress,
        buyerState,
        buyerGstin: null,
        businessName: config.businessLegalName,
        businessGstin: config.businessGstin,
        businessAddress: config.businessAddress,
        businessState: config.businessState,
        subtotalTaxable,
        totalCgst,
        totalSgst,
        totalIgst,
        totalTax,
        grandTotal,
        pdfPath,
        placeOfSupply: buyerState,
        taxType,
      },
    });

    for (const line of lineInputs) {
      await tx.invoiceLine.create({
        data: {
          invoiceId: invoice.id,
          productId: line.productId,
          skuId: line.skuId,
          titleSnapshot: line.titleSnapshot,
          hsnCode: line.hsnCode,
          quantity: line.quantity,
          unitPrice: line.unitPrice,
          taxableValue: line.taxableValue,
          gstRatePercent: line.gstRatePercent,
          cgstAmount: line.cgstAmount,
          sgstAmount: line.sgstAmount,
          igstAmount: line.igstAmount,
          lineTotal: line.lineTotal,
        },
      });
    }

    return invoice;
  });

  logger.info({ orderId, invoiceId: created.id, invoiceNumber }, 'invoice generated');

  return findActiveInvoiceByOrderId(orderId).then((view) => toInvoiceView(view!));
}

export async function getInvoiceByOrderId(orderId: string): Promise<InvoiceView | null> {
  const invoice = await findActiveInvoiceByOrderId(orderId);
  return invoice ? toInvoiceView(invoice) : null;
}

export async function getInvoiceById(id: string): Promise<InvoiceView | null> {
  const invoice = await prisma.invoice.findFirst({
    where: { id, deletedAt: null },
    include: { lines: true },
  });
  return invoice ? toInvoiceView(invoice) : null;
}

export interface InvoiceListItem {
  id: string;
  orderId: string;
  invoiceNumber: string;
  invoiceDate: string;
  grandTotal: Money;
  taxType: 'CGST_SGST' | 'IGST';
}

export async function listInvoices(): Promise<InvoiceListItem[]> {
  const invoices = await prisma.invoice.findMany({
    where: { deletedAt: null },
    orderBy: { createdAt: 'desc' },
    take: 200,
  });
  return invoices.map((invoice) => ({
    id: invoice.id,
    orderId: invoice.orderId,
    invoiceNumber: invoice.invoiceNumber,
    invoiceDate: invoice.invoiceDate.toISOString(),
    grandTotal: decimalToMoney(invoice.grandTotal),
    taxType: invoice.taxType,
  }));
}
