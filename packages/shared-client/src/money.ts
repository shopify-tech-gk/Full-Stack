import type { Money } from './types';

const MONEY_PATTERN = /^\d+\.\d{2}$/;

const inrFormatter = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function isMoney(value: unknown): value is Money {
  return typeof value === 'string' && MONEY_PATTERN.test(value);
}

/** Display-only formatting ("1299.00" -> "₹1,299.00"). Never do arithmetic on the result. */
export function formatMoney(value: Money): string {
  if (!isMoney(value)) {
    return value;
  }
  return inrFormatter.format(Number(value));
}

/** Whole-number discount percentage for badges, e.g. mrp "1499.00", selling "1299.00" -> 13. */
export function discountPercent(mrp: Money, sellingPrice: Money): number {
  if (!isMoney(mrp) || !isMoney(sellingPrice)) {
    return 0;
  }
  const mrpPaise = toPaise(mrp);
  const sellingPaise = toPaise(sellingPrice);
  if (mrpPaise <= 0 || sellingPaise >= mrpPaise) {
    return 0;
  }
  return Math.floor(((mrpPaise - sellingPaise) * 100) / mrpPaise);
}

/** Exact integer conversion by splitting on "." - no float multiplication. */
export function toPaise(value: Money): number {
  const [whole = '0', fraction = '00'] = value.split('.');
  return Number(whole) * 100 + Number(fraction);
}
