import { useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import type { CartProduct } from '@youmart/shared-client';
import { useCart } from '@/stores/cart';
import { colors, font, radii } from '@/theme';

/**
 * "Add" button that turns into a − qty + stepper once the SKU is in the cart (Flipkart-style).
 * At quantity 1 the minus becomes a bin and removes the line. Used by product cards and the
 * wishlist.
 */
export function CartStepper({
  product,
  compact,
  style,
}: {
  /** null = can't be bought (no SKU / unavailable) - renders nothing. */
  product: CartProduct | null;
  compact?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const cart = useCart();
  const [busy, setBusy] = useState(false);
  if (!product) return null;
  const line = cart.cart.items.find((i) => i.skuId === product.skuId);

  const run = async (action: () => Promise<void>) => {
    if (busy) return;
    setBusy(true);
    try {
      await action();
    } finally {
      setBusy(false);
    }
  };

  if (!line) {
    return (
      <Pressable
        onPress={() => void run(() => cart.addItem(product))}
        style={({ pressed }) => [
          styles.button,
          styles.add,
          compact && styles.compact,
          pressed && styles.pressed,
          style,
        ]}
      >
        {busy ? (
          <ActivityIndicator size="small" color={colors.white} />
        ) : (
          <>
            <Ionicons name="cart-outline" size={compact ? 13 : 15} color={colors.white} />
            <Text style={[styles.addText, compact && styles.textCompact]}>Add</Text>
          </>
        )}
      </Pressable>
    );
  }

  const step = (delta: 1 | -1) => {
    const next = line.quantity + delta;
    void Haptics.selectionAsync().catch(() => undefined);
    void run(() =>
      next < 1 ? cart.removeItem(line.cartItemId) : cart.setQuantity(line.cartItemId, next),
    );
  };

  return (
    // A Pressable (not a View) so a tap between the buttons doesn't reach a tappable parent.
    <Pressable
      style={[styles.button, styles.stepper, compact && styles.compact, style]}
      onPress={() => {}}
    >
      <Pressable
        onPress={() => step(-1)}
        hitSlop={6}
        style={styles.stepBtn}
        accessibilityLabel={line.quantity === 1 ? 'Remove from cart' : 'Decrease quantity'}
      >
        <Ionicons
          name={line.quantity === 1 ? 'trash-outline' : 'remove'}
          size={compact ? 14 : 17}
          color={colors.white}
        />
      </Pressable>
      {busy ? (
        <ActivityIndicator size="small" color={colors.white} />
      ) : (
        <Text style={[styles.qty, compact && styles.textCompact]}>{line.quantity}</Text>
      )}
      <Pressable
        onPress={() => step(1)}
        hitSlop={6}
        style={styles.stepBtn}
        accessibilityLabel="Increase quantity"
      >
        <Ionicons name="add" size={compact ? 14 : 17} color={colors.white} />
      </Pressable>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.brand.DEFAULT,
    borderRadius: radii.button,
    minHeight: 36,
  },
  add: { justifyContent: 'center', gap: 6, paddingVertical: 8, paddingHorizontal: 12 },
  pressed: { backgroundColor: colors.brand.accent },
  stepper: { justifyContent: 'space-between', paddingVertical: 4, paddingHorizontal: 4 },
  stepBtn: { paddingHorizontal: 10, paddingVertical: 4 },
  compact: { minHeight: 30, paddingVertical: 4, gap: 4 },
  addText: { fontFamily: font.uiSemibold, fontSize: 13, color: colors.white },
  qty: {
    fontFamily: font.uiBold,
    fontSize: 14,
    color: colors.white,
    minWidth: 24,
    textAlign: 'center',
  },
  textCompact: { fontSize: 12 },
});
