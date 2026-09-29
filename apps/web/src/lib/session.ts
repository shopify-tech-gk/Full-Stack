import { cookies } from 'next/headers';
import { DEMO_USER } from '@youmart/shared-client';

// DEMO session: a flag cookie set by the demo OTP login. Real auth replaces this with the
// auth-service access token (in memory) + ym_rt refresh cookie flow.
export const DEMO_SESSION_COOKIE = 'ym_demo_session';

export interface Session {
  user: { id: string; name: string; phone: string; email: string };
}

export function getSession(): Session | null {
  return cookies().get(DEMO_SESSION_COOKIE)?.value === '1' ? { user: { ...DEMO_USER } } : null;
}
