import { useCallback, useEffect, useRef, useState } from 'react';
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
import { useFocusEffect, useLocalSearchParams, useNavigation } from 'expo-router';
import { useRouter } from '@/lib/router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  deliveryFee,
  fromPaise,
  toPaise,
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
import { AddressPickerSheet, AddressSummary } from '@/components/AddressPickerSheet';
import { useCart } from '@/stores/cart';
import { CouponSheet } from '@/components/CouponSheet';
import { ProductImage } from '@/components/ui';
import { PlacingOrderOverlay, atLeast } from '@/components/PlacingOrderOverlay';
import { colors, font, space } from '@/theme';

// Checkout: pick a real saved address + order summary (server cart) -> create a PENDING_PAYMENT
// order -> go to the payment screen. Server owns prices (anti-tampering). W9: the YouMart Wallet
// balance can pay for the order on its own or together with Razorpay.
const PLACING_STEP_MS = 850;

/** v1.18 one checkout part: a white card with an icon header. */
function Section({
  icon,
  title,
  right,
  children,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  right?: string;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionHead}>
        <View style={styles.sectionIcon}>
          <Ionicons name={icon} size={15} color={colors.brand.DEFAULT} />
        </View>
        <Text style={styles.sectionTitle}>{title}</Text>
        {right ? <Text style={styles.sectionRight}>{right}</Text> : null}
      </View>
      {children}
    </View>
  );
}

export default function CheckoutScreen() {
  const router = useRouter();
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { cart: fullCart, refresh, setQuantity, removeItem } = useCart();
  const {
    addressId: pickedId,
    buy,
    temp,
  } = useLocalSearchParams<{ addressId?: string; buy?: string; temp?: string }>();
  // "Buy this now" from the cart: only these lines (comma-separated cart item ids) are ordered.
  const buyIds = typeof buy === 'string' && buy ? buy.split(',') : null;
  const cart = buyIds
    ? recalcCart(
        fullCart.cartId,
        fullCart.items.filter((line) => buyIds.includes(line.cartItemId)),
      )
    : fullCart;

  // v1.18 "Still in your cart": if they leave without ordering, a WhatsApp nudge follows later.
  // Buy Now (`temp=1`) is about that product, which leaves the cart again if they back out.
  const nudgeSource = temp === '1' && buyIds ? 'BUY_NOW' : 'CART';
  const nudgeSkus = cart.items.map((line) => line.skuId).join(',');
  useEffect(() => {
    if (!nudgeSkus) return;
    void api
      .checkoutStarted({ source: nudgeSource, skuIds: nudgeSkus.split(',') })
      .catch(() => undefined);
  }, [nudgeSource, nudgeSkus]);

  // `temp=1`: a product card's / product page's "Buy" put this line into the cart only so it could
  // be checked out. Leaving checkout without ordering takes it back out - the shopper never added it.
  const ordered = useRef(false);
  const released = useRef(false);
  const removeRef = useRef(removeItem);
  removeRef.current = removeItem;
  useEffect(() => {
    const tempIds = temp === '1' && buyIds ? buyIds : null;
    if (!tempIds) return;
    const release = () => {
      if (released.current || ordered.current) return;
      released.current = true;
      for (const id of tempIds) void removeRef.current(id).catch(() => undefined);
    };
    // As soon as they head back (before the slide-out animation), so the screen underneath never
    // shows the line; unmount is the fallback.
    // (Typed loosely: expo-router's untyped navigation doesn't list the stack's beforeRemove.)
    const unsubscribe = (
      navigation as unknown as { addListener: (e: 'beforeRemove', cb: () => void) => () => void }
    ).addListener('beforeRemove', release);
    return () => {
      unsubscribe();
      release();
    };
    // Once per visit: the ids this checkout was opened with.
  }, []);

  const [addresses, setAddresses] = useState<Address[] | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  // v1.17 billing address (Amazon / Flipkart style): the delivery address unless unticked.
  const [billSame, setBillSame] = useState(true);
  const [billingId, setBillingId] = useState<string | null>(null);
  // v1.18 which address list is open (one compact address shows; "Change" opens the list).
  const [picker, setPicker] = useState<'delivery' | 'billing' | null>(null);
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

  // v1.16: delivery by the chosen address (free from ₹2,000) - the server charges the same.
  const shipAddress = addresses?.find((a) => a.id === selectedId) ?? null;
  const shipping = deliveryFee(cart.subtotal, shipAddress) ?? '0.00';
  const totals = cartTotals(cart, shipping);
  // v1.13: what's actually payable after the coupon (the server re-checks it at "Place order").
  const payable = (
    coupon ? fromPaise(toPaise(coupon.total) + toPaise(shipping)) : totals.total
  ) as Money;
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
  const billing = addresses?.find((a) => a.id === billingId) ?? null;
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
    if (!billSame && !billingId) {
      setError('Please choose a billing address.');
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
            billSame ? undefined : (billingId ?? undefined),
          );
          // Cash on Delivery: confirmed straight away - nothing to pay now.
          if (cod) await api.payments.pay(placed.orderId, false, 'COD');
          return placed;
        })(),
        placingSteps.length * PLACING_STEP_MS + 250,
      );
      ordered.current = true;
      void refresh();
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
        {/* v1.18 products first, then where they go - each part in its own card. */}
        <Section
          icon="bag-handle"
          title="Order summary"
          right={`${cart.items.length} item${cart.items.length === 1 ? '' : 's'}`}
        >
          {buyIds && fullCart.items.length > cart.items.length ? (
            <View style={styles.buyNote}>
              <Ionicons name="flash" size={15} color={colors.brand.DEFAULT} />
              <Text style={styles.buyNoteText}>
                Buying {cart.items.length === 1 ? 'this item' : `${cart.items.length} items`} only -
                the rest stay in your cart.
              </Text>
            </View>
          ) : null}
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
                        accessibilityLabel={
                          line.quantity <= 1 ? 'Remove item' : 'Decrease quantity'
                        }
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
        </Section>

        <Section icon="location" title="Deliver to">
          {!addresses ? (
            <ActivityIndicator color={colors.brand.DEFAULT} style={{ margin: space.md }} />
          ) : !selected ? (
            <Pressable style={styles.addAddress} onPress={() => router.push('/addresses/form')}>
              <Ionicons name="add-circle" size={20} color={colors.brand.DEFAULT} />
              <Text style={styles.addAddressText}>Add a delivery address</Text>
            </Pressable>
          ) : (
            <>
              <AddressSummary address={selected} onChange={() => setPicker('delivery')} />
              <View style={styles.cardDivider} />
              <Pressable
                style={styles.sameRow}
                onPress={() => {
                  const next = !billSame;
                  setBillSame(next);
                  // Unticked: start from another saved address (the delivery one if it's the only).
                  if (!next && !billingId) {
                    setBillingId(addresses.find((a) => a.id !== selectedId)?.id ?? selectedId);
                  }
                }}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: billSame }}
              >
                <Ionicons
                  name={billSame ? 'checkbox' : 'square-outline'}
                  size={20}
                  color={billSame ? colors.brand.DEFAULT : colors.text.muted}
                />
                <Text style={styles.sameText}>Billing address same as delivery</Text>
              </Pressable>
              {!billSame && billing ? (
                <View style={styles.billingBox}>
                  <Text style={styles.billingLabel}>BILL TO</Text>
                  <AddressSummary address={billing} onChange={() => setPicker('billing')} />
                </View>
              ) : null}
            </>
          )}
        </Section>

        <View style={[styles.section, styles.couponCard]}>
          {couponNote ? <Text style={styles.couponNote}>{couponNote}</Text> : null}
          {coupon ? (
            <View style={[styles.couponRow, styles.couponOn]}>
              <Ionicons name="checkmark-circle" size={20} color={colors.feature.guarantee} />
              <View style={{ flex: 1 }}>
                <Text style={styles.couponTitle}>{coupon.coupon.code} applied</Text>
                <Text style={styles.couponSave}>You save {formatMoney(coupon.discount)}</Text>
              </View>
              <Pressable onPress={() => setCoupon(null)} hitSlop={8}>
                <Text style={styles.couponRemove}>Remove</Text>
              </Pressable>
            </View>
          ) : (
            <Pressable style={styles.couponRow} onPress={() => setCouponOpen(true)}>
              <Ionicons name="ticket-outline" size={20} color={colors.brand.DEFAULT} />
              <Text style={[styles.couponTitle, { flex: 1 }]}>Apply a coupon</Text>
              <Text style={styles.couponView}>View all</Text>
              <Ionicons name="chevron-forward" size={16} color={colors.brand.DEFAULT} />
            </Pressable>
          )}
        </View>

        <Section icon="card" title="Payment method">
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
            <View style={styles.methodIcon}>
              <Ionicons name="phone-portrait-outline" size={18} color={colors.brand.DEFAULT} />
            </View>
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
            <View style={[styles.methodIcon, { backgroundColor: '#e8f7ee' }]}>
              <Ionicons
                name="cash-outline"
                size={18}
                color={codOk ? colors.feature.guarantee : colors.text.muted}
              />
            </View>
          </Pressable>

          {hasWallet ? (
            <View style={styles.walletBox}>
              <View style={styles.walletRow}>
                <View style={styles.walletIcon}>
                  <Ionicons name="wallet" size={17} color={colors.white} />
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
          ) : null}
        </Section>

        <Section icon="receipt" title="Price details">
          <View style={styles.sumLine}>
            <Text style={styles.sumLabel}>
              Price ({cart.itemCount} item{cart.itemCount === 1 ? '' : 's'})
            </Text>
            <Text style={styles.sumValue}>{formatMoney(totals.subtotal)}</Text>
          </View>
          <View style={styles.sumLine}>
            <Text style={styles.sumLabel}>Delivery</Text>
            {toPaise(shipping) === 0 ? (
              <Text style={styles.free}>FREE</Text>
            ) : (
              <Text style={styles.sumValue}>{formatMoney(shipping)}</Text>
            )}
          </View>
          {coupon ? (
            <View style={styles.sumLine}>
              <Text style={styles.sumLabel}>Coupon ({coupon.coupon.code})</Text>
              <Text style={styles.discountValue}>− {formatMoney(coupon.discount)}</Text>
            </View>
          ) : null}
          <View style={[styles.sumLine, styles.totalRow]}>
            <Text style={styles.totalLabel}>Total amount</Text>
            <Text style={styles.totalValue}>{formatMoney(payable)}</Text>
          </View>
          {coupon ? (
            <View style={styles.saveBanner}>
              <Ionicons name="sparkles" size={14} color={colors.feature.guarantee} />
              <Text style={styles.saveText}>
                You save {formatMoney(coupon.discount)} on this order
              </Text>
            </View>
          ) : null}
        </Section>

        {error ? <Text style={styles.error}>{error}</Text> : null}
      </ScrollView>

      <AddressPickerSheet
        visible={picker !== null}
        title={picker === 'billing' ? 'Billing address' : 'Deliver to'}
        addresses={addresses ?? []}
        selectedId={picker === 'billing' ? billingId : selectedId}
        onPick={(id) => {
          if (picker === 'billing') setBillingId(id);
          else setSelectedId(id);
          setPicker(null);
        }}
        onAdd={() => {
          setPicker(null);
          router.push('/addresses/form');
        }}
        onClose={() => setPicker(null)}
      />
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

      <View style={[styles.footer, { paddingBottom: insets.bottom + 10 }]}>
        <View>
          <Text style={styles.footerTotal}>{formatMoney(payNow)}</Text>
          <Text style={styles.footerLabel}>
            {cod ? 'Pay on delivery' : split ? 'To pay now' : 'Total amount'}
          </Text>
        </View>
        <Pressable
          style={[styles.payBtn, (!selected || placing) && styles.disabled]}
          onPress={placeOrder}
          disabled={!selected || placing}
        >
          {placing ? (
            <ActivityIndicator color={colors.white} />
          ) : (
            <View style={styles.payInner}>
              <Ionicons name="lock-closed" size={15} color={colors.white} />
              <Text style={styles.payText}>
                {cod
                  ? 'Place COD order'
                  : split && split.online === '0.00'
                    ? 'Pay with wallet'
                    : 'Place order'}
              </Text>
            </View>
          )}
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#eef5fb' },
  body: {
    paddingHorizontal: space.md,
    paddingTop: 10,
    gap: 10,
    paddingBottom: space.md,
  },
  section: {
    backgroundColor: colors.white,
    borderRadius: 16,
    paddingHorizontal: space.md,
    paddingVertical: 11,
    gap: 8,
    shadowColor: '#0f2a5c',
    shadowOpacity: 0.07,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  sectionHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  couponCard: { paddingVertical: 8 },
  sectionIcon: {
    width: 24,
    height: 24,
    borderRadius: 8,
    backgroundColor: colors.brandPopup.bg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionRight: { fontFamily: font.uiMedium, fontSize: 12.5, color: colors.text.muted },
  cardDivider: { height: StyleSheet.hairlineWidth, backgroundColor: colors.card.border },
  billingBox: {
    backgroundColor: '#f6f9fd',
    borderRadius: 12,
    padding: 10,
    gap: 6,
  },
  billingLabel: {
    fontFamily: font.uiBold,
    fontSize: 10.5,
    letterSpacing: 1,
    color: colors.text.muted,
  },
  couponRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.brand.DEFAULT,
    backgroundColor: '#f6f9fd',
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  couponView: { fontFamily: font.uiBold, fontSize: 12.5, color: colors.brand.DEFAULT },
  methodIcon: {
    width: 30,
    height: 30,
    borderRadius: 10,
    backgroundColor: colors.brandPopup.bg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  walletBox: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.card.border,
    padding: 10,
    gap: space.sm,
  },
  saveBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#e8f7ee',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  saveText: { fontFamily: font.uiSemibold, fontSize: 12.5, color: colors.feature.guarantee },
  payInner: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  discountValue: { fontFamily: font.uiSemibold, fontSize: 14, color: colors.feature.guarantee },
  couponOn: {
    borderStyle: 'solid',
    borderColor: colors.feature.guarantee,
    backgroundColor: '#eefaf2',
  },
  couponTitle: { fontFamily: font.uiSemibold, fontSize: 14.5, color: colors.text.strong },
  couponSave: { fontFamily: font.uiMedium, fontSize: 12.5, color: colors.feature.guarantee },
  couponRemove: { fontFamily: font.uiBold, fontSize: 13.5, color: colors.price.discount },
  method: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    backgroundColor: colors.white,
    borderRadius: 12,
    borderWidth: 1.2,
    borderColor: colors.card.border,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  methodOn: { borderColor: colors.brand.DEFAULT, backgroundColor: colors.brandPopup.bg },
  methodDisabled: { opacity: 0.55 },
  methodBody: { flex: 1, gap: 1 },
  methodTitle: { fontFamily: font.uiSemibold, fontSize: 14.5, color: colors.text.strong },
  methodSub: { fontFamily: font.body, fontSize: 12.5, color: colors.text.body },
  sectionTitle: { flex: 1, fontFamily: font.uiBold, fontSize: 15, color: colors.heading },
  addAddress: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
  },
  addAddressText: { fontFamily: font.uiSemibold, fontSize: 14, color: colors.brand.DEFAULT },
  sameRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  sameText: { fontFamily: font.uiMedium, fontSize: 13.5, color: colors.text.strong },
  sumLine: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: space.md,
  },
  item: {
    flexDirection: 'row',
    gap: 10,
    paddingBottom: 6,
    marginBottom: 6,
    borderBottomWidth: 1,
    borderBottomColor: colors.cart.line,
  },
  itemLast: { borderBottomWidth: 0, marginBottom: 0 },
  itemThumb: { width: 50, height: 50, borderRadius: 10 },
  itemBody: { flex: 1, gap: 1 },
  itemTitle: { fontFamily: font.uiMedium, fontSize: 13.5, color: colors.text.strong },
  itemUnit: { fontFamily: font.body, fontSize: 12, color: colors.text.muted },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 2,
  },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.cart.border,
    borderRadius: 8,
    backgroundColor: colors.white,
  },
  stepBtn: { paddingHorizontal: 10, paddingVertical: 3 },
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
    paddingVertical: 8,
  },
  buyNoteText: { flex: 1, fontFamily: font.uiMedium, fontSize: 13, color: colors.brand.DEFAULT },
  totalRow: {
    borderTopWidth: 1,
    borderTopColor: colors.cart.line,
    paddingTop: 7,
  },
  totalLabel: { fontFamily: font.uiBold, fontSize: 15, color: colors.text.strong },
  totalValue: { fontFamily: font.uiBold, fontSize: 17, color: colors.brand.DEFAULT },
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
    paddingHorizontal: space.lg,
    paddingTop: 10,
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    shadowColor: '#0f2a5c',
    shadowOpacity: 0.12,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: -3 },
    elevation: 12,
  },
  footerLabel: { fontFamily: font.uiMedium, fontSize: 12, color: colors.text.muted },
  footerTotal: { fontFamily: font.uiBold, fontSize: 20, color: colors.text.strong },
  payBtn: {
    backgroundColor: colors.brand.DEFAULT,
    borderRadius: 12,
    paddingHorizontal: 26,
    paddingVertical: 12,
    minWidth: 170,
    alignItems: 'center',
  },
  disabled: { opacity: 0.5 },
  payText: { fontFamily: font.uiSemibold, fontSize: 16, color: colors.white },
});
