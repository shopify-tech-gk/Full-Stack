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
  EMPTY_CART,
  GUEST_CART_ID,
  addGuestItem,
  cartErrorMessage,
  mergeGuestCart,
  recalcCart,
  removeLine,
  setLineQuantity,
  type CartProduct,
  type CartView,
} from '@youmart/shared-client';
import { api } from '@/lib/api';
import { addedToCartFeedback, preloadFeedback } from '@/lib/feedback';

// v1.16: "something was just added" (after an Add or a quantity increase really reached the
// cart) - for any screen that wants to react; the free-delivery popup watches the item count.
const addedListeners = new Set<() => void>();
export function onCartAdded(listener: () => void): () => void {
  addedListeners.add(listener);
  return () => addedListeners.delete(listener);
}
const emitAdded = () => addedListeners.forEach((l) => l());
import { getJSON, setJSON } from '@/lib/storage';
import { getSession, useSession } from './session';

// Cart that follows the session, mirroring web lib/cart.ts:
//  - guest: a local cart in AsyncStorage (ym_guest_cart);
//  - signed in: cart-service via the api-client.
// On login the guest cart is merged into the account (shared-client mergeGuestCart), then cleared.
const KEY = 'ym_guest_cart';

export type CartMode = 'loading' | 'guest' | 'account';

interface CartContextValue {
  mode: CartMode;
  cart: CartView;
  itemCount: number;
  notice: string | null;
  addItem: (product: CartProduct, quantity?: number) => Promise<void>;
  setQuantity: (cartItemId: string, quantity: number) => Promise<void>;
  removeItem: (cartItemId: string) => Promise<void>;
  /**
   * "Buy now" (signed in): makes sure the SKU is a cart line - adding 1 if it isn't - and returns
   * that line's id for `/checkout?buy=<id>`, which orders just that line. null when signed out or
   * the add failed (the notice says why).
   */
  buyNow: (product: CartProduct) => Promise<string | null>;
  /** Re-reads the account cart - after checkout, which removes the ordered lines server-side. */
  refresh: () => Promise<void>;
  clearNotice: () => void;
}

const CartContext = createContext<CartContextValue | null>(null);

async function readGuest(): Promise<CartView> {
  const stored = await getJSON<CartView>(KEY);
  if (stored && Array.isArray(stored.items)) return recalcCart(GUEST_CART_ID, stored.items);
  return EMPTY_CART;
}

async function writeGuest(cart: CartView): Promise<void> {
  await setJSON(KEY, cart.items.length === 0 ? EMPTY_CART : cart);
}

export function CartProvider({ children }: { children: ReactNode }) {
  const session = useSession();
  const [mode, setMode] = useState<CartMode>('loading');
  const [cart, setCart] = useState<CartView>(EMPTY_CART);
  const [notice, setNotice] = useState<string | null>(null);
  const generation = useRef(0);

  useEffect(() => {
    if (session.status === 'loading') return;
    const gen = ++generation.current;

    if (session.status === 'anonymous') {
      setMode('guest');
      void readGuest().then((c) => gen === generation.current && setCart(c));
      return;
    }

    setMode('account');
    void (async () => {
      const guest = await readGuest();
      if (guest.items.length > 0) {
        await writeGuest(EMPTY_CART);
        const result = await mergeGuestCart(guest.items, (skuId, quantity) =>
          api.cart.addItem(skuId, quantity),
        );
        if (result.remaining.length > 0) {
          const kept = result.remaining.reduce(
            (c, line) => addGuestItem(c, { ...line, price: line.priceSnapshot }, line.quantity),
            EMPTY_CART,
          );
          await writeGuest(kept);
        }
      }
      try {
        const server = await api.cart.get();
        if (gen === generation.current) setCart(server);
      } catch {
        if (gen === generation.current) setNotice('We could not load your cart. Please try again.');
      }
    })();
  }, [session.status, session.user?.id]);

  const isAccount = () => getSession().status === 'authenticated';

  const persistGuest = (next: CartView) => {
    setCart(next);
    void writeGuest(next);
  };

  /** true when the server accepted the change. */
  const accountCall = async (call: () => Promise<CartView>, added?: number): Promise<boolean> => {
    const gen = generation.current;
    try {
      const view = await call();
      if (gen === generation.current) setCart(view);
      return true;
    } catch (err) {
      setNotice(cartErrorMessage(err, added));
      try {
        const view = await api.cart.get();
        if (gen === generation.current) setCart(view);
      } catch {
        /* keep optimistic */
      }
      return false;
    }
  };

  useEffect(() => {
    preloadFeedback();
  }, []);

  const value = useMemo<CartContextValue>(
    () => ({
      mode,
      cart,
      itemCount: cart.itemCount,
      notice,
      clearNotice: () => setNotice(null),
      addItem: async (product, quantity = 1) => {
        // Every "Add" in the app comes through here: chime + haptic once it's really in the cart.
        if (isAccount()) {
          if (await accountCall(() => api.cart.addItem(product.skuId, quantity), quantity)) {
            addedToCartFeedback();
            emitAdded();
          }
        } else {
          persistGuest(addGuestItem(cart, product, quantity));
          addedToCartFeedback();
          emitAdded();
        }
      },
      setQuantity: async (id, quantity) => {
        const before = cart.items.find((line) => line.cartItemId === id)?.quantity ?? 0;
        let ok = true;
        if (isAccount()) ok = await accountCall(() => api.cart.updateItem(id, quantity));
        else persistGuest(setLineQuantity(cart, id, quantity));
        if (ok && quantity > before) emitAdded();
      },
      removeItem: async (id) => {
        if (isAccount()) {
          // Gone from the screen at once (no "1" lingering while the server catches up); the
          // server's reply - or a re-fetch if it fails - then settles the real cart.
          setCart((c) => removeLine(c, id));
          await accountCall(() => api.cart.removeItem(id));
        } else persistGuest(removeLine(cart, id));
      },
      buyNow: async (product) => {
        if (!isAccount()) return null;
        const existing = cart.items.find((line) => line.skuId === product.skuId);
        if (existing) return existing.cartItemId;
        const gen = generation.current;
        try {
          const view = await api.cart.addItem(product.skuId, 1);
          if (gen === generation.current) setCart(view);
          return view.items.find((line) => line.skuId === product.skuId)?.cartItemId ?? null;
        } catch (err) {
          setNotice(cartErrorMessage(err, 1));
          return null;
        }
      },
      refresh: async () => {
        if (isAccount()) await accountCall(() => api.cart.get());
      },
    }),
    [mode, cart, notice],
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart(): CartContextValue {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart must be used within CartProvider');
  return ctx;
}
