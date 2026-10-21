import type { Money } from '@youmart/shared-types';
import { compare } from './money';

// v1.16 delivery charges - the AUTHORITATIVE rule (order-service charges it at checkout). Kept in
// step with packages/shared-client/src/delivery.ts (the storefront's preview copy); change both.
//
//  - Items subtotal (before any coupon) of FREE_DELIVERY_MIN or more: free delivery.
//  - Below that, by the delivery address:
//      Coimbatore / Chennai / Hyderabad / Bangalore ..................... Rs 80
//      elsewhere in Tamil Nadu / Telangana / Karnataka .................. Rs 120
//      any other state .................................................. Rs 150

export const FREE_DELIVERY_MIN: Money = '2000.00' as Money;

export type DeliveryZone = 'METRO' | 'HOME_STATE' | 'OTHER_STATE';

export const DELIVERY_FEES: Record<DeliveryZone, Money> = {
  METRO: '80.00' as Money,
  HOME_STATE: '120.00' as Money,
  OTHER_STATE: '150.00' as Money,
};

const key = (s: string): string => s.toLowerCase().replace(/[^a-z]/g, '');

/** Our four delivery cities, with the spellings customers type. */
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

/** The states those cities are in. */
const HOME_STATES = new Set(['Tamil Nadu', 'Tamilnadu', 'TN', 'Telangana', 'TS', 'Karnataka', 'KA'].map(key));

export function deliveryZone(address: { city: string; state: string }): DeliveryZone {
  if (METRO_CITIES.has(key(address.city))) return 'METRO';
  if (HOME_STATES.has(key(address.state))) return 'HOME_STATE';
  return 'OTHER_STATE';
}

/** The delivery charge for an order with this items subtotal going to this address. */
export function deliveryFee(subtotal: Money, address: { city: string; state: string }): Money {
  if (compare(subtotal, FREE_DELIVERY_MIN) >= 0) return '0.00' as Money;
  return DELIVERY_FEES[deliveryZone(address)];
}
