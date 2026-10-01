'use client';

// The unpaid order checkout is working on, kept for the browser session so a reload (or "Complete
// payment" from the order page) resumes it - checkout empties the cart, so it's the only record.
const PENDING_KEY = 'ym_pending_order';

export function rememberPendingOrder(userId: string, orderId: string): void {
  try {
    sessionStorage.setItem(PENDING_KEY, JSON.stringify({ userId, orderId }));
  } catch {
    // Private mode: the order still exists server-side.
  }
}

export function pendingOrderId(userId: string): string | null {
  try {
    const saved = JSON.parse(sessionStorage.getItem(PENDING_KEY) ?? 'null') as {
      userId?: string;
      orderId?: string;
    } | null;
    return saved?.userId === userId && saved.orderId ? saved.orderId : null;
  } catch {
    return null;
  }
}

export function forgetPendingOrder(): void {
  try {
    sessionStorage.removeItem(PENDING_KEY);
  } catch {
    // ignore
  }
}
