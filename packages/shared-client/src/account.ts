import type { Address, AddressInput, OrderView, SellerItemStatus } from './types';

// --- Account navigation (live WooCommerce My Account menu + YouMart extras) ---
export type AccountSection =
  'dashboard' | 'orders' | 'track' | 'addresses' | 'account' | 'wishlist' | 'logout';

export const ACCOUNT_NAV: readonly { key: AccountSection; label: string; href: string }[] = [
  { key: 'dashboard', label: 'Dashboard', href: '/my-account' },
  { key: 'orders', label: 'Orders', href: '/my-account/orders' },
  { key: 'track', label: 'Track Order', href: '/order-track' },
  { key: 'addresses', label: 'Addresses', href: '/my-account/edit-address' },
  { key: 'account', label: 'Account details', href: '/my-account/edit-account' },
  { key: 'wishlist', label: 'Wishlist', href: '/wishlist' },
  { key: 'logout', label: 'Log out', href: '/my-account' },
];

// --- Phone / OTP (auth-service: E.164 phone, 6-digit code) ---
export const OTP_LENGTH = 6;
export const OTP_RESEND_SECONDS = 60;

/** Accepts a 10-digit Indian mobile (optionally 0/91-prefixed) or full E.164; returns E.164. */
export function toE164Phone(input: string): string | null {
  const raw = input.replace(/[\s()-]/g, '');
  if (/^\+[1-9]\d{7,14}$/.test(raw)) {
    return raw;
  }
  const local = raw.replace(/^(?:\+?91|0)(?=\d{10}$)/, '');
  return /^[6-9]\d{9}$/.test(local) ? `+91${local}` : null;
}

/** "+919876500000" -> "98765 00000" for display in an Indian-number field. */
export function toLocalPhone(e164: string): string {
  const local = e164.startsWith('+91') ? e164.slice(3) : e164;
  return local.length === 10 ? `${local.slice(0, 5)} ${local.slice(5)}` : local;
}

// --- Addresses (address-service CreateAddressBody) ---
export const ADDRESS_TYPES = [
  { value: 'HOME', label: 'Home' },
  { value: 'WORK', label: 'Work' },
  { value: 'OTHER', label: 'Other' },
] as const;
export type AddressType = (typeof ADDRESS_TYPES)[number]['value'];

/** WooCommerce's India state list (states + union territories). */
export const INDIAN_STATES = [
  'Andaman and Nicobar Islands',
  'Andhra Pradesh',
  'Arunachal Pradesh',
  'Assam',
  'Bihar',
  'Chandigarh',
  'Chhattisgarh',
  'Dadra and Nagar Haveli and Daman and Diu',
  'Delhi',
  'Goa',
  'Gujarat',
  'Haryana',
  'Himachal Pradesh',
  'Jammu and Kashmir',
  'Jharkhand',
  'Karnataka',
  'Kerala',
  'Ladakh',
  'Lakshadweep',
  'Madhya Pradesh',
  'Maharashtra',
  'Manipur',
  'Meghalaya',
  'Mizoram',
  'Nagaland',
  'Odisha',
  'Puducherry',
  'Punjab',
  'Rajasthan',
  'Sikkim',
  'Tamil Nadu',
  'Telangana',
  'Tripura',
  'Uttar Pradesh',
  'Uttarakhand',
  'West Bengal',
] as const;

/** Form state: every field a string/boolean, mapped 1:1 onto `AddressInput`. */
export interface AddressFormValues {
  fullName: string;
  phone: string;
  line1: string;
  line2: string;
  landmark: string;
  city: string;
  state: string;
  pincode: string;
  country: string;
  addressType: AddressType;
  isDefault: boolean;
}

export type AddressFormErrors = Partial<Record<keyof AddressFormValues, string>>;

export const EMPTY_ADDRESS_FORM: AddressFormValues = {
  fullName: '',
  phone: '',
  line1: '',
  line2: '',
  landmark: '',
  city: '',
  state: '',
  pincode: '',
  country: 'India',
  addressType: 'HOME',
  isDefault: false,
};

export function addressToForm(address: Address): AddressFormValues {
  const type = ADDRESS_TYPES.find((t) => t.value === address.addressType)?.value ?? 'OTHER';
  return {
    fullName: address.fullName,
    phone: toLocalPhone(address.phone),
    line1: address.line1,
    line2: address.line2 ?? '',
    landmark: address.landmark ?? '',
    city: address.city,
    state: address.state,
    pincode: address.pincode,
    country: address.country,
    addressType: type,
    isDefault: address.isDefault,
  };
}

/** Client-side mirror of the address-service Zod rules; returns the API body when valid. */
export function validateAddressForm(values: AddressFormValues): {
  input: AddressInput | null;
  errors: AddressFormErrors;
} {
  const errors: AddressFormErrors = {};
  const text = (key: keyof AddressFormValues, max: number, label: string, required = true) => {
    const value = String(values[key]).trim();
    if (required && !value) errors[key] = `${label} is a required field.`;
    else if (value.length > max) errors[key] = `${label} must be at most ${max} characters.`;
    return value;
  };
  const fullName = text('fullName', 200, 'Full name');
  const line1 = text('line1', 300, 'Street address');
  const line2 = text('line2', 300, 'Apartment, suite, unit', false);
  const landmark = text('landmark', 200, 'Landmark', false);
  const city = text('city', 100, 'Town / City');
  const state = text('state', 100, 'State');
  const country = text('country', 100, 'Country');
  const phone = values.phone.trim() ? toE164Phone(values.phone) : null;
  if (!values.phone.trim()) errors.phone = 'Phone is a required field.';
  else if (!phone) errors.phone = 'Please enter a valid 10-digit mobile number.';
  const pincode = values.pincode.trim();
  if (!/^\d{6}$/.test(pincode)) errors.pincode = 'PIN Code must be exactly 6 digits.';

  if (Object.keys(errors).length > 0 || !phone) {
    return { input: null, errors };
  }
  return {
    input: {
      fullName,
      phone,
      line1,
      ...(line2 ? { line2 } : {}),
      ...(landmark ? { landmark } : {}),
      city,
      state,
      pincode,
      country,
      addressType: values.addressType,
      isDefault: values.isDefault,
    },
    errors,
  };
}

/** Display lines for an address card / order summary. */
export function addressLines(
  address: Pick<
    Address,
    'fullName' | 'line1' | 'line2' | 'landmark' | 'city' | 'state' | 'pincode' | 'country' | 'phone'
  >,
): string[] {
  return [
    address.fullName,
    address.line1,
    address.line2,
    address.landmark ? `Landmark: ${address.landmark}` : null,
    `${address.city} ${address.pincode}`,
    `${address.state}, ${address.country}`,
    `Phone: ${address.phone}`,
  ].filter((line): line is string => Boolean(line));
}

// --- Orders / tracking (order-service OrderView + logistics tracking events) ---
export interface TrackingEvent {
  status: string;
  location?: string;
  /** ISO timestamp. */
  occurredAt: string;
}

/** Order as the account pages show it; `createdAt` comes from GET /api/orders. */
export interface AccountOrder extends OrderView {
  createdAt: string;
  events: readonly TrackingEvent[];
}

export const TRACKING_STEPS = ['Order placed', 'Packed', 'Shipped', 'Delivered'] as const;

const STEP_OF: Record<SellerItemStatus, number> = {
  PENDING: 0,
  CONFIRMED: 0,
  PACKED: 1,
  SHIPPED: 2,
  DELIVERED: 3,
  CANCELLED: -1,
  RETURNED: 3,
};

/** Fulfilment progress = the least-advanced live item (per-item sellerStatus, not order.status). */
export function trackingProgress(order: OrderView): { step: number; cancelled: boolean } {
  const live = order.items.filter((item) => item.sellerStatus !== 'CANCELLED');
  if (order.status === 'CANCELLED' || live.length === 0) {
    return { step: -1, cancelled: true };
  }
  return { step: Math.min(...live.map((item) => STEP_OF[item.sellerStatus])), cancelled: false };
}

export function orderStatusLabel(order: OrderView): string {
  if (order.status === 'PENDING_PAYMENT') return 'Pending payment';
  const { step, cancelled } = trackingProgress(order);
  return cancelled
    ? 'Cancelled'
    : (['Processing', 'Packed', 'Shipped', 'Delivered'][step] ?? 'Processing');
}
