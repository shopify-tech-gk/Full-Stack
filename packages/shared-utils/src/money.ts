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
