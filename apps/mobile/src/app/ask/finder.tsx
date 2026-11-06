import { useCallback, useRef, useState } from 'react';
import {
  ActivityIndicator,
  AppState,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import Animated, { FadeIn, FadeInDown, ReduceMotion } from 'react-native-reanimated';
import { ApiError, type FinderMessage } from '@youmart/shared-client';
import { AssistantProductCards, RestockCard } from '@/components/AssistantCards';
import { UsernameSheet } from '@/components/UsernameSheet';
import { api } from '@/lib/api';
import { useRouter } from '@/lib/router';
import { useSession } from '@/stores/session';
import { colors, font, space } from '@/theme';

// v1.18 Product Finder Live - a public room like a Telegram movie-bot group. Every shopper sees
// every question and the bot's reply to it (a reply card quoting the question): the matching
// products, or "not found" with Request restock. Shoppers can only ask for products - they can't
// reply to or message each other. New questions arrive live (polled every few seconds).

const RM = ReduceMotion.Never;
const BRAND = colors.brand.DEFAULT;
const BOT_GRADIENT = 'linear-gradient(135deg, #0f766e 0%, #059669 55%, #34d399 100%)';
const POLL_MS = 4000;
const SUGGESTIONS = ['Garden hose', 'Perlite', 'Cargo pants', 'Pruning shears', 'Vermicompost'];

const timeOf = (iso: string) =>
  new Date(iso).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' });

/** v1.18 The room needs a signed-in shopper with a username (it's shown with each question). */
export default function ProductFinderScreen() {
  const session = useSession();
  const user = session.status === 'authenticated' ? session.user : null;
  if (session.status === 'loading') {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={BRAND} />
      </View>
    );
  }
  if (!user || !user.username) {
    return <FinderGate signedIn={!!user} hasPassword={user?.hasPassword ?? false} />;
  }
  return <ProductFinderLive />;
}

function FinderGate({ signedIn, hasPassword }: { signedIn: boolean; hasPassword: boolean }) {
  const router = useRouter();
  const [sheet, setSheet] = useState(false);
  // Signed in without a username: the sheet opens straight away.
  useFocusEffect(
    useCallback(() => {
      if (!signedIn) return;
      const t = setTimeout(() => setSheet(true), 350);
      return () => clearTimeout(t);
    }, [signedIn]),
  );
  return (
    <View style={styles.gate}>
      <Animated.View entering={FadeInDown.duration(320).reduceMotion(RM)} style={styles.gateCard}>
        <View style={[styles.emptyIcon, { experimental_backgroundImage: BOT_GRADIENT }]}>
          <Ionicons name={signedIn ? 'at' : 'lock-closed'} size={26} color={colors.white} />
        </View>
        <Text style={styles.emptyTitle}>
          {signedIn ? 'Pick a username to enter' : 'Sign in to enter the room'}
        </Text>
        <Text style={styles.emptyText}>
          {signedIn
            ? 'Everyone in Product Finder Live sees who asked - so the room shows your username with each question.'
            : 'Ask for any product and our bot replies to everyone in the room. Sign in and pick a username to join.'}
        </Text>
        <Pressable
          style={styles.gateButton}
          onPress={() => (signedIn ? setSheet(true) : router.push('/auth/login'))}
        >
          <Ionicons name={signedIn ? 'at' : 'log-in-outline'} size={18} color={colors.white} />
          <Text style={styles.signInText}>{signedIn ? 'Pick my username' : 'Sign in'}</Text>
        </Pressable>
      </Animated.View>
      {signedIn ? (
        <UsernameSheet
          visible={sheet}
          reason="finder"
          hasPassword={hasPassword}
          onClose={(user) => {
            setSheet(false);
            if (!user) router.back();
          }}
        />
      ) : null}
    </View>
  );
}

function ProductFinderLive() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const session = useSession();
  const signedIn = session.status === 'authenticated';

  // Newest first: the list is inverted, so the newest sits at the bottom by the composer.
  const [items, setItems] = useState<FinderMessage[]>([]);
  const [today, setToday] = useState(0);
  const [loading, setLoading] = useState(true);
  const [older, setOlder] = useState<'idle' | 'loading' | 'done'>('idle');
  const [text, setText] = useState('');
  const [sending, setSending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [requested, setRequested] = useState<Set<string>>(new Set());
  const newest = useRef<string | undefined>(undefined);

  const merge = useCallback((incoming: FinderMessage[], atTop: boolean) => {
    if (incoming.length === 0) return;
    setItems((prev) => {
      const seen = new Set(prev.map((m) => m.id));
      const fresh = incoming.filter((m) => !seen.has(m.id));
      const next = atTop ? [...[...fresh].reverse(), ...prev] : [...prev, ...[...fresh].reverse()];
      newest.current = next[0]?.id ?? newest.current;
      return next;
    });
  }, []);

  // First load, then live updates while the room is on screen and the app is open.
  useFocusEffect(
    useCallback(() => {
      let alive = true;
      let timer: ReturnType<typeof setInterval> | null = null;
      const poll = async () => {
        try {
          const feed = await api.support.finder.list(
            newest.current ? { after: newest.current, limit: 50 } : { limit: 30 },
          );
          if (!alive) return;
          setToday(feed.todayCount);
          merge(feed.items, true);
          if (!newest.current && feed.items.length < 30) setOlder('done');
        } catch {
          // Offline for a moment: the next tick tries again.
        } finally {
          if (alive) setLoading(false);
        }
      };
      void poll();
      timer = setInterval(() => {
        if (AppState.currentState === 'active') void poll();
      }, POLL_MS);
      return () => {
        alive = false;
        if (timer) clearInterval(timer);
      };
    }, [merge]),
  );

  const loadOlder = async () => {
    const oldest = items[items.length - 1]?.id;
    if (!oldest || older !== 'idle') return;
    setOlder('loading');
    try {
      const feed = await api.support.finder.list({ before: oldest, limit: 30 });
      merge(feed.items, false);
      setOlder(feed.items.length < 30 ? 'done' : 'idle');
    } catch {
      setOlder('idle');
    }
  };

  const ask = async (value: string) => {
    const q = value.trim();
    if (q.length < 2 || sending) return;
    if (!signedIn) {
      router.push('/auth/login');
      return;
    }
    setError(null);
    setSending(q);
    setText('');
    void Haptics.selectionAsync().catch(() => undefined);
    try {
      const reply = await api.support.finder.ask(q);
      merge([reply], true);
      setToday((n) => n + 1);
      void Haptics.notificationAsync(
        reply.result === 'FOUND'
          ? Haptics.NotificationFeedbackType.Success
          : Haptics.NotificationFeedbackType.Warning,
      ).catch(() => undefined);
    } catch (err) {
      setText(q);
      setError(err instanceof ApiError ? err.message : 'Could not send. Please try again.');
    } finally {
      setSending(null);
    }
  };

  const header = sending ? (
    <View style={styles.pending}>
      <View style={[styles.askRow, styles.askRowMine]}>
        <View style={[styles.bubble, styles.bubbleMine]}>
          <Text style={[styles.bubbleText, styles.bubbleTextMine]}>{sending}</Text>
        </View>
      </View>
      <View style={styles.typing}>
        <View style={[styles.botAvatar, { experimental_backgroundImage: BOT_GRADIENT }]}>
          <Ionicons name="search" size={13} color={colors.white} />
        </View>
        <ActivityIndicator size="small" color="#059669" />
        <Text style={styles.typingText}>YouMart Bot is searching…</Text>
      </View>
    </View>
  ) : undefined;

  return (
    <KeyboardAvoidingView
      style={styles.page}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >
      <View style={styles.banner}>
        <View style={styles.liveDot} />
        <Text style={styles.bannerText} numberOfLines={1}>
          Live · {today} {today === 1 ? 'question' : 'questions'} today · Bot replies in seconds
        </Text>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={BRAND} />
        </View>
      ) : (
        <FlatList
          data={items}
          inverted
          keyExtractor={(m) => m.id}
          renderItem={({ item }) => (
            <FinderRow
              m={item}
              signedIn={signedIn}
              requested={requested.has(item.id)}
              onRequested={() => setRequested((s) => new Set(s).add(item.id))}
              onSeeAll={() => router.push({ pathname: '/search', params: { q: item.text } })}
            />
          )}
          ListHeaderComponent={header}
          ListFooterComponent={
            older === 'loading' ? (
              <ActivityIndicator style={{ margin: 16 }} color={BRAND} />
            ) : items.length > 0 && older === 'done' ? (
              <Text style={styles.start}>Start of today&apos;s room</Text>
            ) : undefined
          }
          ListEmptyComponent={
            sending ? undefined : (
              <View style={styles.empty}>
                <View style={[styles.emptyIcon, { experimental_backgroundImage: BOT_GRADIENT }]}>
                  <Ionicons name="search" size={26} color={colors.white} />
                </View>
                <Text style={styles.emptyTitle}>Be the first to ask</Text>
                <Text style={styles.emptyText}>
                  Type a product name below - the bot finds it for you, and everyone here sees the
                  answer.
                </Text>
              </View>
            )
          }
          onEndReached={() => void loadOlder()}
          onEndReachedThreshold={0.3}
          contentContainerStyle={styles.list}
          keyboardShouldPersistTaps="handled"
        />
      )}

      <View style={[styles.composerWrap, { paddingBottom: Math.max(insets.bottom, 10) }]}>
        {error ? (
          <Animated.View entering={FadeIn.duration(200).reduceMotion(RM)} style={styles.errorRow}>
            <Ionicons name="alert-circle" size={15} color="#b91c1c" />
            <Text style={styles.errorText}>{error}</Text>
          </Animated.View>
        ) : null}
        {items.length === 0 && !sending ? (
          <View style={styles.chips}>
            {SUGGESTIONS.map((s) => (
              <Pressable key={s} style={styles.chip} onPress={() => void ask(s)}>
                <Text style={styles.chipText}>{s}</Text>
              </Pressable>
            ))}
          </View>
        ) : null}
        {signedIn ? (
          <View style={styles.composer}>
            <Ionicons name="search" size={18} color={colors.text.muted} />
            <TextInput
              value={text}
              onChangeText={(v) => {
                setText(v);
                if (error) setError(null);
              }}
              placeholder="Ask for a product… e.g. garden hose"
              placeholderTextColor={colors.text.muted}
              style={styles.input}
              maxLength={60}
              returnKeyType="send"
              onSubmitEditing={() => void ask(text)}
              editable={!sending}
            />
            <Pressable
              onPress={() => void ask(text)}
              disabled={!!sending || text.trim().length < 2}
              style={({ pressed }) => [
                styles.send,
                (text.trim().length < 2 || !!sending) && styles.sendOff,
                pressed && { transform: [{ scale: 0.92 }] },
              ]}
              accessibilityLabel="Ask the bot"
            >
              <Ionicons name="arrow-up" size={20} color={colors.white} />
            </Pressable>
          </View>
        ) : (
          <Pressable style={styles.signIn} onPress={() => router.push('/auth/login')}>
            <Ionicons name="log-in-outline" size={18} color={colors.white} />
            <Text style={styles.signInText}>Sign in to ask for a product</Text>
          </Pressable>
        )}
        <Text style={styles.rules}>Only product names · You can&apos;t message other shoppers</Text>
      </View>
    </KeyboardAvoidingView>
  );
}

/** One question (left: another shopper, right: mine) and the bot's reply card under it. */
function FinderRow({
  m,
  signedIn,
  requested,
  onRequested,
  onSeeAll,
}: {
  m: FinderMessage;
  signedIn: boolean;
  requested: boolean;
  onRequested: () => void;
  onSeeAll: () => void;
}) {
  const who = m.mine ? 'you' : m.name;
  return (
    <Animated.View entering={FadeInDown.duration(260).reduceMotion(RM)} style={styles.row}>
      <View style={[styles.askRow, m.mine && styles.askRowMine]}>
        {!m.mine ? (
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{m.name.charAt(0).toUpperCase()}</Text>
          </View>
        ) : null}
        <View style={[styles.bubble, m.mine && styles.bubbleMine]}>
          {!m.mine ? <Text style={styles.name}>{m.name}</Text> : null}
          <Text style={[styles.bubbleText, m.mine && styles.bubbleTextMine]}>{m.text}</Text>
          <Text style={[styles.time, m.mine && styles.timeMine]}>{timeOf(m.createdAt)}</Text>
        </View>
      </View>

      <View style={styles.reply}>
        <View style={styles.replyHead}>
          <View style={[styles.botAvatar, { experimental_backgroundImage: BOT_GRADIENT }]}>
            <Ionicons name="search" size={13} color={colors.white} />
          </View>
          <Text style={styles.botName}>YouMart Bot</Text>
          <View style={styles.botBadge}>
            <Ionicons name="checkmark" size={9} color={colors.white} />
          </View>
          <Text style={styles.replyTo} numberOfLines={1}>
            replied to {who}
          </Text>
        </View>
        <View style={styles.quote}>
          <Text style={styles.quoteText} numberOfLines={1}>
            “{m.text}”
          </Text>
        </View>
        {m.result === 'FOUND' ? (
          <>
            {/* v1.18 movie-bot style: a plain status line, then the results. */}
            <View style={[styles.status, styles.statusFound]}>
              <Ionicons name="checkmark-circle" size={16} color="#047857" />
              <Text style={[styles.statusText, { color: '#065f46' }]}>
                {m.found} {m.found === 1 ? 'result' : 'results'} for “{m.text}”
              </Text>
            </View>
            <AssistantProductCards products={m.products} label="Results" />
            {m.found > m.products.length ? (
              <Pressable onPress={onSeeAll} style={styles.seeAll} hitSlop={6}>
                <Text style={styles.seeAllText}>See all {m.found} results</Text>
                <Ionicons name="arrow-forward" size={14} color={BRAND} />
              </Pressable>
            ) : null}
          </>
        ) : (
          <>
            <View style={[styles.status, styles.statusMissing]}>
              <Ionicons name="close-circle" size={16} color="#b91c1c" />
              <Text style={[styles.statusText, { color: '#991b1b' }]}>Not found: “{m.text}”</Text>
            </View>
            <RestockCard
              item={m.text}
              transcript={() => `Product Finder Live: "${m.text}"`}
              sent={requested}
              onSent={onRequested}
              signedIn={signedIn}
            />
          </>
        )}
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: '#f4f6fa' },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: space.lg,
    paddingVertical: 8,
    backgroundColor: '#ecfdf5',
    borderBottomWidth: 1,
    borderBottomColor: '#d1fae5',
  },
  liveDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#10b981' },
  bannerText: { flex: 1, fontFamily: font.uiSemibold, fontSize: 12.5, color: '#047857' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  gate: { flex: 1, backgroundColor: '#f4f6fa', justifyContent: 'center', padding: space.xl },
  gateCard: {
    backgroundColor: colors.white,
    borderRadius: 24,
    padding: space.xl,
    alignItems: 'center',
    gap: 10,
    shadowColor: '#0b1b3f',
    shadowOpacity: 0.08,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3,
  },
  gateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    alignSelf: 'stretch',
    backgroundColor: BRAND,
    borderRadius: 24,
    minHeight: 50,
    marginTop: 8,
  },
  list: { padding: space.md, gap: 18, flexGrow: 1 },
  row: { gap: 8 },
  pending: { gap: 8, marginBottom: 18 },
  askRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, maxWidth: '86%' },
  askRowMine: { alignSelf: 'flex-end', flexDirection: 'row-reverse' },
  avatar: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#dbe6fb',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { fontFamily: font.uiBold, fontSize: 13, color: BRAND },
  bubble: {
    flexShrink: 1,
    backgroundColor: colors.white,
    borderRadius: 16,
    borderBottomLeftRadius: 4,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: '#e6ebf3',
  },
  bubbleMine: {
    backgroundColor: BRAND,
    borderColor: BRAND,
    borderBottomLeftRadius: 16,
    borderBottomRightRadius: 4,
  },
  name: { fontFamily: font.uiBold, fontSize: 11.5, color: '#7c3aed', marginBottom: 1 },
  bubbleText: { fontFamily: font.uiMedium, fontSize: 14.5, color: colors.heading },
  bubbleTextMine: { color: colors.white },
  time: { fontFamily: font.body, fontSize: 10, color: colors.text.muted, alignSelf: 'flex-end' },
  timeMine: { color: '#cfe0ff' },
  reply: {
    marginLeft: 38,
    backgroundColor: colors.white,
    borderRadius: 16,
    borderTopLeftRadius: 4,
    padding: 12,
    gap: 8,
    borderWidth: 1,
    borderColor: '#d1fae5',
    shadowColor: '#064e3b',
    shadowOpacity: 0.05,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  replyHead: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  botAvatar: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  botName: { fontFamily: font.uiBold, fontSize: 13, color: '#047857' },
  botBadge: {
    width: 13,
    height: 13,
    borderRadius: 7,
    backgroundColor: '#10b981',
    alignItems: 'center',
    justifyContent: 'center',
  },
  replyTo: { flex: 1, fontFamily: font.body, fontSize: 11.5, color: colors.text.muted },
  quote: {
    borderLeftWidth: 3,
    borderLeftColor: '#34d399',
    backgroundColor: '#f0fdf4',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  quoteText: { fontFamily: font.uiMedium, fontSize: 12, color: '#065f46' },
  status: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  statusFound: { backgroundColor: '#ecfdf5' },
  statusMissing: { backgroundColor: '#fef2f2' },
  statusText: { fontFamily: font.uiBold, fontSize: 13.5, flexShrink: 1 },
  replyText: { fontFamily: font.body, fontSize: 14, color: colors.text.body },
  strong: { fontFamily: font.uiBold, color: colors.heading },
  seeAll: { flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start' },
  seeAllText: { fontFamily: font.uiBold, fontSize: 13, color: BRAND },
  typing: { flexDirection: 'row', alignItems: 'center', gap: 8, marginLeft: 4 },
  typingText: { fontFamily: font.uiMedium, fontSize: 12.5, color: '#047857' },
  start: {
    textAlign: 'center',
    fontFamily: font.uiMedium,
    fontSize: 11.5,
    color: colors.text.muted,
    marginVertical: 12,
  },
  empty: { alignItems: 'center', padding: 32, gap: 8 },
  emptyIcon: {
    width: 58,
    height: 58,
    borderRadius: 29,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  emptyTitle: { fontFamily: font.uiBold, fontSize: 17, color: colors.heading },
  emptyText: {
    fontFamily: font.body,
    fontSize: 13.5,
    lineHeight: 20,
    color: colors.text.muted,
    textAlign: 'center',
  },
  composerWrap: {
    backgroundColor: colors.white,
    borderTopWidth: 1,
    borderTopColor: '#e6ebf3',
    paddingHorizontal: space.md,
    paddingTop: 10,
    gap: 7,
  },
  errorRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  errorText: { flex: 1, fontFamily: font.uiMedium, fontSize: 12.5, color: '#b91c1c' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  chip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#cfe0ff',
    backgroundColor: '#f2f7ff',
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  chipText: { fontFamily: font.uiSemibold, fontSize: 12.5, color: BRAND },
  composer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#f4f6fa',
    borderRadius: 24,
    paddingLeft: 14,
    paddingRight: 5,
    minHeight: 48,
  },
  input: {
    flex: 1,
    fontFamily: font.uiMedium,
    fontSize: 15,
    color: colors.heading,
    paddingVertical: 10,
  },
  send: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: BRAND,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendOff: { backgroundColor: '#a9bde3' },
  signIn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: BRAND,
    borderRadius: 24,
    minHeight: 48,
  },
  signInText: { fontFamily: font.uiBold, fontSize: 15, color: colors.white },
  rules: {
    textAlign: 'center',
    fontFamily: font.body,
    fontSize: 11,
    color: colors.text.muted,
  },
});
