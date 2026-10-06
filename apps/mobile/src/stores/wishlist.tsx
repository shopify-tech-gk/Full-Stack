import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import {
  EMPTY_WISHLIST,
  addGuestWishlistItem,
  removeWishlistItem,
  type WishlistProduct,
  type WishlistView,
} from '@youmart/shared-client';
import { getJSON, setJSON } from '@/lib/storage';

// Guest wishlist (Phase 2a: signed-out, local only). Reuses shared-client's addGuestWishlistItem /
// removeWishlistItem, persisted to AsyncStorage. Proves persistence across app restarts.
// Phase 2b wires the real /api/wishlist + merge-on-login after auth.
const KEY = 'ym_guest_wishlist';

interface WishlistContextValue {
  wishlist: WishlistView;
  count: number;
  has: (skuId: string) => boolean;
  toggle: (product: WishlistProduct) => void;
  remove: (wishlistItemId: string) => void;
  ready: boolean;
}

const WishlistContext = createContext<WishlistContextValue | null>(null);

export function WishlistProvider({ children }: { children: ReactNode }) {
  const [wishlist, setWishlist] = useState<WishlistView>(EMPTY_WISHLIST);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let active = true;
    void getJSON<WishlistView>(KEY).then((stored) => {
      if (!active) return;
      if (stored && Array.isArray(stored.items)) setWishlist(stored);
      setReady(true);
    });
    return () => {
      active = false;
    };
  }, []);

  const persist = useCallback((next: WishlistView) => {
    setWishlist(next);
    void setJSON(KEY, next);
  }, []);

  const value = useMemo<WishlistContextValue>(
    () => ({
      wishlist,
      count: wishlist.itemCount,
      has: (skuId) => wishlist.items.some((item) => item.skuId === skuId),
      toggle: (product) => {
        const existing = wishlist.items.find((item) => item.skuId === product.skuId);
        persist(
          existing
            ? removeWishlistItem(wishlist, existing.wishlistItemId)
            : addGuestWishlistItem(wishlist, product),
        );
      },
      remove: (id) => persist(removeWishlistItem(wishlist, id)),
      ready,
    }),
    [wishlist, ready, persist],
  );

  return <WishlistContext.Provider value={value}>{children}</WishlistContext.Provider>;
}

export function useWishlist(): WishlistContextValue {
  const ctx = useContext(WishlistContext);
  if (!ctx) throw new Error('useWishlist must be used within WishlistProvider');
  return ctx;
}
