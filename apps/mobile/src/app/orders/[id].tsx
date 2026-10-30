import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import {
  ApiError,
  TRACKING_STEPS,
  addressLines,
  formatMoney,
  orderStatusLabel,
  trackingProgress,
  type OrderPaymentSummary,
  type OrderView,
  type ReturnStatus,
  type ReturnView,
  type Money,
  type SellerItemStatus,
  type ShipmentTracking,
} from '@youmart/shared-client';
import { API_URL, api } from '@/lib/api';
import { ReasonSheet } from '@/components/ReasonSheet';
import { colors, font, radii, space } from '@/theme';

const CANCEL_REASONS = [
  'Ordered by mistake',
  'Found a better price elsewhere',
  'Delivery is taking too long',
  'Want to change the delivery address',
  'Something else',
] as const;

const RETURN_REASONS = [
  'Damaged or defective',
  'Wrong item received',
  'Item not as described',
  'Size or fit issue',
  'No longer needed',
] as const;

const RETURN_LABEL: Record<ReturnStatus, string> = {
  REQUESTED: 'Return requested',
  APPROVED: 'Return approved - pickup pending',
  PICKED_UP: 'Picked up - refund in progress',
  REFUNDED: 'Refunded to wallet',
  REJECTED: 'Return not approved',
};

/** Lines that have left the warehouse - the order can no longer be cancelled. */
const DISPATCHED = ['SHIPPED', 'DELIVERED', 'RETURNED'];

type Card = { image: string | null; slug: string };

// v1.17 order page: a coloured status hero (headline, order number, date) with the connected
// Order placed -> Packed -> Shipped -> Delivered tracker, item rows with product photos, a price
// summary, payment and delivery-address cards with icons, and the help / invoice / cancel actions.

type Tone = { fg: string; bg: string; icon: keyof typeof Ionicons.glyphMap };
const TONES = {
  green: { fg: '#15803d', bg: '#e8f7ee', icon: 'checkmark-circle' },
  blue: { fg: '#1d4ed8', bg: '#e9f0ff', icon: 'cube' },
  violet: { fg: '#6d28d9', bg: '#f1ebff', icon: 'car' },
  orange: { fg: '#c2410c', bg: '#fff1e6', icon: 'time' },
  red: { fg: '#b91c1c', bg: '#fdecec', icon: 'close-circle' },
} satisfies Record<string, Tone>;

const STEP_TONE: Tone[] = [TONES.orange, TONES.blue, TONES.violet, TONES.green];
const STEP_TEXT = [
  'We have received your order',
  'Your order is packed and ready to ship',
  'Your order is on the way',
  'Your order has been delivered',
];
const LINE_TONE: Record<SellerItemStatus, Tone> = {
  PENDING: TONES.orange,
  CONFIRMED: TONES.orange,
  PACKED: TONES.blue,
  SHIPPED: TONES.violet,
  DELIVERED: TONES.green,
  CANCELLED: TONES.red,
  RETURNED: TONES.orange,
};
const LINE_LABEL: Record<SellerItemStatus, string> = {
  PENDING: 'Processing',
  CONFIRMED: 'Processing',
  PACKED: 'Packed',
  SHIPPED: 'Shipped',
  DELIVERED: 'Delivered',
  CANCELLED: 'Cancelled',
  RETURNED: 'Returned',
};

const placedOn = (iso: string) =>
  new Intl.DateTimeFormat('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(iso));

function errorText(err: unknown, fallback: string): string {
  return err instanceof ApiError ? err.message : fallback;
}

export default function OrderDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const orderId = String(id ?? '');
  const [order, setOrder] = useState<OrderView | null | 'error'>(null);
  const [payment, setPayment] = useState<OrderPaymentSummary | null>(null);
  const [returns, setReturns] = useState<ReturnView[]>([]);
  const [tracking, setTracking] = useState<Record<string, ShipmentTracking | 'none' | 'loading'>>(
    {},
  );

  const [cancelOpen, setCancelOpen] = useState(false);
  // v1.17 the one line being cancelled (null = none).
  const [cancelItem, setCancelItem] = useState<OrderView['items'][number] | null>(null);
  const [returnItem, setReturnItem] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [sheetError, setSheetError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [invoiceBusy, setInvoiceBusy] = useState(false);
  // productId -> photo + slug from the catalog (order lines carry neither): the item photos, the
  // product link and "Rate product" on delivered lines.
  const [cards, setCards] = useState<Record<string, Card>>({});

  const load = useCallback(async () => {
    try {
      const o = await api.orders.get(orderId);
      setOrder(o);
      const [p, r] = await Promise.all([
        api.payments.orderSummary(o.orderId).catch(() => null),
        api.returns.list({ limit: 50 }).catch(() => null),
      ]);
      setPayment(p);
      api.catalog
        .productCards([...new Set(o.items.map((i) => i.productId))].slice(0, 50))
        .then(({ items }) =>
          setCards(
            Object.fromEntries(items.map((c) => [c.id, { image: c.imageUrl, slug: c.slug }])),
          ),
        )
        .catch(() => undefined);
      const lineIds = new Set(o.items.map((i) => i.orderItemId));
      setReturns((r?.items ?? []).filter((ret) => lineIds.has(ret.orderItemId)));
    } catch {
      setOrder((cur) => (cur && cur !== 'error' ? cur : 'error'));
    }
  }, [orderId]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  if (order === null) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.brand.DEFAULT} />
      </View>
    );
  }
  if (order === 'error') {
    return (
      <View style={styles.center}>
        <Text style={styles.err}>Order not found.</Text>
      </View>
    );
  }

  const { step, cancelled } = trackingProgress(order);
  const pending = order.status === 'PENDING_PAYMENT';
  const confirmed = order.status === 'CONFIRMED';
  const dispatched = order.items.some((i) => DISPATCHED.includes(i.sellerStatus));
  const cancelRequested = order.cancelRequest?.status === 'REQUESTED';
  const canCancel = pending || (confirmed && !dispatched && !cancelRequested);
  const cod = order.paymentMethod === 'COD';
  const units = order.items.reduce((n, i) => n + i.quantity, 0);
  const liveLines = order.items.filter((i) => i.sellerStatus !== 'CANCELLED').length;
  const paidForLine = (i: OrderView['items'][number]) =>
    (Number(i.lineTotal) - Number(i.discount ?? 0)).toFixed(2) as Money;
  const cancelledLines = order.items.filter((i) => i.sellerStatus === 'CANCELLED');
  const cancelledAmount = cancelledLines.reduce((n, i) => n + Number(paidForLine(i)), 0);
  const tone: Tone = cancelled
    ? TONES.red
    : pending
      ? TONES.orange
      : (STEP_TONE[step] ?? TONES.orange);
  const headline = pending ? 'Payment pending' : orderStatusLabel(order);
  const heroSub = cancelled
    ? 'This order has been cancelled'
    : pending
      ? 'Complete the payment to confirm your order'
      : (STEP_TEXT[step] ?? STEP_TEXT[0]);
  const returnFor = (orderItemId: string) =>
    returns.find((r) => r.orderItemId === orderItemId && r.status !== 'REJECTED') ??
    returns.find((r) => r.orderItemId === orderItemId);

  const submitCancel = async (reason: string, comment: string) => {
    setBusy(true);
    setSheetError(null);
    try {
      const result = await api.orders.cancel(order.orderId, {
        reason,
        ...(comment ? { comment } : {}),
      });
      setCancelOpen(false);
      setNotice(
        result.outcome === 'CANCELLED'
          ? 'Your order has been cancelled.'
          : 'Cancellation requested. Once approved, the amount you paid is added to your YouMart Wallet.',
      );
      await load();
    } catch (err) {
      setSheetError(errorText(err, 'Could not cancel the order. Please try again.'));
    } finally {
      setBusy(false);
    }
  };

  const submitCancelItem = async (reason: string, comment: string) => {
    if (!cancelItem) return;
    setBusy(true);
    setSheetError(null);
    try {
      const result = await api.orders.cancelItem(order.orderId, cancelItem.orderItemId, {
        reason,
        ...(comment ? { comment } : {}),
      });
      setCancelItem(null);
      setNotice(
        result.outcome === 'CANCELLED'
          ? 'Item cancelled. The rest of your order carries on as usual.'
          : 'Cancellation requested for this item. Once approved, what you paid for it is added to your YouMart Wallet.',
      );
      await load();
    } catch (err) {
      setSheetError(errorText(err, 'Could not cancel this item. Please try again.'));
    } finally {
      setBusy(false);
    }
  };

  const submitReturn = async (reason: string, comment: string) => {
    if (!returnItem) return;
    setBusy(true);
    setSheetError(null);
    try {
      await api.returns.create(returnItem, comment ? `${reason} - ${comment}` : reason);
      setReturnItem(null);
      setNotice(
        'Return requested. We will arrange a pickup; the refund goes to your YouMart Wallet.',
      );
      await load();
    } catch (err) {
      setSheetError(errorText(err, 'Could not request the return. Please try again.'));
    } finally {
      setBusy(false);
    }
  };

  const toggleTracking = async (orderItemId: string) => {
    if (tracking[orderItemId] && tracking[orderItemId] !== 'loading') {
      setTracking((t) => {
        const next = { ...t };
        delete next[orderItemId];
        return next;
      });
      return;
    }
    setTracking((t) => ({ ...t, [orderItemId]: 'loading' }));
    try {
      const shipment = await api.logistics.trackOrderItem(orderItemId);
      setTracking((t) => ({ ...t, [orderItemId]: shipment }));
    } catch {
      setTracking((t) => ({ ...t, [orderItemId]: 'none' }));
    }
  };

  const openInvoice = async () => {
    setInvoiceBusy(true);
    try {
      const link = await api.invoices.downloadLink(order.orderId);
      await WebBrowser.openBrowserAsync(`${API_URL}${link.path}`);
    } catch (err) {
      Alert.alert(
        'Invoice',
        err instanceof ApiError && err.status === 404
          ? 'Your invoice is being prepared. Please check again in a few minutes.'
          : 'Could not open the invoice. Please try again.',
      );
    } finally {
      setInvoiceBusy(false);
    }
  };

  return (
    <>
      <ScrollView style={styles.screen} contentContainerStyle={styles.body}>
        <View style={styles.hero}>
          <View style={[styles.heroTop, { backgroundColor: tone.bg }]}>
            <View style={[styles.heroIcon, { backgroundColor: tone.fg }]}>
              <Ionicons name={tone.icon} size={20} color={colors.white} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.heroTitle, { color: tone.fg }]}>{headline}</Text>
              <Text style={styles.heroSub}>{heroSub}</Text>
            </View>
          </View>
          <View style={styles.heroMeta}>
            <View style={{ flex: 1 }}>
              <Text style={styles.metaLabel}>Order ID</Text>
              <Text style={styles.metaValue} selectable numberOfLines={1}>
                #{order.orderNumber}
              </Text>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={styles.metaLabel}>Placed on</Text>
              <Text style={styles.metaValue}>{placedOn(order.createdAt)}</Text>
            </View>
          </View>
          {!cancelled ? (
            <View style={styles.tracker}>
              {TRACKING_STEPS.map((label, i) => (
                <View key={label} style={styles.step}>
                  <View style={styles.stepRail}>
                    <View
                      style={[
                        styles.rail,
                        i === 0 && styles.railHidden,
                        i <= step && styles.railDone,
                      ]}
                    />
                    <View style={[styles.dot, i <= step && styles.dotDone]}>
                      {i <= step ? (
                        <Ionicons name="checkmark" size={13} color={colors.white} />
                      ) : null}
                    </View>
                    <View
                      style={[
                        styles.rail,
                        i === TRACKING_STEPS.length - 1 && styles.railHidden,
                        i < step && styles.railDone,
                      ]}
                    />
                  </View>
                  <Text
                    style={[styles.stepLabel, i <= step && styles.stepLabelDone]}
                    numberOfLines={1}
                  >
                    {label}
                  </Text>
                </View>
              ))}
            </View>
          ) : null}
        </View>

        {notice ? (
          <View style={styles.notice}>
            <Ionicons name="checkmark-circle" size={18} color={colors.feature.guarantee} />
            <Text style={styles.noticeText}>{notice}</Text>
          </View>
        ) : null}

        {cancelRequested ? (
          <View style={styles.infoBox}>
            <Ionicons name="time-outline" size={18} color={colors.brand.DEFAULT} />
            <Text style={styles.infoText}>
              Cancellation requested. Once approved, the amount you paid is added to your YouMart
              Wallet.
            </Text>
          </View>
        ) : order.cancelRequest?.status === 'REJECTED' ? (
          <View style={styles.infoBox}>
            <Ionicons name="information-circle-outline" size={18} color={colors.brand.DEFAULT} />
            <Text style={styles.infoText}>
              Your cancellation request couldn&apos;t be approved - the order is already being
              prepared. You can request a return after delivery.
            </Text>
          </View>
        ) : null}

        {pending ? (
          <View style={styles.payBox}>
            <Text style={styles.payBoxText}>
              This order is waiting for payment. Unpaid orders are cancelled automatically after 30
              minutes.
            </Text>
            <Pressable
              style={styles.primaryBtn}
              onPress={() =>
                router.push({
                  pathname: '/payment',
                  params: { orderId: order.orderId, useWallet: '1' },
                })
              }
            >
              <Text style={styles.primaryText}>Pay {formatMoney(order.grandTotal)}</Text>
            </Pressable>
          </View>
        ) : null}

        <Text style={styles.section}>
          Items <Text style={styles.sectionCount}>({units})</Text>
        </Text>
        <View style={styles.card}>
          {order.items.map((item, idx) => {
            const ret = returnFor(item.orderItemId);
            const track = tracking[item.orderItemId];
            const card = cards[item.productId];
            const canReturn =
              item.sellerStatus === 'DELIVERED' && (!ret || ret.status === 'REJECTED');
            const canTrack = item.sellerStatus === 'SHIPPED' || item.sellerStatus === 'DELIVERED';
            // Rate after delivery (Flipkart-style).
            const rateSlug = item.sellerStatus === 'DELIVERED' ? card?.slug : undefined;
            const lineTone = LINE_TONE[item.sellerStatus];
            const lineCancelled = item.sellerStatus === 'CANCELLED';
            const lineRequest = item.cancelRequest;
            // Not while unpaid, and the only line left is the whole order (Cancel order below).
            const canCancelLine =
              confirmed &&
              liveLines > 1 &&
              !cancelRequested &&
              lineRequest?.status !== 'REQUESTED' &&
              !lineCancelled &&
              !DISPATCHED.includes(item.sellerStatus);
            return (
              <View
                key={item.orderItemId}
                style={[styles.itemBlock, idx > 0 && styles.itemDivider]}
              >
                <Pressable
                  style={[styles.item, lineCancelled && styles.itemCancelled]}
                  disabled={!card?.slug}
                  onPress={() => card && router.push(`/product/${card.slug}`)}
                >
                  <View style={styles.thumb}>
                    {card?.image ? (
                      <Image
                        source={{ uri: card.image }}
                        style={styles.thumbImg}
                        contentFit="contain"
                        transition={150}
                      />
                    ) : (
                      <Ionicons name="image-outline" size={22} color={colors.card.border} />
                    )}
                  </View>
                  <View style={styles.itemBody}>
                    <Text
                      numberOfLines={2}
                      style={[styles.itemTitle, lineCancelled && styles.struck]}
                    >
                      {item.title}
                    </Text>
                    <Text style={styles.itemMeta}>
                      Qty {item.quantity}
                      {item.quantity > 1 ? ` · ${formatMoney(item.unitPrice)} each` : ''}
                    </Text>
                    <View style={styles.itemFoot}>
                      <View style={[styles.linePill, { backgroundColor: lineTone.bg }]}>
                        <View style={[styles.linePillDot, { backgroundColor: lineTone.fg }]} />
                        <Text style={[styles.linePillText, { color: lineTone.fg }]}>
                          {LINE_LABEL[item.sellerStatus]}
                        </Text>
                      </View>
                      <Text style={[styles.itemPrice, lineCancelled && styles.struck]}>
                        {formatMoney(item.lineTotal)}
                      </Text>
                    </View>
                  </View>
                </Pressable>
                {ret && ret.status !== 'REJECTED' ? (
                  <View style={styles.returnPill}>
                    <Ionicons name="return-down-back" size={13} color={colors.brand.DEFAULT} />
                    <Text style={styles.returnPillText}>
                      {RETURN_LABEL[ret.status]}
                      {ret.status === 'REFUNDED' && ret.refundAmount
                        ? ` · ${formatMoney(ret.refundAmount)}`
                        : ''}
                    </Text>
                  </View>
                ) : null}
                {lineRequest?.status === 'REQUESTED' && !lineCancelled ? (
                  <View style={styles.lineNote}>
                    <Ionicons name="time-outline" size={13} color={colors.brand.DEFAULT} />
                    <Text style={styles.lineNoteText}>
                      Cancellation requested · {formatMoney(paidForLine(item))} to your wallet once
                      approved
                    </Text>
                  </View>
                ) : lineRequest?.status === 'REJECTED' && !lineCancelled ? (
                  <View style={[styles.lineNote, styles.lineNoteWarn]}>
                    <Ionicons name="alert-circle-outline" size={13} color="#92400e" />
                    <Text style={[styles.lineNoteText, { color: '#92400e' }]}>
                      {lineRequest.note ?? "Cancellation couldn't be approved for this item"}
                    </Text>
                  </View>
                ) : null}
                {canTrack || canReturn || rateSlug || canCancelLine ? (
                  <View style={styles.itemActions}>
                    {canCancelLine ? (
                      <Pressable
                        style={[styles.smallBtn, styles.cancelBtn]}
                        onPress={() => {
                          setSheetError(null);
                          setCancelItem(item);
                        }}
                      >
                        <Ionicons
                          name="close-circle-outline"
                          size={14}
                          color={colors.price.discount}
                        />
                        <Text style={[styles.smallBtnText, styles.danger]}>Cancel item</Text>
                      </Pressable>
                    ) : null}
                    {rateSlug ? (
                      <Pressable
                        style={[styles.smallBtn, styles.rateBtn]}
                        onPress={() => router.push(`/review/${rateSlug}`)}
                      >
                        <Ionicons name="star" size={14} color="#f5a400" />
                        <Text style={styles.smallBtnText}>Rate product</Text>
                      </Pressable>
                    ) : null}
                    {canTrack ? (
                      <Pressable
                        style={styles.smallBtn}
                        onPress={() => toggleTracking(item.orderItemId)}
                      >
                        <Ionicons name="locate-outline" size={14} color={colors.brand.DEFAULT} />
                        <Text style={styles.smallBtnText}>
                          {track && track !== 'loading' ? 'Hide tracking' : 'Track shipment'}
                        </Text>
                      </Pressable>
                    ) : null}
                    {canReturn ? (
                      <Pressable
                        style={styles.smallBtn}
                        onPress={() => {
                          setSheetError(null);
                          setReturnItem(item.orderItemId);
                        }}
                      >
                        <Ionicons
                          name="return-down-back-outline"
                          size={14}
                          color={colors.brand.DEFAULT}
                        />
                        <Text style={styles.smallBtnText}>Return item</Text>
                      </Pressable>
                    ) : null}
                  </View>
                ) : null}
                {track === 'loading' ? (
                  <ActivityIndicator color={colors.brand.DEFAULT} style={{ marginTop: 6 }} />
                ) : track === 'none' ? (
                  <Text style={styles.trackEmpty}>
                    Tracking details will appear once the courier updates them.
                  </Text>
                ) : track ? (
                  <View style={styles.trackBox}>
                    <Text style={styles.trackHead}>
                      {track.carrier ?? 'Courier'}
                      {track.awbNumber ? ` · AWB ${track.awbNumber}` : ''}
                    </Text>
                    {track.events.length === 0 ? (
                      <Text style={styles.trackEmpty}>No scans yet.</Text>
                    ) : (
                      track.events.map((ev, i) => (
                        <View key={`${ev.occurredAt}-${i}`} style={styles.trackRow}>
                          <View style={[styles.trackDot, i === 0 && styles.trackDotNow]} />
                          <View style={{ flex: 1 }}>
                            <Text style={styles.trackStatus}>{ev.status.replace(/_/g, ' ')}</Text>
                            <Text style={styles.trackMeta}>
                              {ev.location ? `${ev.location} · ` : ''}
                              {new Date(ev.occurredAt).toLocaleString('en-IN')}
                            </Text>
                          </View>
                        </View>
                      ))
                    )}
                  </View>
                ) : null}
              </View>
            );
          })}
        </View>

        <Text style={styles.section}>Price details</Text>
        <View style={styles.card}>
          <View style={styles.row}>
            <Text style={styles.payLabel}>
              Items total ({units} item{units === 1 ? '' : 's'})
            </Text>
            <Text style={styles.payValue}>{formatMoney(order.subtotal)}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.payLabel}>Delivery</Text>
            {Number(order.shippingTotal) > 0 ? (
              <Text style={styles.payValue}>{formatMoney(order.shippingTotal)}</Text>
            ) : (
              <Text style={[styles.payValue, styles.free]}>FREE</Text>
            )}
          </View>
          {order.discountTotal && order.discountTotal !== '0.00' ? (
            <View style={styles.row}>
              <Text style={styles.payLabel}>Coupon {order.couponCode ?? ''}</Text>
              <Text style={[styles.payValue, styles.free]}>
                − {formatMoney(order.discountTotal)}
              </Text>
            </View>
          ) : null}
          <View style={styles.dashed} />
          <View style={styles.row}>
            <Text style={styles.totalLabel}>{pending || cod ? 'Order total' : 'Total paid'}</Text>
            <Text style={styles.totalValue}>{formatMoney(order.grandTotal)}</Text>
          </View>
          {/* v1.17 some lines cancelled: what's left of the order. */}
          {cancelledLines.length > 0 && !cancelled ? (
            <>
              <View style={styles.row}>
                <Text style={styles.payLabel}>
                  Cancelled ({cancelledLines.length} item{cancelledLines.length === 1 ? '' : 's'})
                </Text>
                <Text style={[styles.payValue, styles.danger]}>
                  − {formatMoney(cancelledAmount.toFixed(2) as Money)}
                </Text>
              </View>
              <View style={styles.row}>
                <Text style={styles.totalLabel}>
                  {cod ? 'To pay on delivery' : 'Order value now'}
                </Text>
                <Text style={styles.totalValue}>
                  {formatMoney((Number(order.grandTotal) - cancelledAmount).toFixed(2) as Money)}
                </Text>
              </View>
            </>
          ) : null}
        </View>

        {payment &&
        (payment.walletAmount !== '0.00' ||
          payment.onlineAmount !== '0.00' ||
          payment.refunds.length > 0 ||
          payment.cod) ? (
          <>
            <Text style={styles.section}>Payment</Text>
            <View style={styles.card}>
              {payment.walletAmount !== '0.00' ? (
                <PayRow
                  icon="wallet-outline"
                  label={pending ? 'Reserved from wallet' : 'Paid from wallet'}
                  value={formatMoney(payment.walletAmount)}
                />
              ) : null}
              {payment.cod ? (
                <PayRow
                  icon="cash-outline"
                  label={payment.cod.collected ? 'Paid on delivery (cash)' : 'Cash on Delivery'}
                  sub={payment.cod.collected ? undefined : 'Pay when your order arrives'}
                  value={formatMoney(payment.cod.amount)}
                  warm={!payment.cod.collected}
                />
              ) : null}
              {payment.onlineAmount !== '0.00' ? (
                <PayRow
                  icon="card-outline"
                  label="Paid online"
                  value={formatMoney(payment.onlineAmount)}
                />
              ) : null}
              {payment.refunds.map((r) => (
                <PayRow
                  key={r.refundId}
                  icon="arrow-undo-outline"
                  label={
                    r.method === 'WALLET' ? 'Refunded to wallet' : 'Refunded to original payment'
                  }
                  value={`+ ${formatMoney(r.amount)}`}
                  refund
                />
              ))}
            </View>
          </>
        ) : null}

        <Text style={styles.section}>Delivery address</Text>
        <View style={[styles.card, styles.addrCard]}>
          <View style={styles.addrIcon}>
            <Ionicons name="location" size={18} color={colors.brand.DEFAULT} />
          </View>
          <View style={{ flex: 1, gap: 3 }}>
            {addressLines(order.shippingAddress)
              .filter((line) => !line.startsWith('Phone:'))
              .map((line, i) => (
                <Text key={i} style={i === 0 ? styles.addrName : styles.addrLine}>
                  {line}
                </Text>
              ))}
            <View style={styles.addrPhone}>
              <Ionicons name="call-outline" size={13} color={colors.text.muted} />
              <Text style={styles.addrLine}>{order.shippingAddress.phone}</Text>
            </View>
          </View>
        </View>

        {/* v1.17 billing address: its own card when the invoice goes elsewhere. */}
        <Text style={styles.section}>Billing address</Text>
        {order.billingAddress && order.billingSameAsShipping === false ? (
          <View style={[styles.card, styles.addrCard]}>
            <View style={styles.addrIcon}>
              <Ionicons name="receipt-outline" size={18} color={colors.brand.DEFAULT} />
            </View>
            <View style={{ flex: 1, gap: 3 }}>
              {addressLines(order.billingAddress)
                .filter((line) => !line.startsWith('Phone:'))
                .map((line, i) => (
                  <Text key={i} style={i === 0 ? styles.addrName : styles.addrLine}>
                    {line}
                  </Text>
                ))}
              <View style={styles.addrPhone}>
                <Ionicons name="call-outline" size={13} color={colors.text.muted} />
                <Text style={styles.addrLine}>{order.billingAddress.phone}</Text>
              </View>
            </View>
          </View>
        ) : (
          <View style={[styles.card, styles.addrCard, { alignItems: 'center' }]}>
            <View style={styles.addrIcon}>
              <Ionicons name="receipt-outline" size={18} color={colors.brand.DEFAULT} />
            </View>
            <Text style={[styles.addrLine, { flex: 1 }]}>Same as delivery address</Text>
          </View>
        )}

        <View style={styles.actions}>
          {confirmed ? (
            <Pressable style={styles.actionRow} onPress={openInvoice} disabled={invoiceBusy}>
              <View style={styles.actionIcon}>
                <Ionicons name="document-text-outline" size={18} color={colors.brand.DEFAULT} />
              </View>
              <Text style={styles.actionText}>Download invoice</Text>
              {invoiceBusy ? (
                <ActivityIndicator color={colors.brand.DEFAULT} />
              ) : (
                <Ionicons name="chevron-forward" size={18} color={colors.text.muted} />
              )}
            </Pressable>
          ) : null}
          <Pressable
            style={[styles.actionRow, !canCancel && styles.actionLast]}
            onPress={() =>
              router.push({ pathname: '/help/new', params: { orderId: order.orderId } })
            }
          >
            <View style={styles.actionIcon}>
              <Ionicons name="help-buoy-outline" size={18} color={colors.brand.DEFAULT} />
            </View>
            <Text style={styles.actionText}>Need help with this order?</Text>
            <Ionicons name="chevron-forward" size={18} color={colors.text.muted} />
          </Pressable>
          {canCancel ? (
            <Pressable
              style={[styles.actionRow, styles.actionLast]}
              onPress={() => {
                setSheetError(null);
                setCancelOpen(true);
              }}
            >
              <View style={[styles.actionIcon, styles.actionIconDanger]}>
                <Ionicons name="close-circle-outline" size={18} color={colors.price.discount} />
              </View>
              <Text style={[styles.actionText, styles.danger]}>
                {liveLines > 1 ? 'Cancel entire order' : 'Cancel order'}
              </Text>
              <Ionicons name="chevron-forward" size={18} color={colors.text.muted} />
            </Pressable>
          ) : null}
        </View>
      </ScrollView>

      <ReasonSheet
        visible={cancelOpen}
        title="Cancel order"
        subtitle={
          pending
            ? 'This order is not paid yet, so it will be cancelled right away.'
            : 'Paid orders are cancelled after a quick check. The amount you paid is added to your YouMart Wallet.'
        }
        reasons={CANCEL_REASONS}
        confirmLabel={pending ? 'Cancel order' : 'Request cancellation'}
        busy={busy}
        error={sheetError}
        onClose={() => setCancelOpen(false)}
        onConfirm={submitCancel}
      />
      <ReasonSheet
        visible={cancelItem !== null}
        title="Cancel this item"
        subtitle={
          cancelItem
            ? `${cancelItem.title}\n\n${
                cod
                  ? `You won't pay ${formatMoney(paidForLine(cancelItem))} for it on delivery.`
                  : `Cancelled after a quick check. ${formatMoney(paidForLine(cancelItem))} is added to your YouMart Wallet.`
              } The rest of your order carries on.`
            : ''
        }
        reasons={CANCEL_REASONS}
        confirmLabel={cod ? 'Cancel item' : 'Request cancellation'}
        busy={busy}
        error={sheetError}
        onClose={() => setCancelItem(null)}
        onConfirm={submitCancelItem}
      />
      <ReasonSheet
        visible={returnItem !== null}
        title="Return item"
        subtitle="We'll arrange a pickup. Once the item is checked, the refund is added to your YouMart Wallet."
        reasons={RETURN_REASONS}
        confirmLabel="Request return"
        busy={busy}
        error={sheetError}
        onClose={() => setReturnItem(null)}
        onConfirm={submitReturn}
      />
    </>
  );
}

/** One payment line: an icon chip, the label (and a hint) and the amount. */
function PayRow({
  icon,
  label,
  sub,
  value,
  warm,
  refund,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  sub?: string;
  value: string;
  warm?: boolean;
  refund?: boolean;
}) {
  const fg = refund ? colors.feature.guarantee : warm ? '#92400e' : colors.brand.DEFAULT;
  return (
    <View style={styles.payRow}>
      <View
        style={[
          styles.payIcon,
          { backgroundColor: refund ? '#e8f7ee' : warm ? '#fef3c7' : colors.brandPopup.bg },
        ]}
      >
        <Ionicons name={icon} size={17} color={fg} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[styles.payRowLabel, refund && { color: fg }]}>{label}</Text>
        {sub ? <Text style={styles.payRowSub}>{sub}</Text> : null}
      </View>
      <Text style={[styles.payRowValue, refund && { color: fg }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.page },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.page },
  err: { fontFamily: font.uiSemibold, fontSize: 16, color: colors.text.strong },
  body: {
    paddingHorizontal: space.md,
    paddingTop: space.sm,
    gap: space.sm,
    paddingBottom: space.lg,
  },
  hero: {
    backgroundColor: colors.white,
    borderRadius: 18,
    overflow: 'hidden',
    shadowColor: '#0f172a',
    shadowOpacity: 0.06,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  heroTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: space.md,
    paddingVertical: 10,
  },
  heroIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroTitle: { fontFamily: font.uiBold, fontSize: 16 },
  heroSub: { fontFamily: font.uiMedium, fontSize: 12.5, color: colors.text.body, marginTop: 1 },
  heroMeta: {
    flexDirection: 'row',
    gap: space.md,
    paddingHorizontal: space.md,
    paddingTop: space.sm,
  },
  metaLabel: {
    fontFamily: font.uiMedium,
    fontSize: 10.5,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    color: colors.text.muted,
  },
  metaValue: { fontFamily: font.uiBold, fontSize: 13, color: colors.text.strong, marginTop: 2 },
  tracker: {
    flexDirection: 'row',
    paddingHorizontal: space.xs,
    paddingTop: space.md,
    paddingBottom: space.md,
  },
  step: { flex: 1, alignItems: 'center', gap: 4 },
  stepRail: { flexDirection: 'row', alignItems: 'center', alignSelf: 'stretch' },
  rail: { flex: 1, height: 3, backgroundColor: colors.steps.idle },
  railDone: { backgroundColor: colors.feature.guarantee },
  railHidden: { opacity: 0 },
  dot: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: colors.steps.idle,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dotDone: { backgroundColor: colors.feature.guarantee },
  stepLabel: { fontFamily: font.ui, fontSize: 11, color: colors.text.muted },
  stepLabelDone: { color: colors.text.strong, fontFamily: font.uiSemibold },
  notice: {
    flexDirection: 'row',
    gap: 8,
    backgroundColor: '#e7f6ee',
    borderRadius: radii.tile,
    padding: space.md,
  },
  noticeText: { flex: 1, fontFamily: font.uiMedium, fontSize: 13, color: colors.text.strong },
  infoBox: {
    flexDirection: 'row',
    gap: 8,
    backgroundColor: colors.brandPopup.bg,
    borderRadius: radii.tile,
    padding: space.md,
  },
  infoText: {
    flex: 1,
    fontFamily: font.body,
    fontSize: 13,
    lineHeight: 19,
    color: colors.text.body,
  },
  payBox: {
    backgroundColor: colors.white,
    borderRadius: radii.tile,
    borderWidth: 1.5,
    borderColor: colors.brand.DEFAULT,
    padding: space.md,
    gap: space.sm,
  },
  payBoxText: { fontFamily: font.body, fontSize: 13, color: colors.text.body },
  primaryBtn: {
    backgroundColor: colors.brand.DEFAULT,
    borderRadius: radii.button,
    paddingVertical: 12,
    alignItems: 'center',
  },
  primaryText: { fontFamily: font.uiSemibold, fontSize: 15, color: colors.white },
  section: { fontFamily: font.uiBold, fontSize: 14.5, color: colors.heading, marginTop: space.xs },
  sectionCount: { fontFamily: font.uiMedium, color: colors.text.muted },
  card: {
    backgroundColor: colors.white,
    borderRadius: 14,
    padding: space.md,
    gap: 6,
    shadowColor: '#0f172a',
    shadowOpacity: 0.05,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  itemBlock: { gap: space.sm },
  itemCancelled: { opacity: 0.55 },
  struck: { textDecorationLine: 'line-through' },
  cancelBtn: { borderColor: colors.price.discount },
  lineNote: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginLeft: 68,
    backgroundColor: colors.brandPopup.bg,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 5,
  },
  lineNoteWarn: { backgroundColor: '#fef3c7' },
  lineNoteText: { flex: 1, fontFamily: font.uiMedium, fontSize: 11.5, color: colors.brand.DEFAULT },
  itemDivider: { borderTopWidth: 1, borderTopColor: colors.cart.line, paddingTop: space.sm },
  item: { flexDirection: 'row', gap: 10 },
  thumb: {
    width: 58,
    height: 58,
    borderRadius: 12,
    backgroundColor: '#f6f8fb',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  thumbImg: { width: '88%', height: '88%' },
  itemBody: { flex: 1, gap: 2 },
  itemTitle: { fontFamily: font.uiMedium, fontSize: 13.5, lineHeight: 19, color: colors.heading },
  itemMeta: { fontFamily: font.uiMedium, fontSize: 12, color: colors.text.muted },
  itemFoot: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    marginTop: 2,
  },
  linePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  linePillDot: { width: 6, height: 6, borderRadius: 3 },
  linePillText: { fontFamily: font.uiBold, fontSize: 11 },
  itemPrice: { fontFamily: font.uiBold, fontSize: 15, color: colors.heading },
  itemActions: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, marginLeft: 68 },
  smallBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderWidth: 1,
    borderColor: colors.brand.DEFAULT,
    borderRadius: radii.tile,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  smallBtnText: { fontFamily: font.uiSemibold, fontSize: 12.5, color: colors.brand.DEFAULT },
  returnPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    alignSelf: 'flex-start',
    marginLeft: 68,
    backgroundColor: colors.brandPopup.bg,
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  returnPillText: { fontFamily: font.uiSemibold, fontSize: 12, color: colors.brand.DEFAULT },
  trackBox: {
    backgroundColor: colors.page,
    borderRadius: radii.button,
    padding: space.md,
    gap: 8,
  },
  trackHead: { fontFamily: font.uiSemibold, fontSize: 12.5, color: colors.text.strong },
  trackRow: { flexDirection: 'row', gap: 10 },
  trackDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.card.border,
    marginTop: 4,
  },
  trackDotNow: { backgroundColor: colors.feature.guarantee },
  trackStatus: {
    fontFamily: font.uiSemibold,
    fontSize: 12.5,
    color: colors.text.strong,
    textTransform: 'capitalize',
  },
  trackMeta: { fontFamily: font.body, fontSize: 11.5, color: colors.text.muted },
  trackEmpty: { fontFamily: font.body, fontSize: 12, color: colors.text.muted },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12 },
  dashed: {
    borderTopWidth: 1,
    borderStyle: 'dashed',
    borderColor: '#d5dce7',
    marginVertical: 2,
  },
  totalLabel: { fontFamily: font.uiBold, fontSize: 15, color: colors.text.strong },
  totalValue: { fontFamily: font.uiBold, fontSize: 17, color: colors.brand.DEFAULT },
  rateBtn: { borderColor: '#f5c451' },
  payLabel: { fontFamily: font.body, fontSize: 13.5, color: colors.text.body },
  payValue: { fontFamily: font.uiSemibold, fontSize: 13.5, color: colors.text.strong },
  free: { color: colors.feature.guarantee, fontFamily: font.uiBold },
  payRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 1 },
  payIcon: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  payRowLabel: { fontFamily: font.uiSemibold, fontSize: 13.5, color: colors.text.strong },
  payRowSub: { fontFamily: font.uiMedium, fontSize: 11.5, color: colors.text.muted, marginTop: 1 },
  payRowValue: { fontFamily: font.uiBold, fontSize: 14, color: colors.text.strong },
  addrCard: { flexDirection: 'row', gap: 10 },
  addrIcon: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: colors.brandPopup.bg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addrName: { fontFamily: font.uiBold, fontSize: 14.5, color: colors.text.strong },
  addrLine: { fontFamily: font.body, fontSize: 12.5, lineHeight: 17, color: colors.text.body },
  addrPhone: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 },
  actions: {
    backgroundColor: colors.white,
    borderRadius: 14,
    marginTop: space.xs,
    overflow: 'hidden',
    shadowColor: '#0f172a',
    shadowOpacity: 0.05,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: space.md,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.cart.line,
  },
  actionLast: { borderBottomWidth: 0 },
  actionIcon: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: colors.brandPopup.bg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionIconDanger: { backgroundColor: '#fdecec' },
  actionText: { flex: 1, fontFamily: font.uiSemibold, fontSize: 13.5, color: colors.text.strong },
  danger: { color: colors.price.discount },
});
