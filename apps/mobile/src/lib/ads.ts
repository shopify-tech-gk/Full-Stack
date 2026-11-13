import { useCallback, useEffect, useState } from 'react';
import { Linking } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { FileSystemUploadType, uploadAsync } from 'expo-file-system/legacy';
import { adMediaUrl, type AdUpload, type LiveAd } from '@youmart/shared-client';
import { API_URL, api, getAccessToken, refreshSession } from '@/lib/api';

// v1.19 Advertising helpers for the app: uploading ad photos / videos, the ads showing right now
// (Home's Sponsored slot and floating video window), and opening an ad's link.

export const AD_PRICE_FALLBACK = '1000.00';

/** Full URL of an ad's media path. */
export const adUrl = (path: string) => adMediaUrl(API_URL, path);

/** The file's type from the picker, or from its name. */
export function mimeOf(uri: string, given?: string | null, video = false): string {
  if (given && /^(image|video)\//.test(given) && !/heic|heif/.test(given)) return given;
  const ext = uri.split('?')[0]!.split('.').pop()?.toLowerCase() ?? '';
  if (ext === 'png') return 'image/png';
  if (ext === 'webp') return 'image/webp';
  if (ext === 'mov') return 'video/quicktime';
  if (ext === 'mp4' || video) return 'video/mp4';
  return 'image/jpeg';
}

/** Uploads one local file as the raw body (the server checks its real type). */
export async function uploadAdMedia(uri: string, mimeType: string): Promise<AdUpload> {
  const send = () =>
    uploadAsync(`${API_URL}/sellers/ads/media`, uri, {
      httpMethod: 'POST',
      uploadType: FileSystemUploadType.BINARY_CONTENT,
      headers: {
        'Content-Type': mimeType,
        ...(getAccessToken() ? { Authorization: `Bearer ${getAccessToken()}` } : {}),
      },
    });
  let res = await send();
  if (res.status === 401 && (await refreshSession())) res = await send();
  let body: unknown = null;
  try {
    body = JSON.parse(res.body);
  } catch {
    // not JSON
  }
  if (res.status < 200 || res.status >= 300) {
    const msg = (body as { error?: { message?: string } } | null)?.error?.message;
    throw new Error(msg ?? 'Upload failed. Please try again.');
  }
  return body as AdUpload;
}

/** Ads live right now; refreshed when the screen is shown and every minute (slots end on time). */
export function useLiveAds(): { image: LiveAd | null; video: LiveAd | null } {
  const [live, setLive] = useState<{ image: LiveAd | null; video: LiveAd | null }>({
    image: null,
    video: null,
  });
  const load = useCallback(() => {
    api.ads
      .live()
      .then(setLive)
      .catch(() => undefined);
  }, []);
  useFocusEffect(
    useCallback(() => {
      load();
      const t = setInterval(load, 60_000);
      return () => clearInterval(t);
    }, [load]),
  );
  // An ad that ends while it's on screen disappears without waiting for the next poll.
  useEffect(() => {
    const ends = [live.image?.endsAt, live.video?.endsAt]
      .filter(Boolean)
      .map((e) => new Date(e as string).getTime() - Date.now());
    const next = Math.min(...ends.filter((ms) => ms > 0));
    if (!Number.isFinite(next)) return;
    const t = setTimeout(load, Math.min(next + 1000, 2 ** 31 - 1));
    return () => clearTimeout(t);
  }, [live, load]);
  return live;
}

/** Opens an ad's https link, if it has one. */
export function openAdLink(ad: Pick<LiveAd, 'linkUrl'>): void {
  if (ad.linkUrl && ad.linkUrl.startsWith('https://')) void Linking.openURL(ad.linkUrl);
}

const money0 = (m: string) => `₹${Number(m).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
export const rupees = money0;

/** "Sat 15 Nov, 6:00 PM" in the device's time zone. */
export function fmtWhen(iso: string | Date): string {
  const d = typeof iso === 'string' ? new Date(iso) : iso;
  return d.toLocaleString('en-IN', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}
