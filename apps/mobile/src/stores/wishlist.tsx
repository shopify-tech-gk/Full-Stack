import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import {
  EMPTY_WISHLIST,
  addGuestWishlistItem,
  mergeGuestWishlist,
  removeWishlistItem,
  wishlistErrorMessage,
  wishlistView,
  type WishlistProduct,
  type WishlistView,
} from '@youmart/shared-client';
import { api } from '@/lib/api';
import { getJSON, setJSON } from '@/lib/storage';
import { getSession, useSession } from './session';

// Wishlist that follows the session, mirroring web lib/wishlist.ts:
//  - guest: a local list in AsyncStorage (ym_guest_wishlist);
//  - signed in: cart-service's /api/wishlist.
// On login the guest list is merged (union) into the account, then cleared.
const KEY = 'ym_guest_wishlist';

export type WishlistMode = 'loading' | 'guest' | 'account';

interface WishlistContextValue {
  mode: WishlistMode;
  wishlist: WishlistView;
  count: number;
  notice: string | null;
  has: (skuId: string) => boolean;
  toggle: (product: WishlistProduct) => Promise<void>;
  remove: (wishlistItemId: string) => Promise<void>;
  clearNotice: () => void;
}

const WishlistContext = createContext<WishlistContextValue | null>(null);

async function readGuest(): Promise<WishlistView> {
  const stored = await getJSON<WishlistView>(KEY);
  if (stored && Array.isArray(stored.items))
    return wishlistView(stored.items.map((i) => ({ ...i, available: true })));
  return EMPTY_WISHLIST;
}

async function writeGuest(view: WishlistView): Promise<void> {
  await setJSON(KEY, view.items.length === 0 ? EMPTY_WISHLIST : view);
}

export function WishlistProvider({ children }: { children: ReactNode }) {
  const session = useSession();
  const [mode, setMode] = useState<WishlistMode>('loading');
  const [wishlist, setWishlist] = useState<WishlistView>(EMPTY_WISHLIST);
  const [notice, setNotice] = useState<string | null>(null);
  const generation = useRef(0);

  useEffect(() => {
    if (session.status === 'loading') return;
    const gen = ++generation.current;

    if (session.status === 'anonymous') {
      setMode('guest');
      void readGuest().then((v) => gen === generation.current && setWishlist(v));
      return;
    }

    setMode('account');
    void (async () => {
      const guest = await readGuest();
      if (guest.items.length > 0) {
        await writeGuest(EMPTY_WISHLIST);
        const result = await mergeGuestWishlist(guest.items, (skuId) => api.wishlist.add(skuId));
        if (result.remaining.length > 0) await writeGuest(wishlistView(result.remaining));
      }
      try {
        const view = await api.wishlist.get();
        if (gen === generation.current) setWishlist(view);
      } catch {
        if (gen === generation.current) setNotice('We could not load your wishlist.');
      }
    })();
  }, [session.status, session.user?.id]);

  const isAccount = () => getSession().status === 'authenticated';

  const persistGuest = (next: WishlistView) => {
    setWishlist(next);
    void writeGuest(next);
  };

  const accountCall = async (call: () => Promise<WishlistView>) => {
    const gen = generation.current;
    try {
      const view = await call();
      if (gen === generation.current) setWishlist(view);
    } catch (err) {
      setNotice(wishlistErrorMessage(err));
    }
  };

  const value = useMemo<WishlistContextValue>(
    () => ({
      mode,
      wishlist,
      count: wishlist.itemCount,
      notice,
      clearNotice: () => setNotice(null),
      has: (skuId) => wishlist.items.some((i) => i.skuId === skuId),
      toggle: async (product) => {
        const existing = wishlist.items.find((i) => i.skuId === product.skuId);
        if (isAccount()) {
          if (existing) await accountCall(() => api.wishlist.remove(existing.wishlistItemId));
          else await accountCall(() => api.wishlist.add(product.skuId));
        } else {
          persistGuest(
            existing
              ? removeWishlistItem(wishlist, existing.wishlistItemId)
              : addGuestWishlistItem(wishlist, product),
          );
        }
      },
      remove: async (id) => {
        if (isAccount()) await accountCall(() => api.wishlist.remove(id));
        else persistGuest(removeWishlistItem(wishlist, id));
      },
    }),
    [mode, wishlist, notice],
  );

  return <WishlistContext.Provider value={value}>{children}</WishlistContext.Provider>;
}

export function useWishlist(): WishlistContextValue {
  const ctx = useContext(WishlistContext);
  if (!ctx) throw new Error('useWishlist must be used within WishlistProvider');
  return ctx;
}
