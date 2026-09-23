import Decimal from 'decimal.js';
import { Money } from '@youmart/shared-types';

// Scoped Decimal constructor (via .clone) so we never mutate decimal.js's global config for
// other consumers in the app. All money math rounds ROUND_HALF_UP - this is a generic default,
// NOT a legal/statutory rounding rule. Domains with their own rounding requirements (e.g. GST
// invoice totals) must apply that rounding themselves on top of these primitives.
const D = Decimal.clone({ rounding: Decimal.ROUND_HALF_UP });

function assertMoney(value: string, label: string): asserts value is Money {
  if (!Money.safeParse(value).success) {
    throw new Error(`${label} is not a valid Money value: "${value}"`);
  }
}

function toDecimal(value: Money): InstanceType<typeof D> {
  return new D(value);
}

function fromDecimal(value: InstanceType<typeof D>): Money {
  return value.toFixed(2, D.ROUND_HALF_UP) as Money;
}

export function add(a: Money, b: Money): Money {
  assertMoney(a, 'a');
  assertMoney(b, 'b');
  return fromDecimal(toDecimal(a).plus(toDecimal(b)));
}

export function subtract(a: Money, b: Money): Money {
  assertMoney(a, 'a');
  assertMoney(b, 'b');
  return fromDecimal(toDecimal(a).minus(toDecimal(b)));
}

export function multiplyByQuantity(price: Money, qty: number): Money {
  assertMoney(price, 'price');
  if (!Number.isInteger(qty) || qty < 0) {
    throw new Error(`qty must be a non-negative whole number, got: ${qty}`);
  }
  return fromDecimal(toDecimal(price).times(qty));
}

export function percentageOf(amount: Money, ratePercent: string): Money {
  assertMoney(amount, 'amount');
  const rate = new D(ratePercent);
  if (!rate.isFinite()) {
    throw new Error(`ratePercent is not a valid number: "${ratePercent}"`);
  }
  return fromDecimal(toDecimal(amount).times(rate).dividedBy(100));
}

export function sum(amounts: Money[]): Money {
  return amounts.reduce<Money>((total, amount) => add(total, amount), '0.00' as Money);
}

export function compare(a: Money, b: Money): -1 | 0 | 1 {
  assertMoney(a, 'a');
  assertMoney(b, 'b');
  return toDecimal(a).comparedTo(toDecimal(b)) as -1 | 0 | 1;
}

export function isGreaterThanOrEqual(a: Money, b: Money): boolean {
  return compare(a, b) >= 0;
}

// Normalizes any valid decimal string to 2dp Money (rounding half-up as needed).
// Throws only when the input isn't a valid decimal number at all.
export function toMoney(value: string): Money {
  const decimal = new D(value);
  if (!decimal.isFinite()) {
    throw new Error(`toMoney: not a valid decimal number: "${value}"`);
  }
  return fromDecimal(decimal);
}

export interface GstBackCalculation {
  taxableValue: Money;
  tax: Money;
}

/**
 * Back-calculates the taxable value and GST tax portion out of a
 * GST-INCLUSIVE amount (YouMart's product prices already include GST) -
 * taxableValue = inclusiveAmount * 100 / (100 + ratePercent), and
 * tax = inclusiveAmount - taxableValue (via `subtract`, not a second
 * division), which is what GUARANTEES `taxableValue + tax === inclusiveAmount`
 * exactly, to the paisa, every time - required for GST invoice compliance
 * (invoice-service, Ch6.4).
 */
export function gstBackCalculate(inclusiveAmount: Money, ratePercent: string): GstBackCalculation {
  assertMoney(inclusiveAmount, 'inclusiveAmount');
  const rate = new D(ratePercent);
  if (!rate.isFinite()) {
    throw new Error(`ratePercent is not a valid number: "${ratePercent}"`);
  }
  const taxableValue = fromDecimal(toDecimal(inclusiveAmount).times(100).dividedBy(rate.plus(100)));
  const tax = subtract(inclusiveAmount, taxableValue);
  return { taxableValue, tax };
}

export interface EqualTaxSplit {
  first: Money;
  second: Money;
}

/**
 * Splits a tax amount into two equal (CGST/SGST) halves, handling an odd
 * paisa exactly: `second` is the floor-rounded-down half, and `first` gets
 * whatever's left over (`subtract(tax, second)`) - so `first + second ===
 * tax` exactly, always, even when `tax` has an odd number of paisa (e.g.
 * tax "0.01" -> first "0.01", second "0.00"). Callers pass CGST as `first`
 * so CGST is the one that (rarely) receives the extra paisa - an
 * arbitrary but documented, consistent convention (Ch6.4).
 */
export function splitTaxEqually(tax: Money): EqualTaxSplit {
  assertMoney(tax, 'tax');
  const second = toDecimal(tax).dividedBy(2).toDecimalPlaces(2, D.ROUND_DOWN);
  const secondMoney = fromDecimal(second);
  const first = subtract(tax, secondMoney);
  return { first, second: secondMoney };
}
