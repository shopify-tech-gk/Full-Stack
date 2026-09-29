// Data seam for the account + order-track routes. DEMO data today; swap each body for
// api.addresses.list(), api.orders.list()/get() and api.logistics.trackOrderItem() later.
import {
  DEMO_ADDRESSES,
  DEMO_ORDERS,
  findDemoOrder,
  type AccountOrder,
  type Address,
} from '@youmart/shared-client';

export async function getAddresses(): Promise<readonly Address[]> {
  return DEMO_ADDRESSES;
}

export async function getOrders(): Promise<readonly AccountOrder[]> {
  return DEMO_ORDERS;
}

export async function trackOrder(orderNumber: string): Promise<AccountOrder | null> {
  return findDemoOrder(orderNumber);
}
