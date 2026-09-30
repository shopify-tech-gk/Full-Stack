import { createApiClient } from '@youmart/shared-client';

export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api';

// The access token lives in memory only (API.md §2.1) - never localStorage/sessionStorage, so an
// injected script can't read a stored token. The refresh token is the httpOnly `ym_rt` cookie.
let accessToken: string | null = null;
let onUnauthorized: () => Promise<boolean> = async () => false;

export function setAccessToken(token: string | null): void {
  accessToken = token;
}

/** lib/session registers its refresh here (avoids a circular import). */
export function setUnauthorizedHandler(handler: () => Promise<boolean>): void {
  onUnauthorized = handler;
}

export const api = createApiClient({
  baseUrl: API_URL,
  getAccessToken: () => accessToken,
  onUnauthorized: () => onUnauthorized(),
});
