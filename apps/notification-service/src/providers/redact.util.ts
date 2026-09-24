/**
 * Replaces every occurrence of each given secret/sensitive value with a
 * fixed placeholder, in whatever text is about to be logged or persisted
 * (a provider error message, a raw response body snippet, etc). Applied
 * defensively even where a secret "shouldn't" appear (e.g. a provider's
 * JSON error body doesn't normally echo back our authkey) - never trust a
 * third party's response shape to stay that way.
 */
export function redactSecrets(text: string, secrets: Array<string | undefined>): string {
  let result = text;
  for (const secret of secrets) {
    if (secret && secret.length > 0) {
      result = result.split(secret).join('***REDACTED***');
    }
  }
  return result;
}

/** Turns any thrown value into a short, safe string - network errors,
 * AbortError timeouts, etc. Never includes a stack trace (which could
 * incidentally contain a request URL built with a secret in it). */
export function describeError(err: unknown, secrets: Array<string | undefined> = []): string {
  const message = err instanceof Error ? err.message : String(err);
  return redactSecrets(message, secrets).slice(0, 500);
}

/** Summarizes a provider's JSON/text response for storage in `SendResult.error`
 * - bounded length, secrets stripped, never the full raw body. */
export function summarizeResponse(
  status: number,
  body: unknown,
  secrets: Array<string | undefined> = [],
): string {
  const raw = typeof body === 'string' ? body : JSON.stringify(body ?? {});
  return `HTTP ${status}: ${redactSecrets(raw, secrets).slice(0, 300)}`;
}
