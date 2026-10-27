import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Stack, useFocusEffect, useRouter, type Href } from 'expo-router';
import Animated, {
  FadeInDown,
  FadeOut,
  LinearTransition,
  interpolate,
  useAnimatedStyle,
  type SharedValue,
} from 'react-native-reanimated';
import ReanimatedSwipeable from 'react-native-gesture-handler/ReanimatedSwipeable';
import * as Haptics from 'expo-haptics';
import type { InboxKind, InboxMessage } from '@youmart/shared-client';
import { api } from '@/lib/api';
import { useSession } from '@/stores/session';
import { refreshUnread, setUnread } from '@/stores/inbox';
import { colors, font, space } from '@/theme';

// v1.15: the inbox (bell) - order updates, refunds, returns and support replies, newest first.
// Tapping a message marks it read and opens what it is about.

const KIND: Record<InboxKind, { icon: keyof typeof Ionicons.glyphMap; tint: string; bg: string }> =
  {
    ORDER: { icon: 'cube', tint: colors.brand.DEFAULT, bg: '#e9f0ff' },
    REFUND: { icon: 'wallet', tint: '#137a3f', bg: '#e8f7ee' },
    RETURN: { icon: 'return-down-back', tint: '#9a6200', bg: '#fff6e0' },
    SUPPORT: { icon: 'chatbubble-ellipses', tint: '#5b35c4', bg: '#f2edff' },
    OFFER: { icon: 'pricetag', tint: '#c2410c', bg: '#fff1e6' },
    ACCOUNT: { icon: 'person', tint: colors.text.strong, bg: '#f1f3f7' },
  };

const FILTERS: Array<{ value: InboxKind | 'ALL'; label: string }> = [
  { value: 'ALL', label: 'All' },
  { value: 'ORDER', label: 'Orders' },
  { value: 'REFUND', label: 'Refunds' },
  { value: 'RETURN', label: 'Returns' },
  { value: 'SUPPORT', label: 'Support' },
];

function when(iso: string): string {
  const s = (Date.now() - new Date(iso).getTime()) / 1000;
  if (s < 60) return 'Just now';
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86_400) return `${Math.floor(s / 3600)} h ago`;
  if (s < 2 * 86_400) return 'Yesterday';
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

export default function InboxScreen() {
  const router = useRouter();
  const session = useSession();
  const [filter, setFilter] = useState<InboxKind | 'ALL'>('ALL');
  const [items, setItems] = useState<InboxMessage[] | null>(null);
  const [cursor, setCursor] = useState<string | null>(null);
  const [unread, setUnreadLocal] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState(false);

  const load = useCallback(async () => {
    if (session.status !== 'authenticated') return;
    setError(false);
    try {
      const page = await api.notifications.list({
        limit: 20,
        ...(filter === 'ALL' ? {} : { kind: filter }),
      });
      setItems(page.items);
      setCursor(page.nextCursor);
      setUnreadLocal(page.unread);
      setUnread(page.unread);
    } catch {
      setError(true);
      setItems((prev) => prev ?? []);
    }
  }, [filter, session.status]);

  // While the screen is open new messages appear by themselves (every 5 seconds).
  useFocusEffect(
    useCallback(() => {
      void load();
      const t = setInterval(() => void load(), 5_000);
      return () => clearInterval(t);
    }, [load]),
  );

  const more = async () => {
    if (!cursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const page = await api.notifications.list({
        limit: 20,
        cursor,
        ...(filter === 'ALL' ? {} : { kind: filter }),
      });
      setItems((prev) => [...(prev ?? []), ...page.items]);
      setCursor(page.nextCursor);
    } finally {
      setLoadingMore(false);
    }
  };

  const open = (m: InboxMessage) => {
    if (!m.read) {
      setItems((prev) => prev?.map((x) => (x.id === m.id ? { ...x, read: true } : x)) ?? prev);
      setUnreadLocal((n) => Math.max(0, n - 1));
      setUnread(unread - 1);
      api.notifications.markRead(m.id).catch(() => void refreshUnread());
    }
    // v1.17: a message with its own link (e.g. "Back in stock") opens that product / category.
    if (m.link) router.push(m.link as Href);
    else if (m.kind === 'SUPPORT') router.push('/help');
    else if (m.kind === 'REFUND' && !m.orderNumber) router.push('/wallet');
    else if (m.orderNumber) router.push(`/orders/${m.orderNumber}`);
  };

  const readAll = async () => {
    setItems((prev) => prev?.map((x) => ({ ...x, read: true })) ?? prev);
    setUnreadLocal(0);
    setUnread(0);
    await api.notifications.markAllRead().catch(() => void refreshUnread());
  };

  const remove = (m: InboxMessage) => {
    setItems((prev) => prev?.filter((x) => x.id !== m.id) ?? prev);
    if (!m.read) {
      setUnreadLocal((n) => Math.max(0, n - 1));
      setUnread(unread - 1);
    }
    api.notifications.remove(m.id).catch(() => void load());
  };

  const removeAll = () => {
    Alert.alert('Delete all alerts?', 'This clears every message in your Alerts.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete all',
        style: 'destructive',
        onPress: () => {
          setItems([]);
          setCursor(null);
          setUnreadLocal(0);
          setUnread(0);
          api.notifications.removeAll().catch(() => void load());
        },
      },
    ]);
  };

  if (session.status !== 'authenticated') {
    return (
      <View style={styles.center}>
        <Stack.Screen options={{ headerShown: true, title: 'Alerts' }} />
        <View style={styles.emptyIcon}>
          <Ionicons name="notifications-outline" size={34} color={colors.brand.DEFAULT} />
        </View>
        <Text style={styles.emptyTitle}>Sign in to see your updates</Text>
        <Text style={styles.emptyText}>Order updates, refunds and replies from us land here.</Text>
        <Pressable style={styles.primary} onPress={() => router.push('/auth/login')}>
          <Text style={styles.primaryText}>Sign in</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <Stack.Screen
        options={{
          headerShown: true,
          title: 'Alerts',
          headerRight: () =>
            items && items.length > 0 ? (
              <View style={styles.headerActions}>
                {unread > 0 ? (
                  <Pressable onPress={() => void readAll()} hitSlop={8}>
                    <Text style={styles.readAll}>Read all</Text>
                  </Pressable>
                ) : null}
                <Pressable
                  onPress={removeAll}
                  hitSlop={8}
                  style={styles.deleteAll}
                  accessibilityLabel="Delete all notifications"
                >
                  <Ionicons name="trash-outline" size={15} color={colors.cart.danger} />
                  <Text style={styles.deleteAllText}>Delete all</Text>
                </Pressable>
              </View>
            ) : null,
        }}
      />
      <View style={styles.filters}>
        {FILTERS.map((f) => {
          const on = f.value === filter;
          return (
            <Pressable
              key={f.value}
              onPress={() => {
                setFilter(f.value);
                setItems(null);
              }}
              style={[styles.chip, on && styles.chipOn]}
            >
              <Text style={[styles.chipText, on && styles.chipTextOn]}>{f.label}</Text>
            </Pressable>
          );
        })}
      </View>

      {items === null ? (
        <ActivityIndicator style={{ marginTop: 40 }} color={colors.brand.DEFAULT} />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(m) => m.id}
          contentContainerStyle={items.length === 0 ? styles.emptyList : styles.list}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              tintColor={colors.brand.DEFAULT}
              onRefresh={async () => {
                setRefreshing(true);
                await load();
                setRefreshing(false);
              }}
            />
          }
          onEndReachedThreshold={0.4}
          onEndReached={() => void more()}
          ListEmptyComponent={
            <View style={styles.center}>
              <View style={styles.emptyIcon}>
                <Ionicons name="notifications-outline" size={34} color={colors.brand.DEFAULT} />
              </View>
              <Text style={styles.emptyTitle}>
                {error ? "Couldn't load your notifications" : "You're all caught up"}
              </Text>
              <Text style={styles.emptyText}>
                {error
                  ? 'Pull down to try again.'
                  : 'Updates about your orders, refunds and help requests will show up here.'}
              </Text>
            </View>
          }
          ListFooterComponent={
            loadingMore ? (
              <ActivityIndicator style={{ margin: 16 }} color={colors.brand.DEFAULT} />
            ) : undefined
          }
          renderItem={({ item: m, index }) => {
            const k = KIND[m.kind];
            return (
              <Animated.View
                entering={FadeInDown.delay(Math.min(index, 8) * 40).duration(260)}
                exiting={FadeOut.duration(180)}
                layout={LinearTransition.duration(200)}
              >
                {/* Swipe right-to-left: a red Delete panel slides in and, once open, the message
                    is deleted. */}
                <ReanimatedSwipeable
                  friction={1.6}
                  rightThreshold={70}
                  overshootRight={false}
                  renderRightActions={(progress) => <DeleteAction progress={progress} />}
                  onSwipeableOpen={(direction) => {
                    if (direction === 'left' || direction === 'right') {
                      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(
                        () => undefined,
                      );
                      remove(m);
                    }
                  }}
                >
                  <Pressable
                    onPress={() => open(m)}
                    style={({ pressed }) => [
                      styles.card,
                      !m.read && styles.cardUnread,
                      pressed && { opacity: 0.85 },
                    ]}
                  >
                    <View style={[styles.icon, { backgroundColor: k.bg }]}>
                      <Ionicons name={k.icon} size={19} color={k.tint} />
                    </View>
                    <View style={styles.body}>
                      <View style={styles.titleRow}>
                        <Text
                          style={[styles.title, !m.read && styles.titleUnread]}
                          numberOfLines={1}
                        >
                          {m.title}
                        </Text>
                        <Text style={styles.time}>{when(m.createdAt)}</Text>
                      </View>
                      <Text style={styles.text} numberOfLines={3}>
                        {m.body}
                      </Text>
                      {m.link ? (
                        <Text style={styles.link}>Shop now ›</Text>
                      ) : m.orderNumber ? (
                        <Text style={styles.link}>
                          {m.kind === 'SUPPORT' ? 'View reply' : `Order ${m.orderNumber}`} ›
                        </Text>
                      ) : null}
                    </View>
                    {!m.read ? <View style={styles.dot} /> : null}
                  </Pressable>
                </ReanimatedSwipeable>
              </Animated.View>
            );
          }}
        />
      )}
      {items && items.length > 0 ? (
        <Text style={styles.hint}>Swipe a message to the left to delete it</Text>
      ) : null}
    </View>
  );
}

/** The red panel revealed behind a message as it is swiped left. */
function DeleteAction({ progress }: { progress: SharedValue<number> }) {
  const style = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [0, 0.4, 1], [0, 0.8, 1]),
    transform: [{ scale: interpolate(progress.value, [0, 1], [0.7, 1]) }],
  }));
  return (
    <View style={styles.swipeDelete}>
      <Animated.View style={[styles.swipeDeleteInner, style]}>
        <Ionicons name="trash" size={20} color={colors.white} />
        <Text style={styles.swipeDeleteText}>Delete</Text>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  deleteAll: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  deleteAllText: { fontFamily: font.uiSemibold, fontSize: 13.5, color: colors.cart.danger },
  swipeDelete: {
    width: 96,
    marginLeft: space.sm,
    borderRadius: 14,
    backgroundColor: colors.cart.danger,
    alignItems: 'center',
    justifyContent: 'center',
  },
  swipeDeleteInner: { alignItems: 'center', gap: 2 },
  swipeDeleteText: { fontFamily: font.uiBold, fontSize: 12, color: colors.white },
  screen: { flex: 1, backgroundColor: colors.page },
  filters: {
    flexDirection: 'row',
    gap: space.sm,
    paddingHorizontal: space.lg,
    paddingTop: space.md,
    paddingBottom: space.sm,
  },
  chip: {
    paddingHorizontal: 13,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.card.border,
  },
  chipOn: { backgroundColor: colors.brand.DEFAULT, borderColor: colors.brand.DEFAULT },
  chipText: { fontFamily: font.uiSemibold, fontSize: 12.5, color: colors.text.strong },
  chipTextOn: { color: colors.white },
  list: { padding: space.lg, gap: space.sm },
  emptyList: { flexGrow: 1 },
  card: {
    flexDirection: 'row',
    gap: space.md,
    padding: space.md,
    borderRadius: 14,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.card.border,
  },
  cardUnread: { borderColor: '#bcd0f7', backgroundColor: '#f5f8ff' },
  icon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: { flex: 1, gap: 3 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  title: { flex: 1, fontFamily: font.uiSemibold, fontSize: 14.5, color: colors.text.strong },
  titleUnread: { fontFamily: font.uiBold },
  time: { fontFamily: font.body, fontSize: 11.5, color: colors.text.muted },
  text: { fontFamily: font.body, fontSize: 13, lineHeight: 18.5, color: colors.text.body },
  link: { fontFamily: font.uiSemibold, fontSize: 12.5, color: colors.brand.DEFAULT, marginTop: 2 },
  dot: {
    width: 9,
    height: 9,
    borderRadius: 5,
    backgroundColor: colors.brand.DEFAULT,
    marginTop: 6,
  },
  hint: {
    textAlign: 'center',
    fontFamily: font.body,
    fontSize: 11.5,
    color: colors.text.muted,
    paddingBottom: space.lg,
  },
  readAll: { fontFamily: font.uiSemibold, fontSize: 13.5, color: colors.brand.DEFAULT },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: space.xl, gap: 6 },
  emptyIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#e9f0ff',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: space.sm,
  },
  emptyTitle: { fontFamily: font.uiBold, fontSize: 17, color: colors.text.strong },
  emptyText: {
    fontFamily: font.body,
    fontSize: 13.5,
    color: colors.text.muted,
    textAlign: 'center',
    maxWidth: 280,
  },
  primary: {
    marginTop: space.md,
    backgroundColor: colors.brand.DEFAULT,
    paddingHorizontal: 28,
    paddingVertical: 12,
    borderRadius: 10,
  },
  primaryText: { fontFamily: font.uiBold, fontSize: 15, color: colors.white },
});
