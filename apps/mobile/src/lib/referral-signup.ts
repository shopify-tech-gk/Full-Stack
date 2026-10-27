import { ApiError } from '@youmart/shared-client';
import { api } from '@/lib/api';
import { getJSON, setJSON } from '@/lib/storage';

// v1.17 Refer & Earn at sign-up: a code typed on the sign-in screen is applied right after the OTP
// is verified; a brand-new account that typed none is asked once ("Got a friend's code?").

const PROMPTED_KEY = (userId: string) => `ym_ref_prompted:${userId}`;

export type AfterSignIn =
  | { kind: 'applied'; friend: string | null }
  | { kind: 'failed'; message: string }
  | { kind: 'ask' }
  | { kind: 'none' };

export async function referralAfterSignIn(
  userId: string,
  typedCode?: string,
): Promise<AfterSignIn> {
  const code = typedCode?.trim();
  if (code) {
    try {
      const res = await api.auth.applyReferral(code);
      return { kind: 'applied', friend: res.referredBy.name };
    } catch (err) {
      return {
        kind: 'failed',
        message:
          err instanceof ApiError ? err.message : "We couldn't add that referral code right now.",
      };
    }
  }
  // No code typed: a new account that can still add one is asked once.
  try {
    if (await getJSON<boolean>(PROMPTED_KEY(userId))) return { kind: 'none' };
    const info = await api.auth.referral();
    if (!info.canApplyCode) return { kind: 'none' };
    await setJSON(PROMPTED_KEY(userId), true);
    return { kind: 'ask' };
  } catch {
    return { kind: 'none' };
  }
}
