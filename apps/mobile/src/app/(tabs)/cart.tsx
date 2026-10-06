import { ScrollView, StyleSheet, Text, View, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CART_SHIPPING_TOTAL, cartTotals, formatMoney } from '@youmart/shared-client';
import { useCart } from '@/stores/cart';
import { ProductImage } from '@/components/ui';
import { colors, font, radii, space } from '@/theme';

export default function CartScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { cart, setQuantity, removeItem } = useCart();
  const totals = cartTotals(cart, CART_SHIPPING_TOTAL);

  if (cart.items.length === 0) {
    return (
      <View style={[styles.screen, styles.empty, { paddingTop: insets.top }]}>
        <Ionicons name="cart-outline" size={64} color={colors.card.border} />
        <Text style={styles.emptyTitle}>Your Cart is Empty</Text>
        <Pressable style={styles.shopBtn} onPress={() => router.push('/')}>
          <Text style={styles.shopText}>Start shopping</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <Text style={styles.header}>My Cart</Text>
      <ScrollView contentContainerStyle={styles.list} showsVerticalScrollIndicator={false}>
        {cart.items.map((line) => (
          <View key={line.cartItemId} style={styles.line}>
            <ProductImage src={undefined} style={styles.thumb} icon={22} />
            <View style={styles.lineBody}>
              <Text numberOfLines={2} style={styles.lineTitle}>
                {line.title}
              </Text>
              <Text style={styles.linePrice}>{formatMoney(line.priceSnapshot)}</Text>
              <View style={styles.qtyRow}>
                <View style={styles.stepper}>
                  <Pressable
                    style={styles.stepBtn}
                    onPress={() => setQuantity(line.cartItemId, line.quantity - 1)}
                  >
                    <Ionicons name="remove" size={16} color={colors.brand.DEFAULT} />
                  </Pressable>
                  <Text style={styles.qty}>{line.quantity}</Text>
                  <Pressable
                    style={styles.stepBtn}
                    onPress={() => setQuantity(line.cartItemId, line.quantity + 1)}
                  >
                    <Ionicons name="add" size={16} color={colors.brand.DEFAULT} />
                  </Pressable>
                </View>
                <Pressable onPress={() => removeItem(line.cartItemId)} hitSlop={8}>
                  <Ionicons name="trash-outline" size={18} color={colors.cart.danger} />
                </Pressable>
              </View>
            </View>
            <Text style={styles.lineTotal}>{formatMoney(line.lineTotal)}</Text>
          </View>
        ))}
      </ScrollView>

      <View style={[styles.summary, { paddingBottom: insets.bottom + space.md }]}>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Subtotal</Text>
          <Text style={styles.summaryValue}>{formatMoney(totals.subtotal)}</Text>
        </View>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Shipping</Text>
          <Text style={styles.free}>Free shipping</Text>
        </View>
        <View style={[styles.summaryRow, styles.totalRow]}>
          <Text style={styles.totalLabel}>Total</Text>
          <Text style={styles.totalValue}>{formatMoney(totals.total)}</Text>
        </View>
        <Pressable style={styles.checkout} disabled>
          <Ionicons name="lock-closed" size={15} color={colors.white} />
          <Text style={styles.checkoutText}>Sign in to checkout</Text>
        </Pressable>
        <Text style={styles.note}>Login &amp; real checkout arrive in the next update.</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.page },
  empty: { alignItems: 'center', justifyContent: 'center', gap: space.lg },
  emptyTitle: { fontFamily: font.uiBold, fontSize: 20, color: colors.text.strong },
  shopBtn: {
    backgroundColor: colors.brand.DEFAULT,
    borderRadius: radii.pill,
    paddingHorizontal: 28,
    paddingVertical: 12,
  },
  shopText: { fontFamily: font.uiSemibold, fontSize: 15, color: colors.white },
  header: {
    fontFamily: font.uiBold,
    fontSize: 20,
    color: colors.heading,
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
  },
  list: { paddingHorizontal: space.lg, paddingBottom: space.lg, gap: space.md },
  line: {
    flexDirection: 'row',
    gap: space.md,
    backgroundColor: colors.white,
    borderRadius: radii.tile,
    padding: space.md,
    borderWidth: 1,
    borderColor: colors.cart.border,
  },
  thumb: { width: 64, height: 64, borderRadius: 8 },
  lineBody: { flex: 1, gap: 4 },
  lineTitle: { fontFamily: font.uiMedium, fontSize: 13.5, color: colors.text.strong },
  linePrice: { fontFamily: font.body, fontSize: 12.5, color: colors.text.body },
  qtyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.cart.border,
    borderRadius: 8,
  },
  stepBtn: { paddingHorizontal: 10, paddingVertical: 5 },
  qty: {
    fontFamily: font.uiSemibold,
    fontSize: 14,
    color: colors.text.strong,
    minWidth: 24,
    textAlign: 'center',
  },
  lineTotal: { fontFamily: font.uiBold, fontSize: 14, color: colors.text.strong },
  summary: {
    backgroundColor: colors.white,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: space.lg,
    gap: space.sm,
    borderTopWidth: 1,
    borderTopColor: colors.cart.line,
  },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  summaryLabel: { fontFamily: font.body, fontSize: 14, color: colors.text.body },
  summaryValue: { fontFamily: font.uiSemibold, fontSize: 14, color: colors.text.strong },
  free: { fontFamily: font.uiSemibold, fontSize: 13, color: colors.feature.guarantee },
  totalRow: {
    borderTopWidth: 1,
    borderTopColor: colors.cart.line,
    paddingTop: space.sm,
    marginTop: 2,
  },
  totalLabel: { fontFamily: font.uiBold, fontSize: 16, color: colors.text.strong },
  totalValue: { fontFamily: font.uiBold, fontSize: 18, color: colors.brand.DEFAULT },
  checkout: {
    marginTop: space.sm,
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.cart.ink,
    borderRadius: radii.button,
    paddingVertical: 14,
    opacity: 0.85,
  },
  checkoutText: { fontFamily: font.uiSemibold, fontSize: 15, color: colors.white },
  note: { fontFamily: font.body, fontSize: 11.5, color: colors.text.muted, textAlign: 'center' },
});
