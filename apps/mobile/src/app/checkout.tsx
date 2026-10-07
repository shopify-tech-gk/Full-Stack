import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  CART_SHIPPING_TOTAL,
  addressLines,
  cartTotals,
  defaultCheckoutAddress,
  formatMoney,
  type Address,
} from '@youmart/shared-client';
import { api } from '@/lib/api';
import { useCart } from '@/stores/cart';
import { colors, font, radii, space } from '@/theme';

// Checkout: pick a real saved address + order summary (server cart) -> create a PENDING_PAYMENT
// order -> go to the payment screen. Server owns prices (anti-tampering).
export default function CheckoutScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { cart } = useCart();
  const { addressId: pickedId } = useLocalSearchParams<{ addressId?: string }>();

  const [addresses, setAddresses] = useState<Address[] | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [placing, setPlacing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const totals = cartTotals(cart, CART_SHIPPING_TOTAL);

  const load = useCallback(() => {
    api.addresses
      .list()
      .then((r) => {
        setAddresses(r.items);
        setSelectedId((cur) => cur ?? defaultCheckoutAddress(r.items)?.id ?? null);
      })
      .catch(() => setAddresses([]));
  }, []);

  useFocusEffect(useCallback(() => load(), [load]));

  useEffect(() => {
    if (pickedId) setSelectedId(String(pickedId));
  }, [pickedId]);

  const selected = addresses?.find((a) => a.id === selectedId) ?? null;

  const placeOrder = async () => {
    if (!selectedId) {
      setError('Please choose a delivery address.');
      return;
    }
    setPlacing(true);
    setError(null);
    try {
      const order = await api.orders.checkout(selectedId);
      router.replace({ pathname: '/payment', params: { orderId: order.orderId } });
    } catch {
      setError('We could not place your order. Please try again.');
    } finally {
      setPlacing(false);
    }
  };

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={styles.body}>
        <Text style={styles.sectionTitle}>Delivery address</Text>
        {!addresses ? (
          <ActivityIndicator color={colors.brand.DEFAULT} style={{ margin: space.lg }} />
        ) : addresses.length === 0 ? (
          <Pressable style={styles.addAddress} onPress={() => router.push('/addresses/form')}>
            <Ionicons name="add-circle-outline" size={20} color={colors.brand.DEFAULT} />
            <Text style={styles.addAddressText}>Add a delivery address</Text>
          </Pressable>
        ) : (
          <>
            {addresses.map((a) => (
              <Pressable key={a.id} style={styles.addrCard} onPress={() => setSelectedId(a.id)}>
                <Ionicons
                  name={selectedId === a.id ? 'radio-button-on' : 'radio-button-off'}
                  size={20}
                  color={colors.brand.DEFAULT}
                />
                <View style={styles.addrBody}>
                  <Text style={styles.addrType}>
                    {a.addressType}
                    {a.isDefault ? ' · Default' : ''}
                  </Text>
                  {addressLines(a)
                    .slice(0, 4)
                    .map((line, i) => (
                      <Text key={i} style={styles.addrLine}>
                        {line}
                      </Text>
                    ))}
                </View>
              </Pressable>
            ))}
            <Pressable style={styles.addAddress} onPress={() => router.push('/addresses/form')}>
              <Ionicons name="add" size={18} color={colors.brand.DEFAULT} />
              <Text style={styles.addAddressText}>Add another address</Text>
            </Pressable>
          </>
        )}

        <Text style={styles.sectionTitle}>Order summary</Text>
        <View style={styles.summaryCard}>
          {cart.items.map((line) => (
            <View key={line.cartItemId} style={styles.sumLine}>
              <Text numberOfLines={1} style={styles.sumTitle}>
                {line.quantity} × {line.title}
              </Text>
              <Text style={styles.sumValue}>{formatMoney(line.lineTotal)}</Text>
            </View>
          ))}
          <View style={styles.divider} />
          <View style={styles.sumLine}>
            <Text style={styles.sumLabel}>Subtotal</Text>
            <Text style={styles.sumValue}>{formatMoney(totals.subtotal)}</Text>
          </View>
          <View style={styles.sumLine}>
            <Text style={styles.sumLabel}>Shipping</Text>
            <Text style={styles.free}>Free</Text>
          </View>
          <View style={[styles.sumLine, styles.totalRow]}>
            <Text style={styles.totalLabel}>Total</Text>
            <Text style={styles.totalValue}>{formatMoney(totals.total)}</Text>
          </View>
        </View>

        {error ? <Text style={styles.error}>{error}</Text> : null}
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + space.md }]}>
        <View>
          <Text style={styles.footerLabel}>Total</Text>
          <Text style={styles.footerTotal}>{formatMoney(totals.total)}</Text>
        </View>
        <Pressable
          style={[styles.payBtn, (!selected || placing) && styles.disabled]}
          onPress={placeOrder}
          disabled={!selected || placing}
        >
          {placing ? (
            <ActivityIndicator color={colors.white} />
          ) : (
            <Text style={styles.payText}>Place order</Text>
          )}
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.page },
  body: { padding: space.lg, gap: space.md, paddingBottom: space.xl },
  sectionTitle: {
    fontFamily: font.uiBold,
    fontSize: 16,
    color: colors.heading,
    marginTop: space.sm,
  },
  addrCard: {
    flexDirection: 'row',
    gap: space.md,
    backgroundColor: colors.white,
    borderRadius: radii.tile,
    borderWidth: 1,
    borderColor: colors.card.border,
    padding: space.md,
  },
  addrBody: { flex: 1, gap: 2 },
  addrType: { fontFamily: font.uiSemibold, fontSize: 13, color: colors.brand.DEFAULT },
  addrLine: { fontFamily: font.body, fontSize: 13, color: colors.text.body },
  addAddress: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: space.md,
  },
  addAddressText: { fontFamily: font.uiSemibold, fontSize: 14, color: colors.brand.DEFAULT },
  summaryCard: {
    backgroundColor: colors.white,
    borderRadius: radii.tile,
    borderWidth: 1,
    borderColor: colors.card.border,
    padding: space.lg,
    gap: 8,
  },
  sumLine: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: space.md,
  },
  sumTitle: { flex: 1, fontFamily: font.body, fontSize: 13, color: colors.text.body },
  sumLabel: { fontFamily: font.body, fontSize: 14, color: colors.text.body },
  sumValue: { fontFamily: font.uiSemibold, fontSize: 13.5, color: colors.text.strong },
  free: { fontFamily: font.uiSemibold, fontSize: 13, color: colors.feature.guarantee },
  divider: { height: 1, backgroundColor: colors.cart.line, marginVertical: 2 },
  totalRow: {
    borderTopWidth: 1,
    borderTopColor: colors.cart.line,
    paddingTop: space.sm,
    marginTop: 2,
  },
  totalLabel: { fontFamily: font.uiBold, fontSize: 15, color: colors.text.strong },
  totalValue: { fontFamily: font.uiBold, fontSize: 17, color: colors.brand.DEFAULT },
  error: {
    fontFamily: font.uiMedium,
    fontSize: 13,
    color: colors.price.discount,
    textAlign: 'center',
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.white,
    borderTopWidth: 1,
    borderTopColor: colors.border.menu,
    paddingHorizontal: space.lg,
    paddingTop: space.md,
  },
  footerLabel: { fontFamily: font.body, fontSize: 12, color: colors.text.muted },
  footerTotal: { fontFamily: font.uiBold, fontSize: 18, color: colors.text.strong },
  payBtn: {
    backgroundColor: colors.brand.DEFAULT,
    borderRadius: radii.button,
    paddingHorizontal: 32,
    paddingVertical: 14,
    minWidth: 160,
    alignItems: 'center',
  },
  disabled: { opacity: 0.5 },
  payText: { fontFamily: font.uiSemibold, fontSize: 16, color: colors.white },
});
