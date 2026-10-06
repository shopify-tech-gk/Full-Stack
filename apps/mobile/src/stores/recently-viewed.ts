// Guest recently-viewed (signed out), RN storage adapter. Reuses shared-client's pure rules
// (addGuestView / parseGuestViews) exactly like the web, but persists to AsyncStorage instead of
// localStorage. Recording is fire-and-forget (non-blocking, like web). Server history + merge-on-
// login come in Phase 2b (auth).
import { addGuestView, parseGuestViews, type GuestView } from '@youmart/shared-client';
import { getJSON, setJSON } from '@/lib/storage';

const KEY = 'ym_guest_recently_viewed';

export async function loadGuestViews(): Promise<GuestView[]> {
  return parseGuestViews(await getJSON<unknown>(KEY));
}

/** Records a product view. Never awaited by the screen; any failure is swallowed. */
export function recordView(productId: string): void {
  void (async () => {
    try {
      const views = await loadGuestViews();
      await setJSON(KEY, addGuestView(views, productId));
    } catch {
      /* best-effort, never affects the product page */
    }
  })();
}
