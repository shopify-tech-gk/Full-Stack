/**
 * A shared `fetch` wrapper enforcing a timeout via AbortController - same
 * discipline as `@youmart/service-client`'s internal HTTP helper, kept
 * local here since these are third-party provider calls, not
 * service-to-service calls.
 */
export async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  timeoutMs = 8000,
): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

/** Strips a leading "+" and any non-digit characters - MSG91's APIs expect
 * a bare country-code-prefixed digit string (e.g. "919999999999"), not
 * the E.164 "+919999999999" our own Phone schema validates. */
export function toMsg91Mobile(phone: string): string {
  return phone.replace(/\D/g, '');
}
