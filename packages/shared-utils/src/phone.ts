/**
 * Normalises a customer-typed Indian mobile number to E.164 (`+91XXXXXXXXXX`) - the format
 * address-service stores and auth-service logs in with. Accepts `9876543210`, `+91 98765 43210`,
 * `91-9876543210`, `09876543210`. Returns `null` for anything else. Other countries are only
 * accepted when already written with a leading `+`.
 */
export function normalizePhoneE164(input: string): string | null {
  const trimmed = input.trim();
  const digits = trimmed.replace(/\D/g, '');
  if (trimmed.startsWith('+')) {
    return /^[1-9]\d{7,14}$/.test(digits) ? `+${digits}` : null;
  }
  if (/^[6-9]\d{9}$/.test(digits)) return `+91${digits}`;
  if (/^0[6-9]\d{9}$/.test(digits)) return `+91${digits.slice(1)}`;
  if (/^91[6-9]\d{9}$/.test(digits)) return `+${digits}`;
  return null;
}
