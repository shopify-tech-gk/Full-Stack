// Support forms (contact, order cancel, order notify): shared validation so web + mobile send
// identical payloads. The v1 API has no endpoints for these yet (backend gap).
import { toE164Phone } from './account';

export const ORDER_NUMBER_PATTERN = /^[A-Za-z0-9-]{1,40}$/;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type FormErrors<K extends string> = Partial<Record<K, string>>;

export interface ValidationResult<T, K extends string> {
  data: T | null;
  errors: FormErrors<K>;
}

// --- Contact ---

export interface ContactFormValues {
  name: string;
  phone: string;
  email: string;
  message: string;
}
export interface ContactRequest {
  name: string;
  phone: string;
  email: string | null;
  message: string;
}
export const EMPTY_CONTACT_FORM: ContactFormValues = {
  name: '',
  phone: '',
  email: '',
  message: '',
};

export function validateContactForm(
  values: ContactFormValues,
): ValidationResult<ContactRequest, keyof ContactFormValues> {
  const errors: FormErrors<keyof ContactFormValues> = {};
  const name = values.name.trim();
  const email = values.email.trim();
  const message = values.message.trim();
  const phone = toE164Phone(values.phone);
  if (!name || name.length > 200) errors.name = 'Please enter your name.';
  if (!phone) errors.phone = 'Please enter a valid 10-digit mobile number.';
  if (email && (email.length > 254 || !EMAIL_PATTERN.test(email))) {
    errors.email = 'Please enter a valid email address.';
  }
  if (message.length < 10 || message.length > 2000) {
    errors.message = 'Please write a message of 10 to 2000 characters.';
  }
  return Object.keys(errors).length > 0 || !phone
    ? { data: null, errors }
    : { data: { name, phone, email: email || null, message }, errors };
}

// --- Order cancel ---

export const CANCEL_REASONS = [
  'Ordered by mistake',
  'Found a better price elsewhere',
  'Delivery is taking too long',
  'Need to change the delivery address',
  'Other',
] as const;
export type CancelReason = (typeof CANCEL_REASONS)[number];

export interface OrderCancelValues {
  orderNumber: string;
  phone: string;
  reason: string;
  comments: string;
}
export interface OrderCancelRequest {
  orderNumber: string;
  phone: string;
  reason: CancelReason;
  comments: string | null;
}
export const EMPTY_ORDER_CANCEL: OrderCancelValues = {
  orderNumber: '',
  phone: '',
  reason: '',
  comments: '',
};

export function validateOrderCancel(
  values: OrderCancelValues,
): ValidationResult<OrderCancelRequest, keyof OrderCancelValues> {
  const errors: FormErrors<keyof OrderCancelValues> = {};
  const orderNumber = values.orderNumber.trim().toUpperCase();
  const phone = toE164Phone(values.phone);
  const reason = CANCEL_REASONS.find((r) => r === values.reason);
  const comments = values.comments.trim();
  if (!ORDER_NUMBER_PATTERN.test(orderNumber)) errors.orderNumber = 'Please enter your Order ID.';
  if (!phone) errors.phone = 'Please enter the mobile number used for the order.';
  if (!reason) errors.reason = 'Please choose a reason.';
  if (comments.length > 1000) errors.comments = 'Please keep comments under 1000 characters.';
  return Object.keys(errors).length > 0 || !phone || !reason
    ? { data: null, errors }
    : { data: { orderNumber, phone, reason, comments: comments || null }, errors };
}

// --- Order notify ---

export const NOTIFY_CHANNELS = [
  { value: 'WHATSAPP', label: 'WhatsApp' },
  { value: 'SMS', label: 'SMS' },
] as const;
export type NotifyChannel = (typeof NOTIFY_CHANNELS)[number]['value'];

export interface OrderNotifyValues {
  orderNumber: string;
  channel: string;
}
export interface OrderNotifyRequest {
  orderNumber: string;
  channel: NotifyChannel;
}

export function validateOrderNotify(
  values: OrderNotifyValues,
): ValidationResult<OrderNotifyRequest, keyof OrderNotifyValues> {
  const errors: FormErrors<keyof OrderNotifyValues> = {};
  const orderNumber = values.orderNumber.trim().toUpperCase();
  const channel = NOTIFY_CHANNELS.find((c) => c.value === values.channel)?.value;
  if (!ORDER_NUMBER_PATTERN.test(orderNumber)) errors.orderNumber = 'Please enter your Order ID.';
  if (!channel) errors.channel = 'Please choose how to notify you.';
  return Object.keys(errors).length > 0 || !channel
    ? { data: null, errors }
    : { data: { orderNumber, channel }, errors };
}
