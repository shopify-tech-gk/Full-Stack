// v1.18 Home "brand video" mini player: one brand video a day, playing muted in a loop in a small
// floating portrait window (like YouTube's picture-in-picture). Videos are the brands' OWN official
// YouTube Shorts, played through YouTube's embedded player - never downloaded or re-hosted (that
// isn't allowed by YouTube's terms). To add one: take the id from youtube.com/shorts/<id>, check
// the uploader is the brand itself, and that the brand is sold on YouMart (`brand` = its catalog
// name, used for "Shop").

export interface BrandVideo {
  youtubeId: string;
  brand: string;
  title: string;
}

export const BRAND_VIDEOS: readonly BrandVideo[] = [
  { youtubeId: 'fPhAnFcXBSo', brand: 'TrustBasket', title: 'Vertical garden transformation' },
  { youtubeId: '-EF5hMVxoMg', brand: 'UGAOO', title: 'Give your new plant a home' },
  { youtubeId: 'YlIHYXniQcc', brand: 'TrustBasket', title: 'The balcony makeover you need' },
  { youtubeId: 'o4PacLSBvvc', brand: 'UGAOO', title: 'Plant care for thriving greenery' },
];

/** The day in India (IST), as a whole number - changes at midnight IST. */
export function istDay(now = Date.now()): number {
  return Math.floor((now + 5.5 * 3_600_000) / 86_400_000);
}

/** Today's video: the list in turn, one a day. */
export function todaysVideo(now = Date.now()): BrandVideo | null {
  if (BRAND_VIDEOS.length === 0) return null;
  return BRAND_VIDEOS[istDay(now) % BRAND_VIDEOS.length] ?? null;
}
