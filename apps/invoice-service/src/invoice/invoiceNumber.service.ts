import { Prisma } from '@youmart/db';
import { prisma } from '../db';
import { config } from '../config';

/**
 * Indian financial year: Apr 1 - Mar 31. `date`'s UTC month/year are used
 * (order confirmation timestamps are UTC) - e.g. 2026-09-23 -> "2026-27";
 * 2027-02-01 -> "2026-27" (Jan-Mar belongs to the FY that started the
 * PREVIOUS April).
 */
export function getFinancialYear(date: Date): string {
  const year = date.getUTCFullYear();
  const month = date.getUTCMonth(); // 0 = Jan, 3 = Apr
  const fyStartYear = month >= 3 ? year : year - 1;
  const fyEndYearShort = String((fyStartYear + 1) % 100).padStart(2, '0');
  return `${fyStartYear}-${fyEndYearShort}`;
}

/**
 * Concurrency-safe sequential-per-financial-year number reservation.
 *
 * APPROACH: one `invoice_counter` row per financial year, holding the NEXT
 * number to assign. Reservation is a single atomic `UPDATE ... SET
 * next_number = next_number + 1 ... RETURNING` (expressed here as Prisma's
 * `update({ data: { nextNumber: { increment: 1 } } })`) - Postgres
 * serializes concurrent UPDATEs to the SAME row via its row-level lock, so
 * two concurrent callers can never receive the same number: whichever
 * transaction's UPDATE commits first is visible to the next, and each
 * commit's `RETURNING` value is strictly the next integer. The number
 * ASSIGNED to the caller is `updated.nextNumber - 1` (the counter stores
 * the NEXT number to hand out, so the row is incremented THEN the
 * pre-increment value is used).
 *
 * The only race window is the FIRST invoice of a brand-new financial year
 * (the counter row doesn't exist yet): two concurrent first-callers could
 * both see "no row" and both attempt `create`. Postgres's unique
 * constraint on `financial_year` guarantees only ONE `create` wins; the
 * loser's unique-violation is caught and the function retries the
 * `update` path (now guaranteed to succeed, since the row exists).
 *
 * A partial-unique index on `invoice.invoice_number` (migration
 * 20260923052229) is the DB-level BACKSTOP against this ever producing a
 * duplicate in practice - defense-in-depth, not the primary mechanism.
 */
export async function reserveNextInvoiceNumber(financialYear: string): Promise<number> {
  try {
    const updated = await prisma.invoiceCounter.update({
      where: { financialYear },
      data: { nextNumber: { increment: 1 } },
    });
    return updated.nextNumber - 1;
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2025') {
      try {
        await prisma.invoiceCounter.create({ data: { financialYear, nextNumber: 2 } });
        return 1;
      } catch (createErr) {
        if (
          createErr instanceof Prisma.PrismaClientKnownRequestError &&
          createErr.code === 'P2002'
        ) {
          // Lost a race to another concurrent first-of-FY request - the row
          // now exists, so the update path is guaranteed to succeed.
          return reserveNextInvoiceNumber(financialYear);
        }
        throw createErr;
      }
    }
    throw err;
  }
}

/** Formats "YM/2026-27/00001" - PREFIX/FY/5-digit-zero-padded-sequence. */
export function formatInvoiceNumber(financialYear: string, sequence: number): string {
  return `${config.invoiceNumberPrefix}/${financialYear}/${String(sequence).padStart(5, '0')}`;
}

export async function generateInvoiceNumber(invoiceDate: Date): Promise<string> {
  const financialYear = getFinancialYear(invoiceDate);
  const sequence = await reserveNextInvoiceNumber(financialYear);
  return formatInvoiceNumber(financialYear, sequence);
}
