import { useEffect, useState, type ReactNode } from 'react';
import { ScrollView, StyleSheet, Text, View, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { CART_SHIPPING_TOTAL, cartTotals, formatMoney } from '@youmart/shared-client';
import { api } from '@/lib/api';
import { useCart } from '@/stores/cart';
import { useSession } from '@/stores/session';
import { ProductImage } from './ui';
import { SwipeTabs } from './SwipeTabs';
import { AppHeader } from './AppHeader';
import { colors, font, radii, space } from '@/theme';

/**
 * The cart, shown two ways: as the My Cart tab, and as a screen pushed over a product page ("Go to
 * Cart") so back / swipe-back returns to that product instead of leaving the user on a tab.
 */
export function CartContent({ inStack = false }: { inStack?: boolean }) {
  const router = useRouter();
  // The tab swipes between tabs and has the same top section as the other tabs (logo, shortcuts,
  // delivery address, search); the pushed screen has the inner-screen header (BrandHeader).
  const wrap = (node: ReactNode) =>
    inStack ? (
      node
    ) : (
      <SwipeTabs index={2} style={styles.tab}>
        <AppHeader />
        {node}
      </SwipeTabs>
    );
  const top = 0;
  const session = useSession();
  const { cart, setQuantity, removeItem } = useCart();
  const totals = cartTotals(cart, CART_SHIPPING_TOTAL);

  // Cart lines carry no image - look the products up (one request, cached per product id).
  const [images, setImages] = useState<Record<string, string>>({});
  const idsKey = [...new Set(cart.items.map((l) => l.productId))].sort().join(',');
  useEffect(() => {
    const missing = idsKey.split(',').filter((id) => id && !(id in images));
    if (missing.length === 0) return;
    api.catalog
      .productCards(missing)
      .then(({ items }) =>
        setImages((prev) => {
          const next = { ...prev };
          for (const id of missing) next[id] = '';
          for (const item of items) next[item.id] = item.imageUrl ?? '';
          return next;
        }),
      )
      .catch(() => undefined);
  }, [idsKey]);

  if (cart.items.length === 0) {
    return wrap(
      <View style={[styles.screen, styles.empty, { paddingTop: top }]}>
        <Ionicons name="cart-outline" size={64} color={colors.card.border} />
        <Text style={styles.emptyTitle}>Your Cart is Empty</Text>
        <Pressable style={styles.shopBtn} onPress={() => router.push('/')}>
          <Text style={styles.shopText}>Start shopping</Text>
        </Pressable>
      </View>,
    );
  }

  const proceed = () => {
    if (session.status === 'authenticated') router.push('/checkout');
    else router.push('/auth/login');
  };

  // Flipkart-style: buy just this one line; everything else stays in the cart.
  const buyNow = (cartItemId: string) => {
    if (session.status === 'authenticated') router.push(`/checkout?buy=${cartItemId}`);
    else router.push('/auth/login');
  };

  const openProduct = (slug: string) => {
    if (slug) router.push(`/product/${slug}`);
  };

  return wrap(
    <View style={[styles.screen, { paddingTop: top }]}>
      {inStack ? null : <Text style={styles.header}>My Cart</Text>}
      <ScrollView contentContainerStyle={styles.list} showsVerticalScrollIndicator={false}>
        {cart.items.map((line) => (
          <View key={line.cartItemId} style={styles.line}>
            <View style={styles.lineTop}>
              <Pressable onPress={() => openProduct(line.productSlug)}>
                <ProductImage
                  src={images[line.productId] || undefined}
                  style={styles.thumb}
                  icon={22}
                />
              </Pressable>
              <View style={styles.lineBody}>
                <Pressable onPress={() => openProduct(line.productSlug)}>
                  <Text numberOfLines={2} style={styles.lineTitle}>
                    {line.title}
                  </Text>
                </Pressable>
                <Text style={styles.linePrice}>{formatMoney(line.priceSnapshot)}</Text>
                <View style={styles.qtyRow}>
                  <View style={styles.stepper}>
                    <Pressable
                      style={styles.stepBtn}
                      onPress={() =>
                        line.quantity <= 1
                          ? removeItem(line.cartItemId)
                          : setQuantity(line.cartItemId, line.quantity - 1)
                      }
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
            <Pressable
              style={({ pressed }) => [styles.buyNow, pressed && { opacity: 0.85 }]}
              onPress={() => buyNow(line.cartItemId)}
            >
              <Ionicons name="flash" size={15} color={colors.brand.DEFAULT} />
              <Text style={styles.buyNowText}>Buy this now</Text>
            </Pressable>
          </View>
        ))}
      </ScrollView>

      <View style={styles.summary}>
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
        <Pressable style={styles.checkout} onPress={proceed}>
          <Ionicons
            name={session.status === 'authenticated' ? 'arrow-forward' : 'lock-closed'}
            size={16}
            color={colors.white}
          />
          <Text style={styles.checkoutText}>
            {session.status === 'authenticated' ? 'Proceed to checkout' : 'Sign in to checkout'}
          </Text>
        </Pressable>
      </View>
    </View>,
  );
}

const styles = StyleSheet.create({
  tab: { flex: 1, backgroundColor: colors.page },
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
    gap: space.md,
    backgroundColor: colors.white,
    borderRadius: radii.tile,
    padding: space.md,
    borderWidth: 1,
    borderColor: colors.cart.border,
  },
  lineTop: { flexDirection: 'row', gap: space.md },
  thumb: { width: 72, height: 72, borderRadius: 8 },
  buyNow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderWidth: 1.5,
    borderColor: colors.brand.DEFAULT,
    borderRadius: radii.button,
    paddingVertical: 9,
  },
  buyNowText: { fontFamily: font.uiSemibold, fontSize: 14, color: colors.brand.DEFAULT },
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
    backgroundColor: colors.brand.DEFAULT,
    borderRadius: radii.button,
    paddingVertical: 14,
  },
  checkoutText: { fontFamily: font.uiSemibold, fontSize: 15, color: colors.white },
});
