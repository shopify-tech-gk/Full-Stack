import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  ApiError,
  formatMoney,
  orderListStatusLabel,
  orderStatusLabel,
  type HelpTicket,
  type HelpTopic,
  type Money,
} from '@youmart/shared-client';
import { api } from '@/lib/api';
import { colors, font, radii, space } from '@/theme';

const TOPICS: { topic: HelpTopic; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { topic: 'ORDER_STATUS', label: 'Where is my order?', icon: 'cube-outline' },
  { topic: 'CANCELLATION', label: 'Cancel my order', icon: 'close-circle-outline' },
  { topic: 'RETURN_REFUND', label: 'Return / refund', icon: 'return-down-back-outline' },
  { topic: 'DAMAGED_WRONG_ITEM', label: 'Damaged or wrong item', icon: 'alert-circle-outline' },
  { topic: 'PAYMENT_WALLET', label: 'Payment / wallet', icon: 'wallet-outline' },
  { topic: 'ACCOUNT', label: 'My account', icon: 'person-outline' },
  { topic: 'OTHER', label: 'Something else', icon: 'ellipsis-horizontal-circle-outline' },
];

/** One order as the help screen shows it (from the order page or from the orders list). */
type HelpOrder = {
  orderId: string;
  orderNumber: string;
  status: string;
  total: Money;
  createdAt: string;
  titles: string[];
  productIds: string[];
  lines: { key: string; productId: string; title: string; quantity: number }[];
};

/** A cancelled item needs no help, so it isn't shown - unless the whole order was cancelled. */
function liveLines<T extends { sellerStatus: string }>(lines: readonly T[]): readonly T[] {
  const live = lines.filter((l) => l.sellerStatus !== 'CANCELLED');
  return live.length > 0 ? live : lines;
}

/** The order total less its cancelled lines (a fully cancelled order keeps its original total). */
function leftAfterCancels(total: Money, lines: { status: string; paid: number }[]): Money {
  if (lines.every((l) => l.status === 'CANCELLED')) return total;
  const off = lines.filter((l) => l.status === 'CANCELLED').reduce((n, l) => n + l.paid, 0);
  return (Number(total) - off).toFixed(2) as Money;
}

const shortDate = (iso: string) =>
  new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });

/** A photo per product (up to three), overlapping - the customer recognises the order by them. */
function OrderThumbs({ order, images }: { order: HelpOrder; images: Record<string, string> }) {
  const shown = order.productIds.slice(0, 3);
  return (
    <View style={styles.thumbs}>
      {shown.map((id, i) => (
        <View key={id} style={[styles.thumb, i > 0 && styles.thumbOverlap]}>
          {images[id] ? (
            <Image source={{ uri: images[id] }} style={styles.thumbImg} contentFit="contain" />
          ) : (
            <Ionicons name="cube-outline" size={18} color={colors.text.muted} />
          )}
        </View>
      ))}
    </View>
  );
}

function OrderText({ order }: { order: HelpOrder }) {
  const more = order.titles.length - 1;
  return (
    <View style={{ flex: 1, gap: 1 }}>
      <Text style={styles.orderTitle} numberOfLines={1}>
        {order.titles[0] ?? `Order #${order.orderNumber}`}
      </Text>
      {more > 0 ? (
        <Text style={styles.orderMore}>
          + {more} more item{more === 1 ? '' : 's'}
        </Text>
      ) : null}
      <Text style={styles.orderMeta} numberOfLines={1}>
        #{order.orderNumber}
      </Text>
      <Text style={styles.orderMeta} numberOfLines={1}>
        {order.status} · {formatMoney(order.total)} · {shortDate(order.createdAt)}
      </Text>
    </View>
  );
}

/**
 * W9: "Need help with this order?" - from an order page only THAT order is shown (with "View all
 * orders" to pick another); from Help the customer chooses one. Then the topic and the details.
 */
export default function NewHelpRequestScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ orderId?: string }>();
  const openedFor = params.orderId ? String(params.orderId) : null;
  const [orderId, setOrderId] = useState<string | null>(openedFor);
  // The order this request is about; the full list only opens on "View all orders".
  const [selected, setSelected] = useState<HelpOrder | null>(null);
  const [showAll, setShowAll] = useState(!openedFor);
  const [orders, setOrders] = useState<HelpOrder[] | null>(null);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [images, setImages] = useState<Record<string, string>>({});
  const [slugs, setSlugs] = useState<Record<string, string>>({});
  // The pinned card opens to show the order's products (each opens its product page).
  const [expanded, setExpanded] = useState(false);
  const [topic, setTopic] = useState<HelpTopic | null>(null);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState<HelpTicket | null>(null);

  const loadImages = (list: HelpOrder[]) => {
    const ids = [...new Set(list.flatMap((o) => o.productIds))].slice(0, 50);
    if (ids.length === 0) return;
    api.catalog
      .productCards(ids)
      .then(({ items }) => {
        setImages((cur) => ({
          ...cur,
          ...Object.fromEntries(items.flatMap((c) => (c.imageUrl ? [[c.id, c.imageUrl]] : []))),
        }));
        setSlugs((cur) => ({ ...cur, ...Object.fromEntries(items.map((c) => [c.id, c.slug])) }));
      })
      .catch(() => undefined);
  };

  const loadOrders = async (after?: string) => {
    const page = await api.orders.list({ limit: 10, ...(after ? { cursor: after } : {}) });
    const next: HelpOrder[] = page.items.map((o) => {
      const shown = liveLines(o.lines ?? []);
      return {
        orderId: o.orderId,
        orderNumber: o.orderNumber,
        status: orderListStatusLabel(o),
        total: leftAfterCancels(
          o.grandTotal,
          (o.lines ?? []).map((l) => ({ status: l.sellerStatus, paid: Number(l.paid ?? 0) })),
        ),
        createdAt: o.createdAt,
        titles: shown.map((l) => l.title),
        productIds: [...new Set(shown.map((l) => l.productId))],
        lines: shown.map((l) => ({
          key: l.orderItemId,
          productId: l.productId,
          title: l.title,
          quantity: l.quantity,
        })),
      };
    });
    setOrders((cur) => (after && cur ? [...cur, ...next] : next));
    setCursor(page.nextCursor);
    loadImages(next);
  };

  // Opened from an order: just that order. The list is only fetched when it's asked for.
  useEffect(() => {
    if (!openedFor) return;
    api.orders
      .get(openedFor)
      .then((o) => {
        const shown = liveLines(o.items);
        const one: HelpOrder = {
          orderId: o.orderId,
          orderNumber: o.orderNumber,
          status: orderStatusLabel(o),
          total: leftAfterCancels(
            o.grandTotal,
            o.items.map((i) => ({
              status: i.sellerStatus,
              paid: Number(i.lineTotal) - Number(i.discount ?? 0),
            })),
          ),
          createdAt: o.createdAt,
          titles: shown.map((i) => i.title),
          productIds: [...new Set(shown.map((i) => i.productId))],
          lines: shown.map((i) => ({
            key: i.orderItemId,
            productId: i.productId,
            title: i.title,
            quantity: i.quantity,
          })),
        };
        setSelected(one);
        loadImages([one]);
      })
      .catch(() => {
        setOrderId(null);
        setShowAll(true);
      });
  }, [openedFor]);

  useEffect(() => {
    if (showAll && !orders) loadOrders().catch(() => setOrders([]));
    // The first time the list opens.
  }, [showAll]);

  const pick = (order: HelpOrder | null) => {
    setOrderId(order?.orderId ?? null);
    setSelected(order);
    setShowAll(false);
    setExpanded(false);
  };

  const submit = async () => {
    if (!topic) {
      setError('Please choose what you need help with.');
      return;
    }
    if (message.trim().length < 10) {
      setError('Please describe the issue in a few words (at least 10 characters).');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const ticket = await api.support.createTicket({
        topic,
        message: message.trim(),
        ...(orderId ? { orderId } : {}),
      });
      setSent(ticket);
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : 'Could not send your request. Please try again.',
      );
    } finally {
      setBusy(false);
    }
  };

  if (sent) {
    return (
      <View style={styles.center}>
        <Ionicons name="checkmark-circle" size={64} color={colors.feature.guarantee} />
        <Text style={styles.doneTitle}>Request sent</Text>
        <Text style={styles.doneText}>
          Your reference is <Text style={styles.ref}>{sent.reference}</Text>. Our team will get back
          to you on your registered phone or email.
        </Text>
        <Pressable style={styles.btn} onPress={() => router.replace('/help')}>
          <Text style={styles.btnText}>View my requests</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        {!showAll ? (
          <>
            <Text style={styles.section}>
              {orderId ? 'Getting help for this order' : 'Your request'}
            </Text>
            <View style={styles.pinned}>
              {orderId && !selected ? (
                <ActivityIndicator color={colors.brand.DEFAULT} />
              ) : selected ? (
                <>
                  <Pressable
                    style={styles.orderRow}
                    onPress={() => setExpanded((v) => !v)}
                    accessibilityRole="button"
                    accessibilityState={{ expanded }}
                  >
                    <OrderThumbs order={selected} images={images} />
                    <OrderText order={selected} />
                    <Ionicons
                      name={expanded ? 'chevron-up' : 'chevron-down'}
                      size={20}
                      color={colors.brand.DEFAULT}
                    />
                  </Pressable>
                  {expanded ? (
                    <View style={styles.lines}>
                      {selected.lines.map((l) => {
                        const slug = slugs[l.productId];
                        return (
                          <Pressable
                            key={l.key}
                            style={styles.line}
                            disabled={!slug}
                            onPress={() => router.push(`/product/${slug}`)}
                          >
                            <View style={styles.thumb}>
                              {images[l.productId] ? (
                                <Image
                                  source={{ uri: images[l.productId] }}
                                  style={styles.thumbImg}
                                  contentFit="contain"
                                />
                              ) : (
                                <Ionicons name="cube-outline" size={18} color={colors.text.muted} />
                              )}
                            </View>
                            <View style={{ flex: 1 }}>
                              <Text style={styles.lineTitle} numberOfLines={2}>
                                {l.title}
                              </Text>
                              <Text style={styles.orderMeta}>Qty {l.quantity}</Text>
                            </View>
                            {slug ? (
                              <Ionicons
                                name="chevron-forward"
                                size={16}
                                color={colors.text.muted}
                              />
                            ) : null}
                          </Pressable>
                        );
                      })}
                      <Pressable
                        style={styles.detailsLink}
                        onPress={() => router.push(`/orders/${selected.orderId}`)}
                      >
                        <Text style={styles.viewAllText}>View order details</Text>
                      </Pressable>
                    </View>
                  ) : null}
                </>
              ) : (
                <View style={styles.orderRow}>
                  <View style={styles.generalIcon}>
                    <Ionicons name="chatbubbles-outline" size={18} color={colors.brand.DEFAULT} />
                  </View>
                  <Text style={[styles.orderTitle, { flex: 1 }]}>Not about a specific order</Text>
                </View>
              )}
              <Pressable style={styles.viewAll} onPress={() => setShowAll(true)} hitSlop={6}>
                <Ionicons name="list-outline" size={15} color={colors.brand.DEFAULT} />
                <Text style={styles.viewAllText}>
                  {orderId ? 'Issue with a different order? View all orders' : 'View all orders'}
                </Text>
                <Ionicons name="chevron-forward" size={15} color={colors.brand.DEFAULT} />
              </Pressable>
            </View>
          </>
        ) : (
          <>
            <View style={styles.listHead}>
              <Text style={[styles.section, { flex: 1 }]}>Which order is this about?</Text>
              {openedFor || selected ? (
                <Pressable onPress={() => setShowAll(false)} hitSlop={8}>
                  <Text style={styles.hide}>Hide</Text>
                </Pressable>
              ) : null}
            </View>
            {!orders ? (
              <ActivityIndicator color={colors.brand.DEFAULT} />
            ) : (
              <View style={styles.orderList}>
                {orders.map((o) => {
                  const on = o.orderId === orderId;
                  return (
                    <Pressable
                      key={o.orderId}
                      style={[styles.order, on && styles.selected]}
                      onPress={() => pick(o)}
                    >
                      <OrderThumbs order={o} images={images} />
                      <OrderText order={o} />
                      {on ? (
                        <Ionicons name="checkmark-circle" size={20} color={colors.brand.DEFAULT} />
                      ) : null}
                    </Pressable>
                  );
                })}
                {cursor ? (
                  <Pressable
                    style={styles.more}
                    disabled={loadingMore}
                    onPress={() => {
                      setLoadingMore(true);
                      loadOrders(cursor)
                        .catch(() => undefined)
                        .finally(() => setLoadingMore(false));
                    }}
                  >
                    {loadingMore ? (
                      <ActivityIndicator color={colors.brand.DEFAULT} />
                    ) : (
                      <Text style={styles.viewAllText}>Show more orders</Text>
                    )}
                  </Pressable>
                ) : null}
                <Pressable
                  style={[styles.order, orderId === null && styles.selected]}
                  onPress={() => pick(null)}
                >
                  <View style={styles.generalIcon}>
                    <Ionicons name="chatbubbles-outline" size={18} color={colors.brand.DEFAULT} />
                  </View>
                  <Text style={[styles.orderTitle, { flex: 1 }]}>Not about a specific order</Text>
                </Pressable>
              </View>
            )}
          </>
        )}

        <Text style={styles.section}>What do you need help with?</Text>
        <View style={styles.topics}>
          {TOPICS.map((t) => {
            const on = t.topic === topic;
            return (
              <Pressable
                key={t.topic}
                style={[styles.topic, on && styles.selected]}
                onPress={() => setTopic(t.topic)}
              >
                <Ionicons
                  name={t.icon}
                  size={18}
                  color={on ? colors.brand.DEFAULT : colors.text.body}
                />
                <Text style={[styles.topicText, on && styles.topicTextOn]}>{t.label}</Text>
              </Pressable>
            );
          })}
        </View>

        <Text style={styles.section}>Tell us more</Text>
        <TextInput
          value={message}
          onChangeText={(v) => {
            setMessage(v);
            setError(null);
          }}
          placeholder="Describe the issue - what happened and what you'd like us to do"
          placeholderTextColor={colors.text.placeholder}
          multiline
          maxLength={2000}
          style={styles.input}
        />
        {error ? <Text style={styles.error}>{error}</Text> : null}

        <Pressable
          style={[styles.btnWide, busy && styles.disabled]}
          onPress={submit}
          disabled={busy}
        >
          {busy ? (
            <ActivityIndicator color={colors.white} />
          ) : (
            <Text style={styles.btnText}>Send request</Text>
          )}
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.page },
  body: {
    paddingHorizontal: space.md,
    paddingTop: space.xs,
    gap: space.sm,
    paddingBottom: space.xl,
  },
  center: {
    flex: 1,
    backgroundColor: colors.page,
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.md,
    padding: space.xl,
  },
  doneTitle: { fontFamily: font.uiBold, fontSize: 20, color: colors.text.strong },
  doneText: {
    fontFamily: font.body,
    fontSize: 14,
    lineHeight: 21,
    color: colors.text.body,
    textAlign: 'center',
  },
  ref: { fontFamily: font.uiBold, color: colors.brand.DEFAULT },
  section: { fontFamily: font.uiBold, fontSize: 15, color: colors.heading, marginTop: space.md },
  listHead: { flexDirection: 'row', alignItems: 'flex-end', gap: space.sm },
  hide: { fontFamily: font.uiSemibold, fontSize: 13, color: colors.brand.DEFAULT },
  orderList: { gap: 6 },
  order: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: colors.white,
    borderRadius: radii.tile,
    borderWidth: 1,
    borderColor: colors.card.border,
    padding: 10,
  },
  pinned: {
    backgroundColor: colors.white,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: colors.brand.DEFAULT,
    padding: space.md,
    gap: 10,
  },
  orderRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  lines: { gap: space.sm },
  line: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  lineTitle: { fontFamily: font.uiMedium, fontSize: 13, lineHeight: 18, color: colors.text.strong },
  detailsLink: { alignSelf: 'flex-start', paddingVertical: 2 },
  viewAll: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.card.border,
  },
  viewAllText: {
    flexShrink: 1,
    fontFamily: font.uiSemibold,
    fontSize: 13,
    color: colors.brand.DEFAULT,
  },
  more: { alignItems: 'center', paddingVertical: 10 },
  thumbs: { flexDirection: 'row' },
  thumb: {
    width: 46,
    height: 46,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.card.border,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  thumbOverlap: { marginLeft: -24 },
  thumbImg: { width: '90%', height: '90%' },
  generalIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.brandPopup.bg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  orderTitle: { fontFamily: font.uiSemibold, fontSize: 13.5, color: colors.text.strong },
  orderMore: { fontFamily: font.uiMedium, fontSize: 12, color: colors.brand.DEFAULT },
  selected: { borderColor: colors.brand.DEFAULT, backgroundColor: colors.brandPopup.bg },
  orderMeta: { fontFamily: font.body, fontSize: 12, color: colors.text.muted },
  topics: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  topic: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.white,
    borderRadius: radii.tile,
    borderWidth: 1,
    borderColor: colors.card.border,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  topicText: { fontFamily: font.uiMedium, fontSize: 13, color: colors.text.body },
  topicTextOn: { color: colors.brand.DEFAULT, fontFamily: font.uiSemibold },
  input: {
    minHeight: 110,
    borderWidth: 1,
    borderColor: colors.card.border,
    borderRadius: radii.button,
    backgroundColor: colors.white,
    padding: space.md,
    fontFamily: font.body,
    fontSize: 14,
    color: colors.text.input,
    textAlignVertical: 'top',
  },
  error: { fontFamily: font.uiMedium, fontSize: 13, color: colors.price.discount },
  btn: {
    backgroundColor: colors.brand.DEFAULT,
    borderRadius: radii.button,
    paddingHorizontal: 28,
    paddingVertical: 12,
  },
  btnWide: {
    marginTop: space.md,
    backgroundColor: colors.brand.DEFAULT,
    borderRadius: radii.button,
    height: 50,
    alignItems: 'center',
    justifyContent: 'center',
  },
  disabled: { opacity: 0.6 },
  btnText: { fontFamily: font.uiSemibold, fontSize: 15, color: colors.white },
});
