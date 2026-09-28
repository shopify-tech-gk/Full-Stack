import { createApiClient } from '@youmart/shared-client';

export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api';

// The access token lives in memory only (per docs/contracts/API.md §2.1); wired in the auth prompt.
let accessToken: string | null = null;

export function setAccessToken(token: string | null): void {
  accessToken = token;
}

export const api = createApiClient({
  baseUrl: API_URL,
  getAccessToken: () => accessToken,
});
