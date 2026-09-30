'use server';

import {
  validateContactForm,
  validateOrderCancel,
  validateOrderNotify,
  type ContactFormValues,
  type FormErrors,
  type OrderCancelValues,
  type OrderNotifyValues,
} from '@youmart/shared-client';

export interface SupportResult<K extends string> {
  ok: boolean;
  errors?: FormErrors<K>;
  message?: string;
  /** Acknowledgement number shown to the customer. */
  reference?: string;
}

/** Actions are public endpoints: accept only string fields, whatever the client sends. */
function strings<K extends string>(input: unknown, keys: readonly K[]): Record<K, string> {
  const source =
    typeof input === 'object' && input !== null ? (input as Record<string, unknown>) : {};
  return Object.fromEntries(
    keys.map((key) => [key, typeof source[key] === 'string' ? source[key] : '']),
  ) as Record<K, string>;
}

const demoReference = (prefix: string) =>
  `${prefix}-${Date.now().toString(36).toUpperCase().slice(-6)}`;

// DEMO: validated, then acknowledged. Wiring = a support/ticket endpoint (none in API v1).
export async function submitContact(
  input: ContactFormValues,
): Promise<SupportResult<keyof ContactFormValues>> {
  const { data, errors } = validateContactForm(
    strings(input, ['name', 'phone', 'email', 'message']),
  );
  if (!data) return { ok: false, errors };
  return { ok: true, reference: demoReference('YM-MSG') };
}

// DEMO. Wiring = a customer cancel endpoint on order-service (none in API v1; only admin status).
export async function requestOrderCancel(
  input: OrderCancelValues,
): Promise<SupportResult<keyof OrderCancelValues>> {
  const { data, errors } = validateOrderCancel(
    strings(input, ['orderNumber', 'phone', 'reason', 'comments']),
  );
  if (!data) return { ok: false, errors };
  return { ok: true, reference: demoReference('YM-CXL') };
}

// DEMO. Wiring = PUT /api/orders/:id/notify (API v1.1) from the browser with the customer token;
// the page only renders this form for a signed-in customer.
export async function subscribeOrderNotify(
  input: OrderNotifyValues,
): Promise<SupportResult<keyof OrderNotifyValues>> {
  const { data, errors } = validateOrderNotify(strings(input, ['orderNumber', 'channel']));
  if (!data) return { ok: false, errors };
  return { ok: true, reference: data.orderNumber };
}
