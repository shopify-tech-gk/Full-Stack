// DEMO CONTENT ONLY - account/address/order data for layout work. Replace with the auth,
// address (/api/addresses) and order (/api/orders + /api/logistics) APIs.
import type { AccountOrder } from './account';
import type { Address, AddressInput } from './types';

/** Any 10-digit mobile + this code logs into the demo account. */
export const DEMO_OTP_CODE = '123456';

export const DEMO_USER = {
  id: 'demo-user',
  name: 'Demo Customer',
  phone: '+919876500000',
  email: 'demo.customer@example.com',
} as const;

const stamp = '2026-09-01T10:00:00.000Z';

export const DEMO_ADDRESSES: readonly Address[] = [
  {
    id: 'demo-address-1',
    fullName: 'Demo Customer',
    phone: '+919876500000',
    line1: '12, Demo Street',
    line2: 'Flat 3B, Demo Apartments',
    landmark: 'Near Demo Park',
    city: 'Chennai',
    state: 'Tamil Nadu',
    pincode: '600001',
    country: 'India',
    addressType: 'HOME',
    isDefault: true,
    createdAt: stamp,
    updatedAt: stamp,
  },
  {
    id: 'demo-address-2',
    fullName: 'Demo Customer',
    phone: '+919876500001',
    line1: '45, Demo Business Park',
    line2: null,
    landmark: null,
    city: 'Coimbatore',
    state: 'Tamil Nadu',
    pincode: '641001',
    country: 'India',
    addressType: 'WORK',
    isDefault: false,
    createdAt: stamp,
    updatedAt: stamp,
  },
];

const [home] = DEMO_ADDRESSES;
const shipping = {
  addressId: home?.id ?? 'demo-address-1',
  fullName: 'Demo Customer',
  phone: '+919876500000',
  line1: '12, Demo Street',
  line2: 'Flat 3B, Demo Apartments',
  landmark: 'Near Demo Park',
  city: 'Chennai',
  state: 'Tamil Nadu',
  pincode: '600001',
  country: 'India',
};

const item = (
  n: number,
  title: string,
  unitPrice: string,
  quantity: number,
  sellerStatus: AccountOrder['items'][number]['sellerStatus'],
) => ({
  skuId: `demo-sku-${n}`,
  productId: `demo-product-${n}`,
  sellerId: 'demo-seller',
  title,
  unitPrice,
  quantity,
  lineTotal: (Number(unitPrice) * quantity).toFixed(2),
  sellerStatus,
});

export const DEMO_ORDERS: readonly AccountOrder[] = [
  {
    orderId: 'demo-order-1',
    orderNumber: 'YM-DEMO-1001',
    status: 'CONFIRMED',
    createdAt: '2026-09-24T09:30:00.000Z',
    items: [
      item(1, 'Demo Product Name', '495.00', 1, 'SHIPPED'),
      item(2, 'Demo Product Two', '249.00', 2, 'SHIPPED'),
    ],
    subtotal: '993.00',
    shippingTotal: '40.00',
    grandTotal: '1033.00',
    shippingAddress: shipping,
    events: [
      { status: 'Order placed', occurredAt: '2026-09-24T09:30:00.000Z' },
      { status: 'Packed', location: 'Chennai warehouse', occurredAt: '2026-09-25T11:10:00.000Z' },
      { status: 'Shipped', location: 'Chennai hub', occurredAt: '2026-09-26T08:45:00.000Z' },
    ],
  },
  {
    orderId: 'demo-order-2',
    orderNumber: 'YM-DEMO-1002',
    status: 'CONFIRMED',
    createdAt: '2026-09-10T14:05:00.000Z',
    items: [item(3, 'Demo Item', '1299.00', 1, 'DELIVERED')],
    subtotal: '1299.00',
    shippingTotal: '0.00',
    grandTotal: '1299.00',
    shippingAddress: shipping,
    events: [
      { status: 'Order placed', occurredAt: '2026-09-10T14:05:00.000Z' },
      { status: 'Packed', location: 'Chennai warehouse', occurredAt: '2026-09-11T10:00:00.000Z' },
      { status: 'Shipped', location: 'Chennai hub', occurredAt: '2026-09-11T18:20:00.000Z' },
      { status: 'Delivered', location: 'Chennai', occurredAt: '2026-09-13T12:40:00.000Z' },
    ],
  },
  {
    orderId: 'demo-order-3',
    orderNumber: 'YM-DEMO-1003',
    status: 'PENDING_PAYMENT',
    createdAt: '2026-09-28T19:15:00.000Z',
    items: [item(4, 'Demo Product Long Name For Wrapping Test Case', '77.00', 3, 'PENDING')],
    subtotal: '231.00',
    shippingTotal: '40.00',
    grandTotal: '271.00',
    shippingAddress: shipping,
    events: [{ status: 'Order placed', occurredAt: '2026-09-28T19:15:00.000Z' }],
  },
];

export function findDemoOrder(orderNumber: string): AccountOrder | null {
  const wanted = orderNumber.trim().toUpperCase();
  return DEMO_ORDERS.find((order) => order.orderNumber === wanted) ?? null;
}

/** Stand-in for the Address that POST /api/addresses returns. */
export function demoSavedAddress(input: AddressInput, id: string, now: Date): Address {
  const stampNow = now.toISOString();
  return {
    id,
    fullName: input.fullName,
    phone: input.phone,
    line1: input.line1,
    line2: input.line2 ?? null,
    landmark: input.landmark ?? null,
    city: input.city,
    state: input.state,
    pincode: input.pincode,
    country: input.country ?? 'India',
    addressType: input.addressType ?? 'HOME',
    isDefault: Boolean(input.isDefault),
    createdAt: stampNow,
    updatedAt: stampNow,
  };
}
