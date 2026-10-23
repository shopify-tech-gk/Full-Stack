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
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import type { CartProduct } from '@youmart/shared-client';
import { useCart } from '@/stores/cart';
import { useSession } from '@/stores/session';
import { font, radii } from '@/theme';

/** The yellow of "MART" in the logo, a touch deeper so dark text reads well on it. */
const YELLOW = '#ffd60a';
const INK = '#1f1300';

/**
 * "Buy" on product cards, beside Add - the same as the product page's Buy Now: signed in, it
 * goes straight to checkout with just this product; a guest gets it added and lands on My Cart.
 */
export function BuyNowButton({
  product,
  compact,
  style,
}: {
  /** null = can't be bought (no SKU / unavailable) - renders nothing. */
  product: CartProduct | null;
  compact?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const router = useRouter();
  const cart = useCart();
  const session = useSession();
  const [busy, setBusy] = useState(false);
  if (!product) return null;

  const buy = async () => {
    if (busy) return;
    setBusy(true);
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
    try {
      if (session.status === 'authenticated') {
        // Not in the cart yet: Buy adds it only for checkout - `temp` removes it again if the
        // shopper leaves checkout without ordering.
        const inCart = cart.cart.items.some((l) => l.skuId === product.skuId);
        const id = await cart.buyNow(product);
        if (id) router.push(`/checkout?buy=${id}${inCart ? '' : '&temp=1'}`);
        return;
      }
      await cart.addItem(product);
      router.push('/my-cart');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Pressable
      onPress={() => void buy()}
      style={({ pressed }) => [
        styles.button,
        compact && styles.compact,
        pressed && styles.pressed,
        style,
      ]}
      accessibilityLabel={`Buy ${product.title} now`}
    >
      {busy ? (
        <ActivityIndicator size="small" color={INK} />
      ) : (
        <>
          {/* Same bag icon as "Buy now" in My Cart. */}
          <Ionicons name="bag-check" size={compact ? 12 : 14} color={INK} />
          <Text style={[styles.text, compact && styles.textCompact]} numberOfLines={1}>
            Buy
          </Text>
        </>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    backgroundColor: YELLOW,
    borderRadius: radii.button,
    minHeight: 36,
    paddingVertical: 8,
    paddingHorizontal: 6,
  },
  compact: { minHeight: 30, paddingVertical: 4, gap: 3 },
  pressed: { opacity: 0.85 },
  text: { fontFamily: font.uiBold, fontSize: 13, color: INK },
  textCompact: { fontSize: 12 },
});
