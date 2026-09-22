/**
 * Redacts sensitive fields from a notification job's `data` BEFORE it is
 * ever persisted to `notification_log.payload` - the raw OTP code must
 * flow through the queue (Redis) to reach the SMS provider, but must
 * NEVER be written to the database, even transiently. Per-template rule
 * (only OTP has a sensitive field today; extend this map as new sensitive
 * templates are added).
 */
const REDACTED_FIELDS_BY_TEMPLATE: Partial<Record<string, string[]>> = {
  OTP: ['code'],
};

export function redactJobDataForLog(
  templateKey: string,
  data: Record<string, unknown>,
): Record<string, unknown> {
  const fieldsToRedact = REDACTED_FIELDS_BY_TEMPLATE[templateKey];
  if (!fieldsToRedact || fieldsToRedact.length === 0) {
    return data;
  }
  const redacted = { ...data };
  for (const field of fieldsToRedact) {
    if (field in redacted) {
      redacted[field] = '[REDACTED]';
    }
  }
  return redacted;
}
