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
  codAvailable,
  COD_MAX_AMOUNT,
  defaultCheckoutAddress,
  recalcCart,
  formatMoney,
  walletSplit,
  ApiError,
  type Address,
  type CouponQuote,
  type Money,
  type WalletSummary,
} from '@youmart/shared-client';
import { api } from '@/lib/api';
import { useCart } from '@/stores/cart';
import { CouponSheet } from '@/components/CouponSheet';
import { ProductImage } from '@/components/ui';
import { PlacingOrderOverlay, atLeast } from '@/components/PlacingOrderOverlay';
import { colors, font, radii, space } from '@/theme';

// Checkout: pick a real saved address + order summary (server cart) -> create a PENDING_PAYMENT
// order -> go to the payment screen. Server owns prices (anti-tampering). W9: the YouMart Wallet
// balance can pay for the order on its own or together with Razorpay.
const PLACING_STEP_MS = 850;

export default function CheckoutScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { cart: fullCart, refresh, setQuantity, removeItem } = useCart();
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
  const [method, setMethod] = useState<'ONLINE' | 'COD'>('ONLINE');
  const [coupon, setCoupon] = useState<CouponQuote | null>(null);
  const [couponOpen, setCouponOpen] = useState(false);
  // Quantity changes right here (like the big stores): the line being updated, and a note when a
  // coupon stops applying after the change.
  const [qtyBusy, setQtyBusy] = useState<string | null>(null);
  const [couponNote, setCouponNote] = useState<string | null>(null);

  // Lines carry no image - one lookup per product (same as the cart).
  const [images, setImages] = useState<Record<string, string>>({});
  const imageIds = [...new Set(cart.items.map((l) => l.productId))].sort().join(',');
  useEffect(() => {
    const missing = imageIds.split(',').filter((id) => id && !(id in images));
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [imageIds]);

  const changeQuantity = async (cartItemId: string, quantity: number) => {
    if (qtyBusy) return;
    const remaining = cart.items.filter((l) => l.cartItemId !== cartItemId);
    setQtyBusy(cartItemId);
    setCouponNote(null);
    try {
      if (quantity <= 0) await removeItem(cartItemId);
      else await setQuantity(cartItemId, quantity);
      if (quantity <= 0 && remaining.length === 0) {
        // Nothing left to buy here.
        router.back();
        return;
      }
      if (coupon) {
        // The discount depends on the order value - check the code again against the new lines.
        const ids = buyIds
          ? quantity <= 0
            ? buyIds.filter((id) => id !== cartItemId)
            : buyIds
          : undefined;
        try {
          setCoupon(await api.orders.quoteCoupon(coupon.coupon.code, ids));
        } catch (failure) {
          setCoupon(null);
          setCouponNote(
            failure instanceof ApiError
              ? `${coupon.coupon.code} removed: ${failure.message}`
              : `${coupon.coupon.code} was removed - please apply it again.`,
          );
        }
      }
    } finally {
      setQtyBusy(null);
    }
  };

  const totals = cartTotals(cart, CART_SHIPPING_TOTAL);
  // v1.13: what's actually payable after the coupon (the server re-checks it at "Place order").
  const payable = (coupon ? coupon.total : totals.total) as Money;
  const codOk = codAvailable(payable);
  const cod = method === 'COD' && codOk;
  // Cash on Delivery is never mixed with wallet money: the whole total is paid at the door.
  const hasWallet = !cod && !!wallet && wallet.available !== '0.00';
  const split = hasWallet && useWallet ? walletSplit(payable, wallet.available) : null;
  const payNow = split ? split.online : payable;

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
  const placingSteps = [
    'Checking prices & stock',
    ...(coupon ? [`Applying ${coupon.coupon.code}`] : []),
    cod ? 'Confirming your Cash on Delivery order' : 'Preparing secure payment',
  ];

  const placeOrder = async () => {
    if (!selectedId) {
      setError('Please choose a delivery address.');
      return;
    }
    setPlacing(true);
    setError(null);
    try {
      // The real requests run under the "Placing your order" steps (a minimum so it reads as real).
      const order = await atLeast(
        (async () => {
          const placed = await api.orders.checkout(
            selectedId,
            buyIds ? cart.items.map((line) => line.cartItemId) : undefined,
            coupon?.coupon.code,
          );
          // Cash on Delivery: confirmed straight away - nothing to pay now.
          if (cod) await api.payments.pay(placed.orderId, false, 'COD');
          return placed;
        })(),
        placingSteps.length * PLACING_STEP_MS + 250,
      );
      void refresh(); // the ordered lines have left the cart
      if (cod) {
        router.replace({ pathname: '/order-success', params: { orderId: order.orderId } });
        return;
      }
      router.replace({
        pathname: '/payment',
        params: { orderId: order.orderId, useWallet: hasWallet && useWallet ? '1' : '0' },
      });
    } catch (err) {
      setError(
        err instanceof ApiError && (err.status === 409 || err.status === 400)
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
          {cart.items.map((line, index) => {
            const busy = qtyBusy === line.cartItemId;
            return (
              <View
                key={line.cartItemId}
                style={[styles.item, index === cart.items.length - 1 && styles.itemLast]}
              >
                <Pressable
                  onPress={() => line.productSlug && router.push(`/product/${line.productSlug}`)}
                >
                  <ProductImage
                    src={images[line.productId] || undefined}
                    style={styles.itemThumb}
                    icon={18}
                  />
                </Pressable>
                <View style={styles.itemBody}>
                  <Text numberOfLines={2} style={styles.itemTitle}>
                    {line.title}
                  </Text>
                  <Text style={styles.itemUnit}>{formatMoney(line.priceSnapshot)} each</Text>
                  <View style={styles.itemRow}>
                    <View style={[styles.stepper, busy && { opacity: 0.6 }]}>
                      <Pressable
                        style={styles.stepBtn}
                        disabled={!!qtyBusy || placing}
                        hitSlop={6}
                        accessibilityLabel={line.quantity <= 1 ? 'Remove item' : 'Decrease quantity'}
                        onPress={() => void changeQuantity(line.cartItemId, line.quantity - 1)}
                      >
                        <Ionicons
                          name={line.quantity <= 1 ? 'trash-outline' : 'remove'}
                          size={16}
                          color={line.quantity <= 1 ? colors.cart.danger : colors.brand.DEFAULT}
                        />
                      </Pressable>
                      {busy ? (
                        <ActivityIndicator
                          size="small"
                          color={colors.brand.DEFAULT}
                          style={styles.qtySpinner}
                        />
                      ) : (
                        <Text style={styles.qty}>{line.quantity}</Text>
                      )}
                      <Pressable
                        style={styles.stepBtn}
                        disabled={!!qtyBusy || placing}
                        hitSlop={6}
                        accessibilityLabel="Increase quantity"
                        onPress={() => void changeQuantity(line.cartItemId, line.quantity + 1)}
                      >
                        <Ionicons name="add" size={16} color={colors.brand.DEFAULT} />
                      </Pressable>
                    </View>
                    <Text style={styles.sumValue}>{formatMoney(line.lineTotal)}</Text>
                  </View>
                </View>
              </View>
            );
          })}
          <View style={styles.divider} />
          <View style={styles.sumLine}>
            <Text style={styles.sumLabel}>Subtotal</Text>
            <Text style={styles.sumValue}>{formatMoney(totals.subtotal)}</Text>
          </View>
          <View style={styles.sumLine}>
            <Text style={styles.sumLabel}>Shipping</Text>
            <Text style={styles.free}>Free</Text>
          </View>
          {coupon ? (
            <View style={styles.sumLine}>
              <Text style={styles.sumLabel}>Coupon ({coupon.coupon.code})</Text>
              <Text style={styles.discountValue}>− {formatMoney(coupon.discount)}</Text>
            </View>
          ) : null}
          <View style={[styles.sumLine, styles.totalRow]}>
            <Text style={styles.totalLabel}>Total</Text>
            <Text style={styles.totalValue}>{formatMoney(payable)}</Text>
          </View>
        </View>

        <Text style={styles.sectionTitle}>Coupons</Text>
        {couponNote ? <Text style={styles.couponNote}>{couponNote}</Text> : null}
        {coupon ? (
          <View style={[styles.couponCard, styles.couponOn]}>
            <Ionicons name="pricetag" size={20} color={colors.feature.guarantee} />
            <View style={{ flex: 1 }}>
              <Text style={styles.couponTitle}>{coupon.coupon.code} applied</Text>
              <Text style={styles.couponSave}>You save {formatMoney(coupon.discount)}</Text>
            </View>
            <Pressable onPress={() => setCoupon(null)} hitSlop={8}>
              <Text style={styles.couponRemove}>Remove</Text>
            </Pressable>
          </View>
        ) : (
          <Pressable style={styles.couponCard} onPress={() => setCouponOpen(true)}>
            <Ionicons name="pricetag-outline" size={20} color={colors.brand.DEFAULT} />
            <Text style={[styles.couponTitle, { flex: 1 }]}>Apply coupon</Text>
            <Ionicons name="chevron-forward" size={18} color={colors.text.muted} />
          </Pressable>
        )}

        <Text style={styles.sectionTitle}>Payment method</Text>
        <View style={styles.methods}>
          <Pressable
            style={[styles.method, method === 'ONLINE' && styles.methodOn]}
            onPress={() => setMethod('ONLINE')}
          >
            <Ionicons
              name={method === 'ONLINE' ? 'radio-button-on' : 'radio-button-off'}
              size={20}
              color={colors.brand.DEFAULT}
            />
            <View style={styles.methodBody}>
              <Text style={styles.methodTitle}>Pay online</Text>
              <Text style={styles.methodSub}>UPI, GPay, PhonePe, cards, net banking</Text>
            </View>
            <Ionicons name="card-outline" size={22} color={colors.brand.DEFAULT} />
          </Pressable>
          <Pressable
            style={[styles.method, cod && styles.methodOn, !codOk && styles.methodDisabled]}
            onPress={() => codOk && setMethod('COD')}
            disabled={!codOk}
          >
            <Ionicons
              name={cod ? 'radio-button-on' : 'radio-button-off'}
              size={20}
              color={codOk ? colors.brand.DEFAULT : colors.text.muted}
            />
            <View style={styles.methodBody}>
              <Text style={styles.methodTitle}>Cash on Delivery</Text>
              <Text style={styles.methodSub}>
                {codOk
                  ? 'Pay in cash or UPI when your order arrives'
                  : `Available for orders up to ${formatMoney(COD_MAX_AMOUNT)}`}
              </Text>
            </View>
            <Ionicons
              name="cash-outline"
              size={22}
              color={codOk ? colors.feature.guarantee : colors.text.muted}
            />
          </Pressable>
        </View>

        {hasWallet ? (
          <>
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

      <PlacingOrderOverlay visible={placing} steps={placingSteps} stepMs={PLACING_STEP_MS} />
      <CouponSheet
        visible={couponOpen}
        subtotal={totals.subtotal}
        cartItemIds={buyIds ? cart.items.map((line) => line.cartItemId) : undefined}
        onClose={() => setCouponOpen(false)}
        onApplied={(q) => {
          setCoupon(q);
          setCouponOpen(false);
        }}
      />

      <View style={[styles.footer, { paddingBottom: insets.bottom + space.md }]}>
        <View>
          <Text style={styles.footerLabel}>
            {cod ? 'Pay on delivery' : split ? 'To pay now' : 'Total'}
          </Text>
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
              {cod
                ? 'Place COD order'
                : split && split.online === '0.00'
                  ? 'Pay with wallet'
                  : 'Place order'}
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
  discountValue: { fontFamily: font.uiSemibold, fontSize: 14, color: colors.feature.guarantee },
  couponCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    backgroundColor: colors.white,
    borderRadius: radii.tile,
    borderWidth: 1.5,
    borderColor: colors.card.border,
    padding: space.md,
  },
  couponOn: { borderColor: colors.feature.guarantee, backgroundColor: '#eefaf2' },
  couponTitle: { fontFamily: font.uiSemibold, fontSize: 14.5, color: colors.text.strong },
  couponSave: { fontFamily: font.uiMedium, fontSize: 12.5, color: colors.feature.guarantee },
  couponRemove: { fontFamily: font.uiBold, fontSize: 13.5, color: colors.price.discount },
  methods: { gap: space.sm },
  method: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    backgroundColor: colors.white,
    borderRadius: radii.tile,
    borderWidth: 1.5,
    borderColor: colors.card.border,
    padding: space.md,
  },
  methodOn: { borderColor: colors.brand.DEFAULT, backgroundColor: colors.brandPopup.bg },
  methodDisabled: { opacity: 0.55 },
  methodBody: { flex: 1, gap: 2 },
  methodTitle: { fontFamily: font.uiSemibold, fontSize: 14.5, color: colors.text.strong },
  methodSub: { fontFamily: font.body, fontSize: 12.5, color: colors.text.body },
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
  item: {
    flexDirection: 'row',
    gap: space.md,
    paddingBottom: space.md,
    marginBottom: space.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.cart.line,
  },
  itemLast: { borderBottomWidth: 0, marginBottom: 0 },
  itemThumb: { width: 58, height: 58, borderRadius: 10 },
  itemBody: { flex: 1, gap: 3 },
  itemTitle: { fontFamily: font.uiMedium, fontSize: 13.5, color: colors.text.strong },
  itemUnit: { fontFamily: font.body, fontSize: 12, color: colors.text.muted },
  itemRow: {
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
    backgroundColor: colors.white,
  },
  stepBtn: { paddingHorizontal: 11, paddingVertical: 6 },
  qty: {
    fontFamily: font.uiSemibold,
    fontSize: 14,
    color: colors.text.strong,
    minWidth: 26,
    textAlign: 'center',
  },
  qtySpinner: { width: 26 },
  couponNote: {
    fontFamily: font.uiMedium,
    fontSize: 12.5,
    color: colors.price.discount,
    marginBottom: space.sm,
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
