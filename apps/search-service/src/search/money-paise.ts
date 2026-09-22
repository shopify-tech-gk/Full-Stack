/**
 * Exact integer-string-splitting conversion (never `parseFloat(x) * 100`) -
 * same discipline as payment-service's money-paise.ts (Ch4.6), reused here
 * because Typesense stores `pricePaise` as an int32 for exact range
 * filtering/sorting; a `Money` string is always `"<digits>.<exactly 2
 * digits>"`, and converting back on read never drifts.
 */
export function moneyToPaise(value: string): number {
  const [rupees, paise = '00'] = value.split('.');
  return Number(rupees) * 100 + Number(paise.padEnd(2, '0').slice(0, 2));
}

export function paiseToMoney(paise: number): string {
  const rupees = Math.floor(paise / 100);
  const remainder = Math.abs(paise % 100);
  return `${rupees}.${String(remainder).padStart(2, '0')}`;
}
