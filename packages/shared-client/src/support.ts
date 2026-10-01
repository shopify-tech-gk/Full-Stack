// Support forms: shared validation so web + mobile send identical payloads to the real endpoints.
// - contact      -> POST /api/support/messages (public; notification-service)
// - order cancel -> POST /api/orders/:id/cancel (signed in, own order; unpaid cancels at once,
//                   paid becomes a request staff approve/reject - order-service, W1)
// - order notify -> GET/PUT /api/orders/:id/notify (signed in, own order)
import { ApiError } from './api-client';
import { toE164Phone } from './account';
import type { SupportMessageBody } from './types';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Order numbers look like YM-MUO212NA-4EAB; the server matches case-insensitively. */
export const ORDER_NUMBER_PATTERN = /^[A-Za-z0-9-]{1,40}$/;

export type FormErrors<K extends string> = Partial<Record<K, string>>;

export interface ValidationResult<T, K extends string> {
  data: T | null;
  errors: FormErrors<K>;
}

/** Server validation/rate-limit errors as text for the form's notice. */
export function supportErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.status === 429) return 'Too many requests. Please try again a little later.';
    if (error.status === 400 || error.status === 409) return error.message;
    if (error.status === 404) return 'We could not find that order.';
  }
  return 'We could not send that. Please check your connection and try again.';
}

// --- Contact ---

export interface ContactFormValues {
  name: string;
  phone: string;
  email: string;
  message: string;
}
export const EMPTY_CONTACT_FORM: ContactFormValues = {
  name: '',
  phone: '',
  email: '',
  message: '',
};

/** Mirrors notification-service's SupportMessageBody limits. */
export function validateContactForm(
  values: ContactFormValues,
): ValidationResult<SupportMessageBody, keyof ContactFormValues> {
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
    : { data: { name, phone, message, ...(email ? { email } : {}) }, errors };
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
  orderId: string;
  reason: string;
  comments: string;
}
export interface OrderCancelRequest {
  orderId: string;
  reason: CancelReason;
  comment?: string;
}
export const EMPTY_ORDER_CANCEL: OrderCancelValues = { orderId: '', reason: '', comments: '' };

export function validateOrderCancel(
  values: OrderCancelValues,
): ValidationResult<OrderCancelRequest, keyof OrderCancelValues> {
  const errors: FormErrors<keyof OrderCancelValues> = {};
  const reason = CANCEL_REASONS.find((r) => r === values.reason);
  const comments = values.comments.trim();
  if (!values.orderId) errors.orderId = 'Please choose the order to cancel.';
  if (!reason) errors.reason = 'Please choose a reason.';
  if (comments.length > 1000) errors.comments = 'Please keep comments under 1000 characters.';
  return Object.keys(errors).length > 0 || !reason
    ? { data: null, errors }
    : {
        data: { orderId: values.orderId, reason, ...(comments ? { comment: comments } : {}) },
        errors,
      };
}

// --- Order notify ---

/** Channels order-service stores per order. SMS is stored but not sent yet (no SMS provider). */
export const NOTIFY_CHANNELS = [
  { key: 'whatsapp', label: 'WhatsApp updates' },
  { key: 'sms', label: 'SMS updates' },
] as const;
