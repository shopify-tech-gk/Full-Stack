import { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import Animated, {
  Easing,
  FadeInDown,
  ReduceMotion,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import type { FinderMessage } from '@youmart/shared-client';
import { AiMark } from '@/components/AiMark';
import { ChatAvatar } from '@/components/ChatAvatar';
import { api } from '@/lib/api';
import { useRouter } from '@/lib/router';
import { colors, font, space } from '@/theme';

// v1.18 "Ask" - the bottom bar's centre button. A hero, then the two ways to ask: YouMart AI (a
// private assistant, with one-tap starter questions) and YouFind Bot (the public room,
// with what people are asking right now), and how the live room works.

const RM = ReduceMotion.Never;
const BRAND = colors.brand.DEFAULT;
const HERO = 'linear-gradient(150deg, #071530 0%, #0142aa 55%, #0d9488 120%)';
const AI_BUTTON = 'linear-gradient(120deg, #6366f1 0%, #a855f7 60%, #ec4899 100%)';
const LIVE_STRIP = 'linear-gradient(120deg, #047857 0%, #059669 50%, #10b981 100%)';
const LIVE_BUTTON = 'linear-gradient(120deg, #0f766e 0%, #059669 100%)';
const AI_STARTERS = ['Track my order', 'Gift ideas under ₹500', 'How do returns work?'];
const STEPS: { icon: keyof typeof Ionicons.glyphMap; title: string; text: string }[] = [
  { icon: 'create-outline', title: 'Ask', text: 'Type any product name' },
  { icon: 'flash-outline', title: 'Bot searches', text: 'Replies in seconds' },
  { icon: 'bag-check-outline', title: 'Get it', text: 'Or request a restock' },
];

export default function AskHub() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [today, setToday] = useState<number | null>(null);
  const [recent, setRecent] = useState<FinderMessage[]>([]);

  useFocusEffect(
    useCallback(() => {
      let live = true;
      api.support.finder
        .list({ limit: 3 })
        .then((feed) => {
          if (!live) return;
          setToday(feed.todayCount);
          setRecent([...feed.items].reverse());
        })
        .catch(() => undefined);
      return () => {
        live = false;
      };
    }, []),
  );

  const tap = () => void Haptics.selectionAsync().catch(() => undefined);
  const openAi = (q?: string) => {
    tap();
    router.push(q ? { pathname: '/help/assistant', params: { q } } : '/help/assistant');
  };
  const openLive = () => {
    tap();
    router.push('/ask/finder');
  };

  return (
    <ScrollView style={styles.page} contentContainerStyle={{ paddingBottom: 48 }}>
      {/* Hero */}
      <View style={[styles.hero, { paddingTop: insets.top + 8 }]}>
        <View style={[styles.blob, styles.blobA]} />
        <View style={[styles.blob, styles.blobB]} />
        <Pressable
          onPress={() => router.back()}
          style={styles.back}
          hitSlop={8}
          accessibilityLabel="Back"
        >
          <Ionicons name="chevron-back" size={22} color={colors.white} />
        </Pressable>
        <Animated.View entering={FadeInDown.duration(380).reduceMotion(RM)}>
          <Text style={styles.kicker}>ASK YOUMART</Text>
          <Text style={styles.heroTitle}>Answers in seconds</Text>
          <Text style={styles.heroText}>
            Chat privately with our AI, or ask the live room what&apos;s in store.
          </Text>
        </Animated.View>
        <Animated.View entering={FadeInDown.delay(90).duration(380).reduceMotion(RM)}>
          <Pressable
            onPress={openLive}
            style={({ pressed }) => [styles.heroSearch, pressed && styles.pressed]}
            accessibilityRole="button"
            accessibilityLabel="Ask the live room for a product"
          >
            <Ionicons name="search" size={18} color={BRAND} />
            <Text style={styles.heroSearchText}>Ask the live room for a product…</Text>
            <View style={styles.heroSearchGo}>
              <Ionicons name="arrow-forward" size={16} color={colors.white} />
            </View>
          </Pressable>
        </Animated.View>
      </View>

      <View style={styles.body}>
        {/* YouMart AI */}
        <Animated.View
          entering={FadeInDown.delay(140).duration(380).reduceMotion(RM)}
          style={styles.card}
        >
          <View style={styles.cardHead}>
            <AiMark size={58} animated />
            <View style={{ flex: 1, gap: 3 }}>
              <View style={styles.titleRow}>
                <Text style={styles.cardTitle}>Yumo</Text>
                <View style={[styles.tag, { backgroundColor: '#eef2ff' }]}>
                  <Ionicons name="lock-closed" size={10} color="#4338ca" />
                  <Text style={[styles.tagText, { color: '#4338ca' }]}>Private</Text>
                </View>
              </View>
              <Text style={styles.cardText}>
                Your personal shopping assistant - products, orders, returns and more.
              </Text>
            </View>
          </View>
          <Text style={styles.miniLabel}>Try asking</Text>
          <View style={styles.starters}>
            {AI_STARTERS.map((q) => (
              <Pressable
                key={q}
                onPress={() => openAi(q)}
                style={({ pressed }) => [styles.starter, pressed && styles.pressed]}
              >
                <Ionicons name="chatbubble-ellipses-outline" size={13} color="#6d28d9" />
                <Text style={styles.starterText}>{q}</Text>
              </Pressable>
            ))}
          </View>
          <Pressable
            onPress={() => openAi()}
            style={({ pressed }) => [
              styles.cta,
              { experimental_backgroundImage: AI_BUTTON },
              pressed && styles.pressed,
            ]}
            accessibilityRole="button"
          >
            <Text style={styles.ctaText}>Start a chat</Text>
            <Ionicons name="arrow-forward" size={17} color={colors.white} />
          </Pressable>
        </Animated.View>

        {/* YouFind Bot */}
        <Animated.View
          entering={FadeInDown.delay(220).duration(380).reduceMotion(RM)}
          style={[styles.card, { padding: 0, overflow: 'hidden' }]}
        >
          <View style={[styles.liveStrip, { experimental_backgroundImage: LIVE_STRIP }]}>
            <LiveDot />
            <Text style={styles.liveStripText}>LIVE NOW</Text>
            <Text style={styles.liveCount}>
              {today != null ? `${today} ${today === 1 ? 'question' : 'questions'} today` : ' '}
            </Text>
          </View>
          <View style={styles.liveBody}>
            <View style={styles.cardHead}>
              <View style={styles.liveIcon}>
                <Ionicons name="search" size={24} color={colors.white} />
                <View style={styles.liveIconBadge}>
                  <Ionicons name="people" size={10} color="#047857" />
                </View>
              </View>
              <View style={{ flex: 1, gap: 3 }}>
                <Text style={styles.cardTitle}>YouFind Bot</Text>
                <Text style={styles.cardText}>
                  Ask for any product - our bot replies to everyone in the room.
                </Text>
              </View>
            </View>

            {recent.length > 0 ? (
              <View style={styles.ticker}>
                <Text style={styles.miniLabel}>Asked just now</Text>
                {recent.map((m) => (
                  <View key={m.id} style={styles.tick}>
                    <ChatAvatar name={m.name} size={26} />
                    <Text style={styles.tickText} numberOfLines={1}>
                      <Text style={styles.tickName}>{m.mine ? 'You' : m.name}</Text> asked for “
                      {m.text}”
                    </Text>
                    <View
                      style={[
                        styles.pill,
                        m.result === 'FOUND' ? styles.pillFound : styles.pillMissing,
                      ]}
                    >
                      <Ionicons
                        name={m.result === 'FOUND' ? 'checkmark' : 'time-outline'}
                        size={10}
                        color={m.result === 'FOUND' ? '#047857' : '#b45309'}
                      />
                      <Text
                        style={[
                          styles.pillText,
                          { color: m.result === 'FOUND' ? '#047857' : '#b45309' },
                        ]}
                      >
                        {m.result === 'FOUND' ? `${m.found} found` : 'Restock'}
                      </Text>
                    </View>
                  </View>
                ))}
              </View>
            ) : null}

            <Pressable
              onPress={openLive}
              style={({ pressed }) => [
                styles.cta,
                { experimental_backgroundImage: LIVE_BUTTON },
                pressed && styles.pressed,
              ]}
              accessibilityRole="button"
            >
              <Ionicons name="chatbubbles" size={17} color={colors.white} />
              <Text style={styles.ctaText}>Ask the room</Text>
            </Pressable>
          </View>
        </Animated.View>

        {/* How it works */}
        <Animated.View entering={FadeInDown.delay(300).duration(380).reduceMotion(RM)}>
          <Text style={styles.sectionTitle}>How the live room works</Text>
          <View style={styles.steps}>
            {STEPS.map((s, i) => (
              <View key={s.title} style={styles.step}>
                <View style={styles.stepIcon}>
                  <Ionicons name={s.icon} size={20} color={BRAND} />
                  <View style={styles.stepNum}>
                    <Text style={styles.stepNumText}>{i + 1}</Text>
                  </View>
                </View>
                <Text style={styles.stepTitle}>{s.title}</Text>
                <Text style={styles.stepText}>{s.text}</Text>
              </View>
            ))}
          </View>
        </Animated.View>

        <View style={styles.note}>
          <Ionicons name="shield-checkmark" size={18} color={BRAND} />
          <Text style={styles.noteText}>
            Safe by design: only product names are allowed in the live room, shoppers can&apos;t
            message each other, and only your first name is shown.
          </Text>
        </View>
      </View>
    </ScrollView>
  );
}

/** A softly pulsing "live" dot. */
function LiveDot() {
  const pulse = useSharedValue(0);
  useEffect(() => {
    pulse.value = withRepeat(
      withTiming(1, { duration: 900, easing: Easing.inOut(Easing.quad), reduceMotion: RM }),
      -1,
      true,
    );
  }, [pulse]);
  const ring = useAnimatedStyle(() => ({
    opacity: 0.6 - pulse.value * 0.6,
    transform: [{ scale: 1 + pulse.value * 1.2 }],
  }));
  return (
    <View style={styles.dotWrap}>
      <Animated.View style={[styles.dotRing, ring]} />
      <View style={styles.dot} />
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: '#f3f5f9' },
  hero: {
    paddingHorizontal: space.lg,
    paddingBottom: 56,
    gap: 18,
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
    overflow: 'hidden',
    experimental_backgroundImage: HERO,
  },
  blob: { position: 'absolute', borderRadius: 999 },
  blobA: {
    width: 220,
    height: 220,
    right: -70,
    top: -40,
    backgroundColor: 'rgba(56,189,248,0.18)',
  },
  blobB: {
    width: 160,
    height: 160,
    left: -50,
    bottom: -60,
    backgroundColor: 'rgba(16,185,129,0.18)',
  },
  back: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(255,255,255,0.14)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  kicker: {
    fontFamily: font.uiBold,
    fontSize: 11.5,
    letterSpacing: 1.6,
    color: '#7dd3fc',
  },
  heroTitle: {
    fontFamily: font.uiBold,
    fontSize: 28,
    letterSpacing: -0.4,
    color: colors.white,
    marginTop: 4,
  },
  heroText: {
    fontFamily: font.body,
    fontSize: 14.5,
    lineHeight: 21,
    color: 'rgba(255,255,255,0.82)',
    marginTop: 6,
  },
  heroSearch: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: colors.white,
    borderRadius: 16,
    paddingLeft: 16,
    paddingRight: 6,
    height: 52,
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 5,
  },
  heroSearchText: { flex: 1, fontFamily: font.uiMedium, fontSize: 14.5, color: colors.text.muted },
  heroSearchGo: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: BRAND,
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: { paddingHorizontal: space.lg, marginTop: -30, gap: 16 },
  card: {
    backgroundColor: colors.white,
    borderRadius: 22,
    padding: 16,
    gap: 12,
    shadowColor: '#0b1b3f',
    shadowOpacity: 0.08,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3,
  },
  pressed: { opacity: 0.9, transform: [{ scale: 0.985 }] },
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  cardTitle: { fontFamily: font.uiBold, fontSize: 17.5, color: colors.heading },
  cardText: { fontFamily: font.body, fontSize: 13, lineHeight: 19, color: colors.text.body },
  tag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  tagText: { fontFamily: font.uiBold, fontSize: 10.5, letterSpacing: 0.3 },
  miniLabel: {
    fontFamily: font.uiBold,
    fontSize: 11,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    color: colors.text.muted,
  },
  starters: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: -4 },
  starter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#f5f3ff',
    borderWidth: 1,
    borderColor: '#e9d5ff',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  starterText: { fontFamily: font.uiSemibold, fontSize: 12.5, color: '#5b21b6' },
  cta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 48,
    borderRadius: 14,
  },
  ctaText: { fontFamily: font.uiBold, fontSize: 15, color: colors.white },
  liveStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 9,
  },
  liveStripText: {
    fontFamily: font.uiBold,
    fontSize: 11.5,
    letterSpacing: 1.2,
    color: colors.white,
  },
  liveCount: {
    flex: 1,
    textAlign: 'right',
    fontFamily: font.uiSemibold,
    fontSize: 12,
    color: 'rgba(255,255,255,0.9)',
  },
  dotWrap: { width: 10, height: 10, alignItems: 'center', justifyContent: 'center' },
  dotRing: {
    position: 'absolute',
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#a7f3d0',
  },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#ecfdf5' },
  liveBody: { padding: 16, gap: 12 },
  liveIcon: {
    width: 58,
    height: 58,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    experimental_backgroundImage: LIVE_BUTTON,
  },
  liveIconBadge: {
    position: 'absolute',
    right: -4,
    bottom: -4,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#d1fae5',
    borderWidth: 2,
    borderColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ticker: {
    backgroundColor: '#f6faf8',
    borderRadius: 14,
    padding: 12,
    gap: 9,
  },
  tick: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  tickAvatar: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#dbe6fb',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tickAvatarText: { fontFamily: font.uiBold, fontSize: 11, color: BRAND },
  tickText: { flex: 1, fontFamily: font.body, fontSize: 12.5, color: colors.text.body },
  tickName: { fontFamily: font.uiBold, color: colors.heading },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    borderRadius: 999,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  pillFound: { backgroundColor: '#d1fae5' },
  pillMissing: { backgroundColor: '#fef3c7' },
  pillText: { fontFamily: font.uiBold, fontSize: 10.5 },
  sectionTitle: {
    fontFamily: font.uiBold,
    fontSize: 16,
    color: colors.heading,
    marginBottom: 10,
    marginTop: 4,
  },
  steps: { flexDirection: 'row', gap: 10 },
  step: {
    flex: 1,
    backgroundColor: colors.white,
    borderRadius: 16,
    padding: 12,
    alignItems: 'center',
    gap: 4,
    borderWidth: 1,
    borderColor: '#e8edf5',
  },
  stepIcon: {
    width: 42,
    height: 42,
    borderRadius: 13,
    backgroundColor: '#eef4ff',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  stepNum: {
    position: 'absolute',
    top: -6,
    right: -6,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: BRAND,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepNumText: { fontFamily: font.uiBold, fontSize: 10, color: colors.white },
  stepTitle: { fontFamily: font.uiBold, fontSize: 13, color: colors.heading, textAlign: 'center' },
  stepText: {
    fontFamily: font.body,
    fontSize: 11.5,
    lineHeight: 15,
    color: colors.text.muted,
    textAlign: 'center',
  },
  note: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'flex-start',
    backgroundColor: '#eef4ff',
    borderRadius: 16,
    padding: 14,
  },
  noteText: {
    flex: 1,
    fontFamily: font.body,
    fontSize: 12.5,
    lineHeight: 18,
    color: colors.text.body,
  },
});
