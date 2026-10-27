import { Share } from 'react-native';
import { formatMoney, type Money } from '@youmart/shared-client';
import { api } from '@/lib/api';
import { getSession } from '@/stores/session';

// v1.17 Share + Refer & Earn: product shares (the phone's share sheet - WhatsApp, Instagram,
// Facebook, Copy and every other app) carry the sharer's referral code when they're signed in, so
// every share is also an invite.

/** The public storefront address for shared links (the live site). */
const SITE = (process.env.EXPO_PUBLIC_SITE_URL ?? 'https://youmart.in').replace(/\/+$/, '');

let cachedCode: { userId: string; code: string } | null = null;

/** The signed-in customer's referral code (fetched once per account), or null. */
export async function myReferralCode(): Promise<string | null> {
  const session = getSession();
  if (session.status !== 'authenticated') return null;
  if (cachedCode?.userId === session.user.id) return cachedCode.code;
  try {
    const { code } = await api.auth.referral();
    cachedCode = { userId: session.user.id, code };
    return code;
  } catch {
    return null;
  }
}

export async function shareProduct(p: {
  title: string;
  slug: string;
  price: Money;
}): Promise<void> {
  const code = await myReferralCode();
  const link = `${SITE}/product/${p.slug}${code ? `?ref=${code}` : ''}`;
  const lines = [
    `Check out ${p.title} on YouMart for ${formatMoney(p.price).replace(/\.00$/, '')} 🛒`,
    link,
  ];
  if (code) lines.push('', `New to YouMart? Use my code ${code} when you join.`);
  await Share.share({ message: lines.join('\n'), title: p.title });
}

export async function shareReferralCode(code: string): Promise<void> {
  await Share.share({
    title: 'Join me on YouMart',
    message: [
      'I shop on YouMart - 5 lakh+ products at great prices. 🛍️',
      `Join with my code ${code} (enter it under Account > Refer & Earn after you sign up).`,
      `${SITE}/?ref=${code}`,
    ].join('\n'),
  });
}
