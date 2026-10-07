import { fetch as expoFetch } from 'expo/fetch';
import { createApiClient } from '@youmart/shared-client';
import { secure } from './storage';

// The SAME gateway `/api` the web uses. On a real device, set EXPO_PUBLIC_API_URL to your PC's LAN
// IP (see README). Access token lives in MEMORY only; the refresh token lives in expo-secure-store.
export const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:4000/api';

const REFRESH_COOKIE = 'ym_rt';
const REFRESH_TOKEN_KEY = 'ym_refresh_token';
// Only the auth session endpoints need the refresh token attached.
const AUTH_COOKIE_PATHS = ['/auth/refresh', '/auth/logout'];

let accessToken: string | null = null;
let onUnauthorized: () => Promise<boolean> = async () => false;

/** The in-memory access token (never persisted — mirrors the web's memory-only access token). */
export function setAccessToken(token: string | null): void {
  accessToken = token;
}

/** session store registers its refresh here (avoids a circular import). */
export function setUnauthorizedHandler(handler: () => Promise<boolean>): void {
  onUnauthorized = handler;
}

/** Reads `ym_rt=<value>` from a Set-Cookie header; '' when the cookie is being cleared. */
function parseRefreshCookie(setCookie: string | null): string | null {
  if (!setCookie) return null;
  const match = /(?:^|,\s*)ym_rt=([^;]*)/.exec(setCookie);
  return match ? (match[1] ?? '') : null;
}

/**
 * RN replacement for the browser cookie jar. The web keeps the refresh token in an httpOnly `ym_rt`
 * cookie; RN has none, so we:
 *  - attach `Cookie: ym_rt=<secure-store value>` on /auth/refresh + /auth/logout, and
 *  - capture the rotated token from the response's Set-Cookie back into expo-secure-store.
 * `expo/fetch` is used because it exposes Set-Cookie and keeps no implicit cookie jar.
 */
const rnFetch: typeof fetch = async (input, init) => {
  const url = typeof input === 'string' ? input : input.toString();
  const headers = new Headers(init?.headers as HeadersInit | undefined);

  if (AUTH_COOKIE_PATHS.some((path) => url.includes(path))) {
    const refresh = await secure.get(REFRESH_TOKEN_KEY);
    if (refresh) headers.set('Cookie', `${REFRESH_COOKIE}=${refresh}`);
  }

  const response = await expoFetch(url, {
    ...(init as Record<string, unknown>),
    headers,
  });

  const rotated = parseRefreshCookie(response.headers.get('set-cookie'));
  if (rotated !== null) {
    if (rotated === '') await secure.remove(REFRESH_TOKEN_KEY);
    else await secure.set(REFRESH_TOKEN_KEY, rotated);
  }

  return response as unknown as Response;
};

export const api = createApiClient({
  baseUrl: API_URL,
  getAccessToken: () => accessToken,
  onUnauthorized: () => onUnauthorized(),
  fetchImpl: rnFetch,
});

/** True when a refresh token is stored (so launch can attempt a silent refresh). */
export async function hasStoredSession(): Promise<boolean> {
  return Boolean(await secure.get(REFRESH_TOKEN_KEY));
}

export async function clearStoredSession(): Promise<void> {
  await secure.remove(REFRESH_TOKEN_KEY);
}
