import { createApiClient } from '@youmart/shared-client';

// The SAME gateway `/api` the web uses. On a real device, `localhost` points at the PHONE, not
// your PC — set EXPO_PUBLIC_API_URL to your PC's LAN IP (or a tunnel). See README.md.
export const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:4000/api';

// Phase 1: no auth wiring yet. Later, the access token lives in memory and the refresh token in
// expo-secure-store (RN has no httpOnly cookie) — getAccessToken/onUnauthorized get injected then.
export const api = createApiClient({ baseUrl: API_URL });
