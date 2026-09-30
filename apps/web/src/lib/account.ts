// Data seam for the order routes. DEMO data until W5; swap each body for api.orders.list()/get()
// and api.logistics.trackOrderItem(). Addresses are real (W4): api.addresses, client-side.
import { DEMO_ORDERS, findDemoOrder, type AccountOrder } from '@youmart/shared-client';

export async function getOrders(): Promise<readonly AccountOrder[]> {
  return DEMO_ORDERS;
}

export async function trackOrder(orderNumber: string): Promise<AccountOrder | null> {
  return findDemoOrder(orderNumber);
}
