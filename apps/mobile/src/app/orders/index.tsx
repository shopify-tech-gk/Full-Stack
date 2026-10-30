import { useCallback, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  SectionList,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import {
  formatMoney,
  orderListStatusLabel,
  TRACKING_STEPS,
  type OrderListItem,
  type Money,
  type OrderListLine,
  type SellerItemStatus,
} from '@youmart/shared-client';
import { api } from '@/lib/api';
import { colors, font, radii, space } from '@/theme';

// v1.17 My Orders: each order as a compact card - a coloured status line with its date, the order
// page's Order placed -> Packed -> Shipped -> Delivered tracker, its products (photo, title, qty)
// and quick actions - rate a delivered product, buy it again; tap the card to track / view it.
// Search by product / order number, filter chips with counts, and orders grouped by month.

const BRAND = colors.brand.DEFAULT;
const PREVIEW_LINES = 1;
const CARD_BATCH = 50; // catalog product-cards takes up to 50 ids per call

type Filter = 'all' | 'active' | 'delivered' | 'cancelled' | 'returned';
const FILTERS: { key: Filter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'active', label: 'On the way' },
  { key: 'delivered', label: 'Delivered' },
  { key: 'cancelled', label: 'Cancelled' },
  { key: 'returned', label: 'Returned' },
];

type Tone = { fg: string; bg: string; icon: keyof typeof Ionicons.glyphMap };
const TONES: Record<'green' | 'blue' | 'violet' | 'orange' | 'red' | 'grey', Tone> = {
  green: { fg: '#15803d', bg: '#e8f7ee', icon: 'checkmark-circle' },
  blue: { fg: '#1d4ed8', bg: '#e9f0ff', icon: 'cube' },
  violet: { fg: '#6d28d9', bg: '#f1ebff', icon: 'car' },
  orange: { fg: '#c2410c', bg: '#fff1e6', icon: 'time' },
  red: { fg: '#b91c1c', bg: '#fdecec', icon: 'close-circle' },
  grey: { fg: '#475569', bg: '#eef1f5', icon: 'return-down-back' },
};

/** Order placed -> Packed -> Shipped -> Delivered (same steps as the order page). */
const STEP: Record<SellerItemStatus, number> = {
  PENDING: 0,
  CONFIRMED: 0,
  PACKED: 1,
  SHIPPED: 2,
  DELIVERED: 3,
  CANCELLED: -1,
  RETURNED: -1,
};

const day = (iso: string) =>
  new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short' }).format(new Date(iso));
const fullDate = (iso: string) =>
  new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }).format(
    new Date(iso),
  );
const monthKey = (iso: string) =>
  new Intl.DateTimeFormat('en-IN', { month: 'long', year: 'numeric' }).format(new Date(iso));

const lines = (o: OrderListItem): OrderListLine[] => o.lines ?? [];
/** What a card lists: cancelled lines drop off, unless the whole order was cancelled. */
const shownLines = (o: OrderListItem): OrderListLine[] => {
  const live = lines(o).filter((l) => l.sellerStatus !== 'CANCELLED');
  return live.length > 0 ? live : lines(o);
};
const latest = (ls: OrderListLine[], s: SellerItemStatus) =>
  ls
    .filter((l) => l.sellerStatus === s)
    .map((l) => l.updatedAt)
    .sort()
    .pop();

function bucket(o: OrderListItem): Exclude<Filter, 'all'> {
  if (o.status === 'CANCELLED') return 'cancelled';
  const ls = lines(o);
  if (ls.length > 0 && ls.every((l) => l.sellerStatus === 'CANCELLED')) return 'cancelled';
  if (ls.some((l) => l.sellerStatus === 'RETURNED')) return 'returned';
  if (ls.length > 0 && ls.every((l) => ['DELIVERED', 'CANCELLED'].includes(l.sellerStatus)))
    return 'delivered';
  return 'active';
}

/** The order's headline: what happened last, with its date. */
function headline(o: OrderListItem): { text: string; sub: string | null; tone: Tone } {
  const ls = lines(o);
  const b = bucket(o);
  if (o.status === 'PENDING_PAYMENT')
    return { text: 'Payment pending', sub: 'Complete payment to confirm', tone: TONES.orange };
  if (b === 'cancelled') {
    const at = latest(ls, 'CANCELLED') ?? o.updatedAt;
    return { text: at ? `Cancelled on ${day(at)}` : 'Cancelled', sub: null, tone: TONES.red };
  }
  if (b === 'returned') {
    const at = latest(ls, 'RETURNED');
    return { text: at ? `Returned on ${day(at)}` : 'Returned', sub: null, tone: TONES.grey };
  }
  if (b === 'delivered') {
    const at = latest(ls, 'DELIVERED');
    return {
      text: at ? `Delivered on ${day(at)}` : 'Delivered',
      sub: 'Your item has been delivered',
      tone: TONES.green,
    };
  }
  const label = orderListStatusLabel(o);
  const shipped = latest(ls, 'SHIPPED');
  if (shipped) return { text: 'On the way', sub: `Shipped on ${day(shipped)}`, tone: TONES.violet };
  const packed = latest(ls, 'PACKED');
  if (packed) return { text: 'Packed', sub: `Ready to ship · ${day(packed)}`, tone: TONES.blue };
  return {
    text: label === 'Processing' ? 'Order confirmed' : label,
    sub: 'Seller is preparing it',
    tone: TONES.blue,
  };
}

type Card = { image: string | null; slug: string };

export default function OrdersScreen() {
  const router = useRouter();
  const [orders, setOrders] = useState<OrderListItem[] | null>(null);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [cards, setCards] = useState<Record<string, Card>>({});
  const [filter, setFilter] = useState<Filter>('all');
  const [query, setQuery] = useState('');
  const asked = useRef(new Set<string>());

  // Product photos + slugs for the lines (orders keep a title snapshot, not the image).
  const loadCards = useCallback((list: OrderListItem[]) => {
    const ids = [...new Set(list.flatMap((o) => lines(o).map((l) => l.productId)))].filter(
      (id) => !asked.current.has(id),
    );
    ids.forEach((id) => asked.current.add(id));
    for (let i = 0; i < ids.length; i += CARD_BATCH) {
      api.catalog
        .productCards(ids.slice(i, i + CARD_BATCH))
        .then(({ items }) =>
          setCards((cur) => ({
            ...cur,
            ...Object.fromEntries(items.map((c) => [c.id, { image: c.imageUrl, slug: c.slug }])),
          })),
        )
        .catch(() => undefined);
    }
  }, []);

  const load = useCallback(async () => {
    try {
      const page = await api.orders.list();
      setOrders(page.items);
      setCursor(page.nextCursor ?? null);
      loadCards(page.items);
    } catch {
      setOrders((cur) => cur ?? []);
    }
  }, [loadCards]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const loadMore = async () => {
    if (!cursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const page = await api.orders.list({ cursor });
      setOrders((cur) => [...(cur ?? []), ...page.items]);
      setCursor(page.nextCursor ?? null);
      loadCards(page.items);
    } catch {
      /* keep what we have */
    } finally {
      setLoadingMore(false);
    }
  };

  const counts = useMemo(() => {
    const c: Record<Filter, number> = {
      all: 0,
      active: 0,
      delivered: 0,
      cancelled: 0,
      returned: 0,
    };
    for (const o of orders ?? []) {
      c.all++;
      c[bucket(o)]++;
    }
    return c;
  }, [orders]);

  const sections = useMemo(() => {
    const q = query.trim().toLowerCase();
    const shown = (orders ?? []).filter(
      (o) =>
        (filter === 'all' || bucket(o) === filter) &&
        (!q ||
          o.orderNumber.toLowerCase().includes(q) ||
          lines(o).some((l) => l.title.toLowerCase().includes(q))),
    );
    const groups: { title: string; data: OrderListItem[] }[] = [];
    for (const o of shown) {
      const title = monthKey(o.createdAt);
      const g = groups[groups.length - 1];
      if (g?.title === title) g.data.push(o);
      else groups.push({ title, data: [o] });
    }
    return groups;
  }, [orders, filter, query]);

  if (!orders) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={BRAND} />
      </View>
    );
  }

  if (orders.length === 0) {
    return (
      <View style={styles.center}>
        <View style={styles.emptyIcon}>
          <Ionicons name="bag-handle-outline" size={40} color={BRAND} />
        </View>
        <Text style={styles.emptyTitle}>No orders yet</Text>
        <Text style={styles.emptyText}>Everything you order shows up here.</Text>
        <Pressable style={styles.shopBtn} onPress={() => router.push('/')}>
          <Text style={styles.shopText}>Start shopping</Text>
        </Pressable>
      </View>
    );
  }

  const header = (
    <View style={styles.top}>
      <View style={styles.search}>
        <Ionicons name="search" size={17} color={colors.text.muted} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Search by product or order number"
          placeholderTextColor={colors.text.muted}
          style={styles.searchInput}
          autoCorrect={false}
          returnKeyType="search"
        />
        {query ? (
          <Pressable onPress={() => setQuery('')} hitSlop={8}>
            <Ionicons name="close-circle" size={17} color={colors.text.muted} />
          </Pressable>
        ) : null}
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chips}
      >
        {FILTERS.filter((f) => f.key === 'all' || counts[f.key] > 0).map((f) => {
          const on = filter === f.key;
          return (
            <Pressable
              key={f.key}
              onPress={() => {
                void Haptics.selectionAsync().catch(() => undefined);
                setFilter(f.key);
              }}
              style={[styles.chip, on && styles.chipOn]}
            >
              <Text style={[styles.chipText, on && styles.chipTextOn]}>{f.label}</Text>
              <View style={[styles.chipCount, on && styles.chipCountOn]}>
                <Text style={[styles.chipCountText, on && styles.chipCountTextOn]}>
                  {counts[f.key]}
                </Text>
              </View>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );

  // Search + filters stay pinned above the list (they used to scroll away under the title bar).
  return (
    <View style={styles.screen}>
      {header}
      <SectionList
        style={styles.screen}
        sections={sections}
        keyExtractor={(o) => o.orderId}
        stickySectionHeadersEnabled={false}
        contentContainerStyle={styles.list}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            tintColor={BRAND}
            colors={[BRAND]}
            onRefresh={async () => {
              setRefreshing(true);
              await load();
              setRefreshing(false);
            }}
          />
        }
        onEndReached={() => void loadMore()}
        onEndReachedThreshold={0.6}
        renderSectionHeader={({ section }) => <Text style={styles.month}>{section.title}</Text>}
        renderItem={({ item }) => <OrderCard order={item} cards={cards} />}
        ListEmptyComponent={
          <View style={styles.noMatch}>
            <Ionicons name="search-outline" size={30} color={colors.text.muted} />
            <Text style={styles.emptyText}>No orders match this search.</Text>
          </View>
        }
        ListFooterComponent={
          loadingMore ? <ActivityIndicator color={BRAND} style={{ margin: space.lg }} /> : undefined
        }
      />
    </View>
  );
}

function OrderCard({ order, cards }: { order: OrderListItem; cards: Record<string, Card> }) {
  const router = useRouter();
  const [expanded, setExpanded] = useState(false);
  const ls = shownLines(order);
  const cancelledCount = lines(order).length - ls.length;
  // Cancelled lines come off the total, as on the order page.
  const total = (
    Number(order.grandTotal) -
    (cancelledCount > 0
      ? lines(order)
          .filter((l) => l.sellerStatus === 'CANCELLED')
          .reduce((n, l) => n + Number(l.paid ?? 0), 0)
      : 0)
  ).toFixed(2) as Money;
  const h = headline(order);
  const b = bucket(order);
  const shown = expanded ? ls : ls.slice(0, PREVIEW_LINES);
  const more = ls.length - shown.length;
  const units = ls.reduce((n, l) => n + l.quantity, 0);
  const step = Math.max(...ls.map((l) => STEP[l.sellerStatus]), 0);
  const open = () => router.push(`/orders/${order.orderId}`);
  const tracking = b === 'active' && order.status !== 'PENDING_PAYMENT';
  const showSteps = tracking || b === 'delivered';

  return (
    <Pressable
      onPress={open}
      style={({ pressed }) => [styles.card, pressed && { opacity: 0.94 }]}
      accessibilityLabel={`Order ${order.orderNumber}, ${h.text}`}
    >
      <View style={[styles.status, { backgroundColor: h.tone.bg }]}>
        <Ionicons name={h.tone.icon} size={16} color={h.tone.fg} />
        <Text style={styles.statusLine} numberOfLines={1}>
          <Text style={[styles.statusText, { color: h.tone.fg }]}>{h.text}</Text>
          {h.sub ? <Text style={styles.statusSub}>{`  ·  ${h.sub}`}</Text> : null}
        </Text>
        <Text style={[styles.statusCta, { color: h.tone.fg }]}>{tracking ? 'Track' : 'View'}</Text>
        <Ionicons name="chevron-forward" size={15} color={h.tone.fg} />
      </View>

      {showSteps ? (
        // Same steps and look as the order page's tracker (app/orders/[id].tsx).
        <View style={styles.tracker}>
          {TRACKING_STEPS.map((label, i) => (
            <View key={label} style={styles.step}>
              <View style={styles.stepRail}>
                <View
                  style={[styles.rail, i === 0 && styles.railHidden, i <= step && styles.railDone]}
                />
                <View style={[styles.dot, i <= step && styles.dotDone]}>
                  {i <= step ? <Ionicons name="checkmark" size={11} color={colors.white} /> : null}
                </View>
                <View
                  style={[
                    styles.rail,
                    i === TRACKING_STEPS.length - 1 && styles.railHidden,
                    i < step && styles.railDone,
                  ]}
                />
              </View>
              <Text style={[styles.stepLabel, i <= step && styles.stepLabelDone]} numberOfLines={1}>
                {label}
              </Text>
            </View>
          ))}
        </View>
      ) : null}

      {shown.map((l) => {
        const card = cards[l.productId];
        const delivered = l.sellerStatus === 'DELIVERED';
        const mixed = ls.some((x) => x.sellerStatus !== l.sellerStatus);
        return (
          <View key={l.orderItemId} style={styles.line}>
            <View style={styles.thumb}>
              {card?.image ? (
                <Image
                  source={{ uri: card.image }}
                  style={styles.thumbImg}
                  contentFit="contain"
                  transition={150}
                />
              ) : (
                <Ionicons name="image-outline" size={20} color={colors.card.border} />
              )}
              {l.quantity > 1 ? (
                <View style={styles.qtyBadge}>
                  <Text style={styles.qtyText}>×{l.quantity}</Text>
                </View>
              ) : null}
            </View>
            <View style={styles.lineBody}>
              <Text style={styles.lineTitle} numberOfLines={2}>
                {l.title}
              </Text>
              {mixed ? <Text style={styles.lineStatus}>{lineLabel(l)}</Text> : null}
              {delivered && card?.slug ? (
                <View style={styles.lineActions}>
                  <Pressable
                    onPress={() => router.push(`/review/${card.slug}`)}
                    style={styles.rate}
                    hitSlop={4}
                  >
                    {[1, 2, 3, 4, 5].map((n) => (
                      <Ionicons key={n} name="star" size={13} color="#c2cad6" />
                    ))}
                    <Text style={styles.rateText}>Rate</Text>
                  </Pressable>
                  <Pressable
                    onPress={() => router.push(`/product/${card.slug}`)}
                    style={styles.again}
                    hitSlop={4}
                  >
                    <Ionicons name="refresh" size={13} color={BRAND} />
                    <Text style={styles.againText}>Buy again</Text>
                  </Pressable>
                </View>
              ) : null}
            </View>
          </View>
        );
      })}

      {more > 0 || expanded ? (
        <Pressable onPress={() => setExpanded((v) => !v)} hitSlop={6} style={styles.more}>
          <Text style={styles.moreText}>
            {expanded ? 'Show less' : `+ ${more} more item${more > 1 ? 's' : ''}`}
          </Text>
          <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={14} color={BRAND} />
        </Pressable>
      ) : null}

      <View style={styles.foot}>
        <View style={styles.footInfo}>
          <Text style={styles.orderNo} numberOfLines={1}>
            #{order.orderNumber}
          </Text>
          <Text style={styles.meta} numberOfLines={1}>
            {fullDate(order.createdAt)} · {units} item{units === 1 ? '' : 's'}
            {cancelledCount > 0 ? ` · ${cancelledCount} cancelled` : ''}
          </Text>
        </View>
        {order.paymentMethod ? (
          <View style={[styles.pay, order.paymentMethod === 'COD' && styles.payCod]}>
            <Ionicons
              name={order.paymentMethod === 'COD' ? 'cash-outline' : 'card-outline'}
              size={11}
              color={order.paymentMethod === 'COD' ? '#92400e' : '#15803d'}
            />
            <Text style={[styles.payText, order.paymentMethod === 'COD' && styles.payTextCod]}>
              {order.paymentMethod === 'COD' ? 'COD' : 'Paid'}
            </Text>
          </View>
        ) : null}
        <Text style={styles.total}>{formatMoney(total)}</Text>
      </View>
    </Pressable>
  );
}

/** A line's own status, shown when an order's items are at different stages. */
function lineLabel(l: OrderListLine): string {
  switch (l.sellerStatus) {
    case 'DELIVERED':
      return `Delivered on ${day(l.updatedAt)}`;
    case 'SHIPPED':
      return `Shipped on ${day(l.updatedAt)}`;
    case 'PACKED':
      return 'Packed';
    case 'CANCELLED':
      return 'Cancelled';
    case 'RETURNED':
      return 'Returned';
    default:
      return 'Processing';
  }
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.page },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.sm,
    padding: space.xl,
    backgroundColor: colors.page,
  },
  list: { paddingBottom: space.xxl },
  top: {
    paddingHorizontal: space.lg,
    paddingTop: space.md,
    paddingBottom: space.md,
    gap: space.md,
    backgroundColor: colors.page,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#dfe5ee',
    zIndex: 1,
  },
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.white,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#e3e8f1',
    paddingHorizontal: 12,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 11,
    fontFamily: font.ui,
    fontSize: 14,
    color: colors.text.strong,
  },
  chips: { gap: 8, paddingRight: space.lg },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#dbe4f3',
    backgroundColor: colors.white,
    paddingLeft: 12,
    paddingRight: 6,
    paddingVertical: 6,
  },
  chipOn: { backgroundColor: BRAND, borderColor: BRAND },
  chipText: { fontFamily: font.uiSemibold, fontSize: 13, color: colors.text.strong },
  chipTextOn: { color: colors.white },
  chipCount: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    paddingHorizontal: 5,
    backgroundColor: '#eef2f8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipCountOn: { backgroundColor: 'rgba(255,255,255,0.22)' },
  chipCountText: { fontFamily: font.uiBold, fontSize: 11, color: colors.text.body },
  chipCountTextOn: { color: colors.white },
  month: {
    fontFamily: font.uiBold,
    fontSize: 12,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    color: colors.text.muted,
    paddingHorizontal: space.lg,
    paddingTop: space.lg,
    paddingBottom: space.sm,
  },
  card: {
    marginHorizontal: space.lg,
    marginBottom: 10,
    backgroundColor: colors.white,
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#0f172a',
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  status: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: space.md,
    paddingVertical: 8,
  },
  statusLine: { flex: 1 },
  statusText: { fontFamily: font.uiBold, fontSize: 13.5 },
  statusSub: { fontFamily: font.uiMedium, fontSize: 11.5, color: colors.text.body },
  statusCta: { fontFamily: font.uiBold, fontSize: 12 },
  tracker: { flexDirection: 'row', paddingHorizontal: space.sm, paddingTop: 10 },
  step: { flex: 1, alignItems: 'center', gap: 4 },
  stepRail: { flexDirection: 'row', alignItems: 'center', alignSelf: 'stretch' },
  rail: { flex: 1, height: 2, backgroundColor: colors.steps.idle },
  railDone: { backgroundColor: colors.feature.guarantee },
  railHidden: { opacity: 0 },
  dot: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: colors.steps.idle,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dotDone: { backgroundColor: colors.feature.guarantee },
  stepLabel: { fontFamily: font.ui, fontSize: 10.5, color: colors.text.muted },
  stepLabelDone: { color: colors.text.strong, fontFamily: font.uiSemibold },
  line: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: space.md,
    paddingTop: 10,
  },
  thumb: {
    width: 52,
    height: 52,
    borderRadius: 10,
    backgroundColor: '#f6f8fb',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  thumbImg: { width: '88%', height: '88%' },
  qtyBadge: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    backgroundColor: 'rgba(17,24,39,0.75)',
    borderRadius: 5,
    paddingHorizontal: 4,
  },
  qtyText: { fontFamily: font.uiBold, fontSize: 9.5, color: colors.white },
  lineBody: { flex: 1, gap: 2, justifyContent: 'center' },
  lineTitle: { fontFamily: font.uiMedium, fontSize: 13, lineHeight: 17, color: colors.heading },
  lineStatus: { fontFamily: font.uiSemibold, fontSize: 11.5, color: colors.text.muted },
  lineActions: { flexDirection: 'row', alignItems: 'center', gap: 14, marginTop: 1 },
  rate: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  rateText: { fontFamily: font.uiBold, fontSize: 12, color: BRAND, marginLeft: 4 },
  again: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  againText: { fontFamily: font.uiBold, fontSize: 12, color: BRAND },
  more: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    alignSelf: 'flex-start',
    marginLeft: space.md + 62,
    marginTop: 6,
  },
  moreText: { fontFamily: font.uiBold, fontSize: 12, color: BRAND },
  foot: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 10,
    marginHorizontal: space.md,
    paddingVertical: 9,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#dfe5ee',
  },
  orderNo: { fontFamily: font.uiBold, fontSize: 12, color: colors.text.strong },
  footInfo: { flex: 1, minWidth: 0 },
  meta: { fontFamily: font.uiMedium, fontSize: 11, color: colors.text.muted, marginTop: 1 },
  total: { flexShrink: 0, fontFamily: font.uiBold, fontSize: 14.5, color: colors.heading },
  pay: {
    flexShrink: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#e8f7ee',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  payCod: { backgroundColor: '#fef3c7' },
  payText: { fontFamily: font.uiSemibold, fontSize: 10.5, color: '#15803d' },
  payTextCod: { color: '#92400e' },
  emptyIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#eaf1ff',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: space.sm,
  },
  emptyTitle: { fontFamily: font.uiBold, fontSize: 18, color: colors.heading },
  emptyText: { fontFamily: font.body, fontSize: 14, color: colors.text.body, textAlign: 'center' },
  noMatch: { alignItems: 'center', gap: space.sm, paddingVertical: space.xxxl },
  shopBtn: {
    marginTop: space.md,
    backgroundColor: BRAND,
    borderRadius: radii.tile,
    paddingHorizontal: 26,
    paddingVertical: 12,
  },
  shopText: { fontFamily: font.uiSemibold, fontSize: 15, color: colors.white },
});
