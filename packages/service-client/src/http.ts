import { AppError } from '@youmart/errors';
import { ApiError } from '@youmart/shared-types';

export type HttpMethod = 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';

export interface RequestOptions {
  baseUrl: string;
  path: string;
  method: HttpMethod;
  body?: unknown;
  headers?: Record<string, string>;
  /** Forwarded as `Authorization: Bearer <authToken>` - today this is the
   * calling user's own access token; a dedicated service-to-service token
   * can replace/augment it later without changing this signature. */
  authToken?: string;
  timeoutMs?: number;
}

const DEFAULT_TIMEOUT_MS = 5000;

function buildUrl(baseUrl: string, path: string): string {
  const base = baseUrl.replace(/\/+$/, '');
  const suffix = path.startsWith('/') ? path : `/${path}`;
  return `${base}${suffix}`;
}

function safeJsonParse(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

/**
 * Shared HTTP call for every service-to-service request on the critical
 * path (cart->inventory, cart->catalog, order->inventory, etc). Uses
 * Node's native global `fetch` - no axios/node-fetch needed.
 *
 * - Enforces `timeoutMs` (default 5000) via AbortController - a hung
 *   downstream must fail fast, not hang the caller forever.
 * - Error mapping:
 *   - non-2xx response whose body matches our `ApiError` envelope -> a
 *     downstream BUSINESS error (validation/not-found/conflict/etc) is
 *     rethrown as an `AppError` with that SAME code/status/message, so
 *     e.g. inventory's 409 "insufficient stock" surfaces as a 409
 *     `AppError` with code `CONFLICT` in the caller.
 *   - non-2xx response that ISN'T our envelope (unexpected shape) ->
 *     `AppError('INTERNAL_ERROR', 502, 'Upstream service error')` -
 *     never leaks the raw upstream body.
 *   - the request timing out -> `AppError('INTERNAL_ERROR', 503, 'Upstream
 *     service timeout')`.
 *   - any other network failure (connection refused, DNS, etc) ->
 *     `AppError('INTERNAL_ERROR', 503, 'Upstream service unavailable')`.
 */
export async function request<T>(options: RequestOptions): Promise<T> {
  const {
    baseUrl,
    path,
    method,
    body,
    headers,
    authToken,
    timeoutMs = DEFAULT_TIMEOUT_MS,
  } = options;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  const requestHeaders: Record<string, string> = { ...headers };
  if (body !== undefined) {
    requestHeaders['Content-Type'] = 'application/json';
  }
  if (authToken) {
    requestHeaders['Authorization'] = `Bearer ${authToken}`;
  }

  let response: Response;
  try {
    response = await fetch(buildUrl(baseUrl, path), {
      method,
      headers: requestHeaders,
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      throw new AppError('INTERNAL_ERROR', 503, 'Upstream service timeout');
    }
    throw new AppError('INTERNAL_ERROR', 503, 'Upstream service unavailable');
  } finally {
    clearTimeout(timeout);
  }

  // Some endpoints (e.g. release/commit) return 204 with no body at all.
  const rawText = await response.text();
  const parsedBody: unknown = rawText.length > 0 ? safeJsonParse(rawText) : undefined;

  if (!response.ok) {
    const envelope = ApiError.safeParse(parsedBody);
    if (envelope.success) {
      throw new AppError(
        envelope.data.error.code,
        response.status,
        envelope.data.error.message,
        envelope.data.error.details,
      );
    }
    throw new AppError('INTERNAL_ERROR', 502, 'Upstream service error');
  }

  return parsedBody as T;
}
