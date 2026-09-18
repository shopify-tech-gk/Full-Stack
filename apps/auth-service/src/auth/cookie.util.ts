import type { CookieOptions } from 'express';
import { config } from '../config';

/**
 * Shared flags for the httpOnly refresh cookie - used by both the OTP
 * verify route (sets it on login) and the session routes (refresh/logout).
 */
export const REFRESH_COOKIE_OPTIONS: CookieOptions = {
  httpOnly: true,
  secure: config.cookieSecure,
  // 'lax' rather than 'strict': the refresh cookie is only ever sent on a
  // direct API fetch (never a cross-site form POST, the main CSRF vector,
  // which 'lax' already blocks), and 'lax' additionally survives a rare
  // top-level-navigation deep link (e.g. an email link) without an extra
  // round trip - 'strict' would drop the cookie on that first navigation.
  // Native mobile clients don't use a browser cookie jar at all, so this
  // choice only affects the web client.
  sameSite: 'lax',
  path: '/auth',
  domain: config.cookieDomain || undefined,
};
