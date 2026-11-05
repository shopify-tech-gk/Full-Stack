import { Platform, Share, ToastAndroid } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { discountPercent, formatMoney, type Money } from '@youmart/shared-client';
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

const rupees = (m: Money) => formatMoney(m).replace(/\.00$/, '');

/**
 * The product photo as a JPEG in the app's cache, for sharing (WebP doesn't open everywhere -
 * WhatsApp, Instagram - so it goes through wsrv.nl, the public image CDN, as a JPEG). Null when it
 * can't be fetched: the share then goes out as text.
 */
async function sharePhoto(url: string, slug: string): Promise<string | null> {
  try {
    const jpeg = /\.webp(\?|$)/i.test(url)
      ? `https://wsrv.nl/?url=${encodeURIComponent(url)}&output=jpg&w=1080&q=88`
      : url;
    const target = new File(Paths.cache, `share-${slug.slice(0, 60)}.jpg`);
    const file = await File.downloadFileAsync(jpeg, target, { idempotent: true });
    return file.uri;
  } catch {
    return null;
  }
}

/**
 * v1.18 Share a product WITH its photo, Flipkart / Meesho style: the picture plus a short caption
 * (name, price, discount, link, the sharer's referral code). iOS shares the photo and the caption
 * together. Android's share sheet can carry only one of them, so the photo goes in the share and
 * the caption is copied - the customer pastes it next to the photo (a toast says so).
 */
export async function shareProduct(p: {
  title: string;
  slug: string;
  price: Money;
  mrp?: Money;
  imageUrl?: string;
}): Promise<void> {
  const [code, photo] = await Promise.all([
    myReferralCode(),
    p.imageUrl ? sharePhoto(p.imageUrl, p.slug) : Promise.resolve(null),
  ]);
  const link = `${SITE}/product/${p.slug}${code ? `?ref=${code}` : ''}`;
  const off = p.mrp ? discountPercent(p.mrp, p.price) : 0;
  const lines = [
    `🛍️ *${p.title}*`,
    '',
    off > 0
      ? `💰 Only *${rupees(p.price)}*  ~${rupees(p.mrp!)}~  (${off}% off)`
      : `💰 Only *${rupees(p.price)}*`,
    '🚚 Fast delivery  ·  ↩️ Easy returns  ·  💵 Cash on Delivery',
    '',
    `👉 Buy it on YouMart: ${link}`,
  ];
  if (code) lines.push('', `🎁 New to YouMart? Join with my code *${code}*`);
  const caption = lines.join('\n');

  if (photo && Platform.OS === 'ios') {
    await Share.share({ message: caption, url: photo });
    return;
  }
  if (photo && Platform.OS === 'android' && (await Sharing.isAvailableAsync())) {
    await Clipboard.setStringAsync(caption);
    ToastAndroid.show('Caption & link copied - paste it with the photo', ToastAndroid.LONG);
    await Sharing.shareAsync(photo, { mimeType: 'image/jpeg', dialogTitle: p.title });
    return;
  }
  await Share.share({ message: caption, title: p.title });
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
