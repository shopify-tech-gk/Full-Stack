import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  CART_SHIPPING_TOTAL,
  addressLines,
  cartTotals,
  defaultCheckoutAddress,
  recalcCart,
  formatMoney,
  walletSplit,
  ApiError,
  type Address,
  type WalletSummary,
} from '@youmart/shared-client';
import { api } from '@/lib/api';
import { useCart } from '@/stores/cart';
import { colors, font, radii, space } from '@/theme';

// Checkout: pick a real saved address + order summary (server cart) -> create a PENDING_PAYMENT
// order -> go to the payment screen. Server owns prices (anti-tampering). W9: the YouMart Wallet
// balance can pay for the order on its own or together with Razorpay.
export default function CheckoutScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { cart: fullCart, refresh } = useCart();
  const { addressId: pickedId, buy } = useLocalSearchParams<{ addressId?: string; buy?: string }>();
  // "Buy this now" from the cart: only these lines (comma-separated cart item ids) are ordered.
  const buyIds = typeof buy === 'string' && buy ? buy.split(',') : null;
  const cart = buyIds
    ? recalcCart(
        fullCart.cartId,
        fullCart.items.filter((line) => buyIds.includes(line.cartItemId)),
      )
    : fullCart;

  const [addresses, setAddresses] = useState<Address[] | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [placing, setPlacing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [wallet, setWallet] = useState<WalletSummary | null>(null);
  const [useWallet, setUseWallet] = useState(true);

  const totals = cartTotals(cart, CART_SHIPPING_TOTAL);
  const hasWallet = !!wallet && wallet.available !== '0.00';
  const split = hasWallet && useWallet ? walletSplit(totals.total, wallet.available) : null;
  const payNow = split ? split.online : totals.total;

  const load = useCallback(() => {
    api.addresses
      .list()
      .then((r) => {
        setAddresses(r.items);
        setSelectedId((cur) => cur ?? defaultCheckoutAddress(r.items)?.id ?? null);
      })
      .catch(() => setAddresses([]));
    api.wallet
      .get()
      .then(setWallet)
      .catch(() => setWallet(null));
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
      const order = await api.orders.checkout(
        selectedId,
        buyIds ? cart.items.map((line) => line.cartItemId) : undefined,
      );
      void refresh(); // the ordered lines have left the cart
      router.replace({
        pathname: '/payment',
        params: { orderId: order.orderId, useWallet: hasWallet && useWallet ? '1' : '0' },
      });
    } catch (err) {
      setError(
        err instanceof ApiError && err.status === 409
          ? err.message
          : 'We could not place your order. Please try again.',
      );
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
        {buyIds && fullCart.items.length > cart.items.length ? (
          <View style={styles.buyNote}>
            <Ionicons name="flash" size={16} color={colors.brand.DEFAULT} />
            <Text style={styles.buyNoteText}>
              Buying {cart.items.length === 1 ? 'this item' : `${cart.items.length} items`} only -
              the rest stay in your cart.
            </Text>
          </View>
        ) : null}
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

        {hasWallet ? (
          <>
            <Text style={styles.sectionTitle}>Payment</Text>
            <View style={styles.walletCard}>
              <View style={styles.walletRow}>
                <View style={styles.walletIcon}>
                  <Ionicons name="wallet" size={18} color={colors.white} />
                </View>
                <View style={styles.walletBody}>
                  <Text style={styles.walletTitle}>Use YouMart Wallet</Text>
                  <Text style={styles.walletSub}>{formatMoney(wallet.available)} available</Text>
                </View>
                <Switch
                  value={useWallet}
                  onValueChange={setUseWallet}
                  trackColor={{ true: colors.brand.DEFAULT, false: colors.card.border }}
                  thumbColor={colors.white}
                />
              </View>
              {split ? (
                <View style={styles.splitBox}>
                  <View style={styles.sumLine}>
                    <Text style={styles.sumLabel}>From wallet</Text>
                    <Text style={styles.walletValue}>− {formatMoney(split.wallet)}</Text>
                  </View>
                  <View style={styles.sumLine}>
                    <Text style={styles.sumLabel}>
                      {split.online === '0.00' ? 'Nothing more to pay' : 'Pay online'}
                    </Text>
                    <Text style={styles.sumValue}>{formatMoney(split.online)}</Text>
                  </View>
                </View>
              ) : null}
            </View>
          </>
        ) : null}

        {error ? <Text style={styles.error}>{error}</Text> : null}
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + space.md }]}>
        <View>
          <Text style={styles.footerLabel}>{split ? 'To pay now' : 'Total'}</Text>
          <Text style={styles.footerTotal}>{formatMoney(payNow)}</Text>
        </View>
        <Pressable
          style={[styles.payBtn, (!selected || placing) && styles.disabled]}
          onPress={placeOrder}
          disabled={!selected || placing}
        >
          {placing ? (
            <ActivityIndicator color={colors.white} />
          ) : (
            <Text style={styles.payText}>
              {split && split.online === '0.00' ? 'Pay with wallet' : 'Place order'}
            </Text>
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
  buyNote: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.brandPopup.bg,
    borderRadius: 12,
    paddingHorizontal: space.md,
    paddingVertical: 10,
  },
  buyNoteText: { flex: 1, fontFamily: font.uiMedium, fontSize: 13, color: colors.brand.DEFAULT },
  divider: { height: 1, backgroundColor: colors.cart.line, marginVertical: 2 },
  totalRow: {
    borderTopWidth: 1,
    borderTopColor: colors.cart.line,
    paddingTop: space.sm,
    marginTop: 2,
  },
  totalLabel: { fontFamily: font.uiBold, fontSize: 15, color: colors.text.strong },
  totalValue: { fontFamily: font.uiBold, fontSize: 17, color: colors.brand.DEFAULT },
  walletCard: {
    backgroundColor: colors.white,
    borderRadius: radii.tile,
    borderWidth: 1.5,
    borderColor: colors.brand.DEFAULT,
    padding: space.md,
    gap: space.sm,
  },
  walletRow: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  walletIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: colors.brand.DEFAULT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  walletBody: { flex: 1 },
  walletTitle: { fontFamily: font.uiSemibold, fontSize: 14.5, color: colors.text.strong },
  walletSub: { fontFamily: font.body, fontSize: 12.5, color: colors.feature.guarantee },
  walletValue: { fontFamily: font.uiSemibold, fontSize: 13.5, color: colors.feature.guarantee },
  splitBox: {
    borderTopWidth: 1,
    borderTopColor: colors.cart.line,
    paddingTop: space.sm,
    gap: 6,
  },
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
