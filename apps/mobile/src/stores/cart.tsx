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

  const accountCall = async (call: () => Promise<CartView>, added?: number) => {
    const gen = generation.current;
    try {
      const view = await call();
      if (gen === generation.current) setCart(view);
    } catch (err) {
      setNotice(cartErrorMessage(err, added));
      try {
        const view = await api.cart.get();
        if (gen === generation.current) setCart(view);
      } catch {
        /* keep optimistic */
      }
    }
  };

  const value = useMemo<CartContextValue>(
    () => ({
      mode,
      cart,
      itemCount: cart.itemCount,
      notice,
      clearNotice: () => setNotice(null),
      addItem: async (product, quantity = 1) => {
        if (isAccount())
          await accountCall(() => api.cart.addItem(product.skuId, quantity), quantity);
        else persistGuest(addGuestItem(cart, product, quantity));
      },
      setQuantity: async (id, quantity) => {
        if (isAccount()) await accountCall(() => api.cart.updateItem(id, quantity));
        else persistGuest(setLineQuantity(cart, id, quantity));
      },
      removeItem: async (id) => {
        if (isAccount()) await accountCall(() => api.cart.removeItem(id));
        else persistGuest(removeLine(cart, id));
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
