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

/**
 * Whole-number discount percentage for badges, rounded half-up like live
 * (mrp "1861.11", selling "1474.00" -> 21).
 */
export function discountPercent(mrp: Money, sellingPrice: Money): number {
  if (!isMoney(mrp) || !isMoney(sellingPrice)) {
    return 0;
  }
  const mrpPaise = toPaise(mrp);
  const sellingPaise = toPaise(sellingPrice);
  if (mrpPaise <= 0 || sellingPaise >= mrpPaise) {
    return 0;
  }
  return Math.floor(((mrpPaise - sellingPaise) * 200 + mrpPaise) / (mrpPaise * 2));
}

/** Exact integer conversion by splitting on "." - no float multiplication. */
export function toPaise(value: Money): number {
  const [whole = '0', fraction = '00'] = value.split('.');
  return Number(whole) * 100 + Number(fraction);
}

/** Inverse of toPaise for non-negative integer paise (24750 -> "247.50"). */
export function fromPaise(paise: number): Money {
  const whole = Math.floor(paise / 100);
  return `${whole}.${String(paise % 100).padStart(2, '0')}`;
}
