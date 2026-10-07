import { createApiClient } from '@youmart/shared-client';

// The SAME gateway `/api` the web uses. On a real device, set EXPO_PUBLIC_API_URL to your PC's LAN
// IP (see README). Access token lives in MEMORY only (mirrors the web's memory-only access token).
export const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:4000/api';

let accessToken: string | null = null;
let onUnauthorized: () => Promise<boolean> = async () => false;

export function setAccessToken(token: string | null): void {
  accessToken = token;
}

/** session store registers its refresh here (avoids a circular import). */
export function setUnauthorizedHandler(handler: () => Promise<boolean>): void {
  onUnauthorized = handler;
}

// Refresh-token model on RN: the web uses an httpOnly `ym_rt` cookie; React Native's native fetch
// has its OWN persistent cookie jar (iOS NSHTTPCookieStorage / Android CookieManager), so the
// `ym_rt` cookie the server sets on login is stored and sent back automatically on /auth/refresh —
// including across app restarts (it's a 14-day persistent cookie). We therefore use the default
// global fetch (the api-client already sends `credentials: 'include'`). The access token stays in
// memory and is sent as `Authorization: Bearer`.
//
// NOTE: a custom `expo/fetch` fetchImpl was tried so the refresh token could be mirrored into
// expo-secure-store, but its Response did not read back reliably in Expo Go (requests reached the
// server yet responses hung). The native cookie jar is the robust, Expo-Go-safe path.
export const api = createApiClient({
  baseUrl: API_URL,
  getAccessToken: () => accessToken,
  onUnauthorized: () => onUnauthorized(),
});
