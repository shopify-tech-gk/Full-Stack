// v1.16 delivery charges - the storefront's PREVIEW copy of the rule order-service charges
// (packages/shared-utils/src/delivery.ts is authoritative; change both together).
//
//  - Items subtotal (before any coupon) of FREE_DELIVERY_MIN or more: free delivery.
//  - Below that, by the delivery address: Coimbatore / Chennai / Hyderabad / Bangalore Rs 80;
//    elsewhere in Tamil Nadu / Telangana / Karnataka Rs 120; any other state Rs 150.
import { fromPaise, toPaise } from './money';
import type { Money } from './types';

export const FREE_DELIVERY_MIN: Money = '2000.00';

export type DeliveryZone = 'METRO' | 'HOME_STATE' | 'OTHER_STATE';

export const DELIVERY_FEES: Record<DeliveryZone, Money> = {
  METRO: '80.00',
  HOME_STATE: '120.00',
  OTHER_STATE: '150.00',
};

const key = (s: string): string => s.toLowerCase().replace(/[^a-z]/g, '');

const METRO_CITIES = new Set(
  [
    'Coimbatore',
    'Kovai',
    'Chennai',
    'Madras',
    'Hyderabad',
    'Secunderabad',
    'Bangalore',
    'Bengaluru',
    'Bangaluru',
  ].map(key),
);

const HOME_STATES = new Set(
  ['Tamil Nadu', 'Tamilnadu', 'TN', 'Telangana', 'TS', 'Karnataka', 'KA'].map(key),
);

export function deliveryZone(address: { city: string; state: string }): DeliveryZone {
  if (METRO_CITIES.has(key(address.city))) return 'METRO';
  if (HOME_STATES.has(key(address.state))) return 'HOME_STATE';
  return 'OTHER_STATE';
}

/**
 * The delivery charge for this items subtotal. `address` null (not chosen / signed out): free
 * when over the threshold, otherwise null = "depends on the address".
 */
export function deliveryFee(
  subtotal: Money,
  address: { city: string; state: string } | null,
): Money | null {
  if (toPaise(subtotal) >= toPaise(FREE_DELIVERY_MIN)) return '0.00';
  return address ? DELIVERY_FEES[deliveryZone(address)] : null;
}

export interface FreeDeliveryProgress {
  unlocked: boolean;
  /** What is still needed for free delivery ('0.00' once unlocked). */
  remaining: Money;
  /** 0..1 for a progress bar. */
  ratio: number;
}

export function freeDeliveryProgress(subtotal: Money): FreeDeliveryProgress {
  const have = toPaise(subtotal);
  const need = toPaise(FREE_DELIVERY_MIN);
  return {
    unlocked: have >= need,
    remaining: fromPaise(Math.max(0, need - have)),
    ratio: need > 0 ? Math.min(1, have / need) : 1,
  };
}

/** "₹80 delivery" / "FREE delivery" / "₹80-₹150 delivery" when the address is unknown. */
export function deliveryLabel(fee: Money | null): string {
  if (fee === null) return '₹80–₹150 (by location)';
  return toPaise(fee) === 0 ? 'Free' : `₹${Number(fee).toLocaleString('en-IN')}`;
}
