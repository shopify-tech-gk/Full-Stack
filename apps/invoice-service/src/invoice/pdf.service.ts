import fs from 'node:fs';
import path from 'node:path';
import PDFDocument from 'pdfkit';
import type { Money } from '@youmart/shared-types';
import { config } from '../config';

export interface InvoicePdfLine {
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

export interface InvoicePdfData {
  invoiceNumber: string;
  invoiceDate: Date;
  placeOfSupply: string;
  taxType: 'CGST_SGST' | 'IGST';
  businessName: string;
  businessGstin: string;
  businessAddress: string;
  businessState: string;
  buyerName: string;
  buyerAddress: string;
  buyerState: string;
  buyerGstin: string | null;
  lines: InvoicePdfLine[];
  subtotalTaxable: Money;
  totalCgst: Money;
  totalSgst: Money;
  totalIgst: Money;
  totalTax: Money;
  grandTotal: Money;
}

/**
 * DEV storage: PDFs are written to a local directory (`INVOICE_STORAGE_DIR`,
 * default `./storage/invoices`), one file per invoice, keyed by invoice id -
 * simple and sufficient for local development. PRODUCTION should swap this
 * for S3/CDN object storage (same pattern as catalog's product-image CDN,
 * Ch2/Ch4.1) - `pdf_path` would then hold an S3 key/URL instead of a local
 * filesystem path; this function is the ONLY place that decision needs to
 * change (everything else just persists/reads back whatever string
 * `pdf_path` is). Not implemented here - explicitly out of scope for a dev
 * environment with no real bucket, and documented per the task's caution.
 */
function resolvePdfPath(invoiceId: string): string {
  return path.join(config.invoiceStorageDir, `${invoiceId}.pdf`);
}

function drawLineTableHeader(doc: PDFKit.PDFDocument, y: number): number {
  doc.font('Helvetica-Bold').fontSize(8);
  const columns = ['#', 'Item', 'HSN', 'Qty', 'Taxable', 'Rate%', 'CGST', 'SGST', 'IGST', 'Total'];
  const widths = [20, 130, 50, 30, 60, 40, 50, 50, 50, 60];
  let x = 40;
  columns.forEach((col, i) => {
    doc.text(col, x, y, { width: widths[i], align: i === 1 ? 'left' : 'right' });
    x += widths[i]!;
  });
  return y + 14;
}

function drawLineRow(
  doc: PDFKit.PDFDocument,
  y: number,
  index: number,
  line: InvoicePdfLine,
): number {
  doc.font('Helvetica').fontSize(8);
  const widths = [20, 130, 50, 30, 60, 40, 50, 50, 50, 60];
  const values = [
    String(index + 1),
    line.titleSnapshot,
    line.hsnCode,
    String(line.quantity),
    line.taxableValue,
    `${line.gstRatePercent}%`,
    line.cgstAmount,
    line.sgstAmount,
    line.igstAmount,
    line.lineTotal,
  ];
  let x = 40;
  values.forEach((val, i) => {
    doc.text(val, x, y, { width: widths[i], align: i === 1 ? 'left' : 'right' });
    x += widths[i]!;
  });
  return y + 16;
}

/**
 * Renders a GST-compliant tax invoice PDF and writes it to
 * `INVOICE_STORAGE_DIR` - returns the stored `pdfPath` (persisted onto the
 * Invoice row by invoice.service.ts, inside the SAME transaction as the
 * DB rows, so a record never exists without its file or vice versa within
 * this process's own success path).
 */
export async function renderInvoicePdf(invoiceId: string, data: InvoicePdfData): Promise<string> {
  fs.mkdirSync(config.invoiceStorageDir, { recursive: true });
  const pdfPath = resolvePdfPath(invoiceId);

  await new Promise<void>((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 40 });
    const stream = fs.createWriteStream(pdfPath);
    doc.pipe(stream);

    doc.font('Helvetica-Bold').fontSize(16).text('TAX INVOICE', { align: 'center' });
    doc.moveDown(0.5);

    doc.font('Helvetica-Bold').fontSize(11).text(data.businessName);
    doc.font('Helvetica').fontSize(9);
    doc.text(data.businessAddress);
    doc.text(`State: ${data.businessState}`);
    doc.text(`GSTIN: ${data.businessGstin}`);
    doc.moveDown(0.5);

    doc
      .font('Helvetica-Bold')
      .fontSize(9)
      .text(`Invoice No: ${data.invoiceNumber}`, { continued: true });
    doc.text(`      Invoice Date: ${data.invoiceDate.toISOString().slice(0, 10)}`);
    doc.text(`Place of Supply: ${data.placeOfSupply}`);
    doc.text(
      `Tax Type: ${data.taxType === 'CGST_SGST' ? 'CGST + SGST (Intra-state)' : 'IGST (Inter-state)'}`,
    );
    doc.moveDown(0.5);

    doc.font('Helvetica-Bold').fontSize(9).text('Bill To:');
    doc.font('Helvetica').fontSize(9);
    doc.text(data.buyerName);
    doc.text(data.buyerAddress);
    doc.text(`State: ${data.buyerState}`);
    doc.text(`GSTIN: ${data.buyerGstin ?? 'N/A (B2C)'}`);
    doc.moveDown(0.5);

    let y = doc.y + 5;
    y = drawLineTableHeader(doc, y);
    doc
      .moveTo(40, y - 2)
      .lineTo(560, y - 2)
      .stroke();
    data.lines.forEach((line, index) => {
      y = drawLineRow(doc, y, index, line);
    });
    doc.moveTo(40, y).lineTo(560, y).stroke();
    y += 10;

    doc.font('Helvetica-Bold').fontSize(9);
    doc.text(`Subtotal (Taxable Value): ${data.subtotalTaxable}`, 350, y, {
      width: 210,
      align: 'right',
    });
    y += 14;
    if (data.taxType === 'CGST_SGST') {
      doc.text(`CGST: ${data.totalCgst}`, 350, y, { width: 210, align: 'right' });
      y += 14;
      doc.text(`SGST: ${data.totalSgst}`, 350, y, { width: 210, align: 'right' });
      y += 14;
    } else {
      doc.text(`IGST: ${data.totalIgst}`, 350, y, { width: 210, align: 'right' });
      y += 14;
    }
    doc.text(`Total Tax: ${data.totalTax}`, 350, y, { width: 210, align: 'right' });
    y += 14;
    doc.font('Helvetica-Bold').fontSize(11);
    doc.text(`Grand Total: ${data.grandTotal}`, 350, y, { width: 210, align: 'right' });

    doc.end();
    stream.on('finish', () => resolve());
    stream.on('error', reject);
  });

  return pdfPath;
}
