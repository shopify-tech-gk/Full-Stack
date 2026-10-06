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
  EMPTY_CART,
  addGuestItem,
  removeLine,
  setLineQuantity,
  type CartProduct,
  type CartView,
} from '@youmart/shared-client';
import { getJSON, setJSON } from '@/lib/storage';

// Guest cart (Phase 2a: signed-out, local only). Reuses shared-client's addGuestItem / removeLine /
// setLineQuantity (the SAME money math and rules as the real cart), persisted to AsyncStorage.
// Phase 2b wires the real /api/cart + merge-on-login (mergeGuestCart) after auth.
const KEY = 'ym_guest_cart';

interface CartContextValue {
  cart: CartView;
  itemCount: number;
  addItem: (product: CartProduct, quantity?: number) => void;
  setQuantity: (cartItemId: string, quantity: number) => void;
  removeItem: (cartItemId: string) => void;
  clear: () => void;
  ready: boolean;
}

const CartContext = createContext<CartContextValue | null>(null);

export function CartProvider({ children }: { children: ReactNode }) {
  const [cart, setCart] = useState<CartView>(EMPTY_CART);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let active = true;
    void getJSON<CartView>(KEY).then((stored) => {
      if (!active) return;
      if (stored && Array.isArray(stored.items)) setCart(stored);
      setReady(true);
    });
    return () => {
      active = false;
    };
  }, []);

  const persist = useCallback((next: CartView) => {
    setCart(next);
    void setJSON(KEY, next);
  }, []);

  const value = useMemo<CartContextValue>(
    () => ({
      cart,
      itemCount: cart.itemCount,
      addItem: (product, quantity = 1) => persist(addGuestItem(cart, product, quantity)),
      setQuantity: (id, quantity) => persist(setLineQuantity(cart, id, quantity)),
      removeItem: (id) => persist(removeLine(cart, id)),
      clear: () => persist(EMPTY_CART),
      ready,
    }),
    [cart, ready, persist],
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart(): CartContextValue {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart must be used within CartProvider');
  return ctx;
}
