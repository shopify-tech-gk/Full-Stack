import type { Money } from '@youmart/shared-types';

/**
 * Exact Money->paise conversion - never a float multiplication. Money is
 * always "<digits>.<exactly 2 digits>" (enforced by the Money zod schema),
 * so splitting on the decimal point and combining as integers avoids any
 * possibility of float drift (`parseFloat(value) * 100` can misrepresent
 * some decimal values in IEEE-754 double precision).
 */
export function moneyToPaise(value: Money): number {
  const [rupees, paise] = value.split('.');
  return Number(rupees) * 100 + Number(paise);
}

/** Inverse of `moneyToPaise` - also exact, integer-only arithmetic. */
export function paiseToMoney(paise: number): Money {
  const rupees = Math.floor(paise / 100);
  const remainder = paise % 100;
  return `${rupees}.${remainder.toString().padStart(2, '0')}` as Money;
}
