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
  const [returnItem, setReturnItem] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [sheetError, setSheetError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [invoiceBusy, setInvoiceBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const o = await api.orders.get(orderId);
      setOrder(o);
      const [p, r] = await Promise.all([
        api.payments.orderSummary(o.orderId).catch(() => null),
        api.returns.list({ limit: 50 }).catch(() => null),
      ]);
      setPayment(p);
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
        <View style={styles.head}>
          <Text style={styles.orderNo}>#{order.orderNumber}</Text>
          <Text style={styles.status}>{orderStatusLabel(order)}</Text>
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

        {!cancelled ? (
          <View style={styles.tracker}>
            {TRACKING_STEPS.map((label, i) => (
              <View key={label} style={styles.step}>
                <View style={[styles.dot, i <= step && styles.dotDone]}>
                  {i <= step ? <Ionicons name="checkmark" size={12} color={colors.white} /> : null}
                </View>
                <Text style={[styles.stepLabel, i <= step && styles.stepLabelDone]}>{label}</Text>
              </View>
            ))}
          </View>
        ) : null}

        <Text style={styles.section}>Items</Text>
        <View style={styles.card}>
          {order.items.map((item, idx) => {
            const ret = returnFor(item.orderItemId);
            const track = tracking[item.orderItemId];
            const canReturn =
              item.sellerStatus === 'DELIVERED' && (!ret || ret.status === 'REJECTED');
            const canTrack = item.sellerStatus === 'SHIPPED' || item.sellerStatus === 'DELIVERED';
            return (
              <View
                key={item.orderItemId}
                style={[styles.itemBlock, idx > 0 && styles.itemDivider]}
              >
                <View style={styles.item}>
                  <Text numberOfLines={2} style={styles.itemTitle}>
                    {item.quantity} × {item.title}
                  </Text>
                  <Text style={styles.itemPrice}>{formatMoney(item.lineTotal)}</Text>
                </View>
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
                {canTrack || canReturn ? (
                  <View style={styles.itemActions}>
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
          <View style={styles.divider} />
          <View style={styles.item}>
            <Text style={styles.totalLabel}>{pending ? 'Total' : 'Total paid'}</Text>
            <Text style={styles.totalValue}>{formatMoney(order.grandTotal)}</Text>
          </View>
        </View>

        {payment && (payment.walletAmount !== '0.00' || payment.refunds.length > 0) ? (
          <>
            <Text style={styles.section}>Payment</Text>
            <View style={styles.card}>
              {payment.walletAmount !== '0.00' ? (
                <View style={styles.item}>
                  <Text style={styles.payLabel}>
                    {pending ? 'Reserved from wallet' : 'Paid from wallet'}
                  </Text>
                  <Text style={styles.payValue}>{formatMoney(payment.walletAmount)}</Text>
                </View>
              ) : null}
              {payment.onlineAmount !== '0.00' ? (
                <View style={styles.item}>
                  <Text style={styles.payLabel}>Paid online</Text>
                  <Text style={styles.payValue}>{formatMoney(payment.onlineAmount)}</Text>
                </View>
              ) : null}
              {payment.refunds.map((r) => (
                <View key={r.refundId} style={styles.item}>
                  <Text style={styles.refundLabel}>
                    {r.method === 'WALLET' ? 'Refunded to wallet' : 'Refunded to original payment'}
                  </Text>
                  <Text style={styles.refundValue}>+ {formatMoney(r.amount)}</Text>
                </View>
              ))}
            </View>
          </>
        ) : null}

        <Text style={styles.section}>Delivery address</Text>
        <View style={styles.card}>
          {addressLines(order.shippingAddress).map((line, i) => (
            <Text key={i} style={i === 0 ? styles.addrName : styles.addrLine}>
              {line}
            </Text>
          ))}
        </View>

        <View style={styles.actions}>
          {confirmed ? (
            <Pressable style={styles.actionRow} onPress={openInvoice} disabled={invoiceBusy}>
              <Ionicons name="document-text-outline" size={20} color={colors.brand.DEFAULT} />
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
            <Ionicons name="help-buoy-outline" size={20} color={colors.brand.DEFAULT} />
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
              <Ionicons name="close-circle-outline" size={20} color={colors.price.discount} />
              <Text style={[styles.actionText, styles.danger]}>Cancel order</Text>
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

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.page },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.page },
  err: { fontFamily: font.uiSemibold, fontSize: 16, color: colors.text.strong },
  body: { padding: space.lg, gap: space.md, paddingBottom: space.xxl },
  head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  orderNo: { fontFamily: font.uiBold, fontSize: 18, color: colors.heading },
  status: { fontFamily: font.uiSemibold, fontSize: 13, color: colors.brand.DEFAULT },
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
  tracker: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: colors.white,
    borderRadius: radii.tile,
    borderWidth: 1,
    borderColor: colors.card.border,
    padding: space.lg,
  },
  step: { alignItems: 'center', gap: 6, flex: 1 },
  dot: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.steps.idle,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dotDone: { backgroundColor: colors.feature.guarantee },
  stepLabel: { fontFamily: font.ui, fontSize: 11, color: colors.text.muted, textAlign: 'center' },
  stepLabelDone: { color: colors.text.strong, fontFamily: font.uiSemibold },
  section: { fontFamily: font.uiBold, fontSize: 15, color: colors.heading, marginTop: space.sm },
  card: {
    backgroundColor: colors.white,
    borderRadius: radii.tile,
    borderWidth: 1,
    borderColor: colors.card.border,
    padding: space.lg,
    gap: space.sm,
  },
  itemBlock: { gap: 8 },
  itemDivider: { borderTopWidth: 1, borderTopColor: colors.cart.line, paddingTop: space.sm },
  item: { flexDirection: 'row', justifyContent: 'space-between', gap: space.md },
  itemTitle: { flex: 1, fontFamily: font.body, fontSize: 13.5, color: colors.text.body },
  itemPrice: { fontFamily: font.uiSemibold, fontSize: 13.5, color: colors.text.strong },
  itemActions: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  smallBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderWidth: 1,
    borderColor: colors.brand.DEFAULT,
    borderRadius: radii.pill,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  smallBtnText: { fontFamily: font.uiSemibold, fontSize: 12.5, color: colors.brand.DEFAULT },
  returnPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    alignSelf: 'flex-start',
    backgroundColor: colors.brandPopup.bg,
    borderRadius: radii.pill,
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
  divider: { height: 1, backgroundColor: colors.cart.line },
  totalLabel: { fontFamily: font.uiBold, fontSize: 14, color: colors.text.strong },
  totalValue: { fontFamily: font.uiBold, fontSize: 15, color: colors.brand.DEFAULT },
  payLabel: { fontFamily: font.body, fontSize: 13.5, color: colors.text.body },
  payValue: { fontFamily: font.uiSemibold, fontSize: 13.5, color: colors.text.strong },
  refundLabel: { fontFamily: font.uiMedium, fontSize: 13.5, color: colors.feature.guarantee },
  refundValue: { fontFamily: font.uiBold, fontSize: 13.5, color: colors.feature.guarantee },
  addrName: { fontFamily: font.uiSemibold, fontSize: 14, color: colors.text.strong },
  addrLine: { fontFamily: font.body, fontSize: 13, color: colors.text.body },
  actions: {
    backgroundColor: colors.white,
    borderRadius: radii.tile,
    borderWidth: 1,
    borderColor: colors.card.border,
    marginTop: space.sm,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingHorizontal: space.lg,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.cart.line,
  },
  actionLast: { borderBottomWidth: 0 },
  actionText: { flex: 1, fontFamily: font.uiSemibold, fontSize: 14.5, color: colors.text.strong },
  danger: { color: colors.price.discount },
});
