'use client';

import { railProducts, type PersonalRailKey, type RailItem } from '@youmart/shared-client';
import { usePersonalRails } from '@/lib/recently-viewed';
import { RailThumbs } from './RailThumbs';

/** getHomeProducts' rail card holds 2 x 2 products. */
const RAIL_CARD_ITEMS = 4;

/** A personal rail card: the shopper's own products first, else exactly the served fallback. */
export function PersonalRailThumbs({
  railKey,
  items,
}: {
  railKey: PersonalRailKey;
  items: readonly RailItem[];
}) {
  const mine = usePersonalRails()?.[railKey];
  const own = mine?.map(({ id, href, title, image }) => ({ id, href, title, image })) ?? null;
  return <RailThumbs items={railProducts(items, own, RAIL_CARD_ITEMS).products} />;
}
