'use client';

import { useCallback, useEffect, useState } from 'react';
import { adMediaUrl, type AdUpload, type LiveAd } from '@youmart/shared-client';
import { API_URL, api, getAccessToken } from './api';
import { refreshSession } from './session';

// v1.19 Advertising on the website: the ads live right now (Home's Sponsored slot and the floating
// video window) and their media URLs.

/** Full URL of an ad's media path. */
export const adUrl = (path: string) => adMediaUrl(API_URL, path);

/** Ads live right now; refreshed every minute and the moment one ends. */
export function useLiveAds(): { image: LiveAd | null; video: LiveAd | null } {
  const [live, setLive] = useState<{ image: LiveAd | null; video: LiveAd | null }>({ image: null, video: null });
  const load = useCallback(() => {
    api.ads
      .live()
      .then(setLive)
      .catch(() => undefined);
  }, []);
  useEffect(() => {
    load();
    const t = setInterval(load, 60_000);
    return () => clearInterval(t);
  }, [load]);
  useEffect(() => {
    const ends = [live.image?.endsAt, live.video?.endsAt]
      .filter(Boolean)
      .map((e) => new Date(e as string).getTime() - Date.now())
      .filter((ms) => ms > 0);
    if (!ends.length) return;
    const t = setTimeout(load, Math.min(Math.min(...ends) + 1000, 2 ** 31 - 1));
    return () => clearTimeout(t);
  }, [live, load]);
  return live;
}

/** An ad's link, only when it is https. */
export const safeAdLink = (ad: Pick<LiveAd, 'linkUrl'>) =>
  ad.linkUrl && ad.linkUrl.startsWith('https://') ? ad.linkUrl : null;

export const AD_MAX_IMAGES = 5;
export const AD_MAX_DAYS = 30;

/** Uploads one ad photo / video as the raw request body (the server checks its real type). */
export async function uploadAdMedia(file: File): Promise<AdUpload> {
  const send = () =>
    fetch(`${API_URL}/sellers/ads/media`, {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': file.type || 'application/octet-stream',
        ...(getAccessToken() ? { Authorization: `Bearer ${getAccessToken()}` } : {}),
      },
      body: file,
    });
  let res = await send();
  if (res.status === 401 && (await refreshSession())) res = await send();
  const body = (await res.json().catch(() => null)) as { error?: { message?: string } } | null;
  if (!res.ok) throw new Error(body?.error?.message ?? 'Upload failed. Please try again.');
  return body as unknown as AdUpload;
}
