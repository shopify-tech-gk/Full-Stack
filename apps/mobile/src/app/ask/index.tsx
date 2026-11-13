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

// v1.18 "Ask" - the bottom bar's centre button. A hero, then the two ways to ask, each with its own
// identity (v1.19): Yumo, a private 1:1 AI chat (deep violet, a chat preview and one-tap
// questions), and YouFind Bot, the public live room (light emerald, a live feed of what people are
// asking right now, how it works and its safety rules).

const RM = ReduceMotion.Never;
const HERO = 'linear-gradient(160deg, #071530 0%, #0b2a6f 60%, #0142aa 100%)';
// Yumo: private, personal - deep violet.
const YUMO_BG = 'linear-gradient(150deg, #1e1b4b 0%, #3b0f78 55%, #6d28d9 100%)';
const YUMO_INK = '#2e1065';
// YouFind Bot: public, live - emerald.
const ROOM = '#047857';
const ROOM_SOFT = '#ecfdf5';
const ROOM_LINE = '#a7f3d0';
const ROOM_BUTTON = 'linear-gradient(120deg, #047857 0%, #10b981 100%)';
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
  const askers = [...new Set(recent.map((m) => (m.mine ? 'You' : m.name)))].slice(0, 3);

  return (
    <ScrollView style={styles.page} contentContainerStyle={{ paddingBottom: 48 }}>
      {/* Hero: the two ways to ask, side by side */}
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
          <Text style={styles.heroTitle}>Two ways to get answers</Text>
          <Text style={styles.heroText}>
            Chat privately with Yumo, or ask the live room if we have it.
          </Text>
        </Animated.View>
        <Animated.View
          entering={FadeInDown.delay(90).duration(380).reduceMotion(RM)}
          style={styles.switcher}
        >
          <Pressable
            onPress={() => openAi()}
            style={({ pressed }) => [
              styles.switchBtn,
              styles.switchYumo,
              pressed && styles.pressed,
            ]}
            accessibilityRole="button"
            accessibilityLabel="Chat with Yumo"
          >
            <AiMark size={30} />
            <View style={{ flex: 1 }}>
              <Text style={styles.switchTitle}>Yumo</Text>
              <Text style={styles.switchSub}>Private AI chat</Text>
            </View>
          </Pressable>
          <Pressable
            onPress={openLive}
            style={({ pressed }) => [
              styles.switchBtn,
              styles.switchRoom,
              pressed && styles.pressed,
            ]}
            accessibilityRole="button"
            accessibilityLabel="Ask the YouFind Bot live room"
          >
            <View style={styles.switchRoomIcon}>
              <Ionicons name="people" size={16} color={colors.white} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.switchTitle, { color: '#064e3b' }]}>YouFind Bot</Text>
              <Text style={[styles.switchSub, { color: ROOM }]}>Live room</Text>
            </View>
          </Pressable>
        </Animated.View>
      </View>

      <View style={styles.body}>
        {/* ---------- Yumo: private 1:1 AI ---------- */}
        <Animated.View entering={FadeInDown.delay(140).duration(380).reduceMotion(RM)}>
          <View style={styles.sectionHead}>
            <Ionicons name="lock-closed" size={12} color="#6d28d9" />
            <Text style={[styles.sectionKicker, { color: '#6d28d9' }]}>
              JUST YOU · AI ASSISTANT
            </Text>
          </View>
          <View style={styles.yumo}>
            <View style={styles.yumoGlow} />
            <View style={styles.yumoHead}>
              <AiMark size={62} animated />
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={styles.yumoName}>Yumo</Text>
                <Text style={styles.yumoTag}>Your personal shopping assistant</Text>
              </View>
            </View>

            {/* A taste of the conversation */}
            <View style={styles.bubbleYumo}>
              <Text style={styles.bubbleText}>
                Hi! I can find products, track your orders and sort out returns. What do you need
                today?
              </Text>
            </View>
            <Text style={styles.yumoHint}>Tap to ask</Text>
            <View style={styles.replies}>
              {AI_STARTERS.map((q) => (
                <Pressable
                  key={q}
                  onPress={() => openAi(q)}
                  style={({ pressed }) => [styles.reply, pressed && styles.pressed]}
                >
                  <Text style={styles.replyText}>{q}</Text>
                </Pressable>
              ))}
            </View>

            <Pressable
              onPress={() => openAi()}
              style={({ pressed }) => [styles.yumoCta, pressed && styles.pressed]}
              accessibilityRole="button"
            >
              <Ionicons name="sparkles" size={16} color={YUMO_INK} />
              <Text style={styles.yumoCtaText}>Chat with Yumo</Text>
            </Pressable>
            <Text style={styles.yumoFoot}>Only you see this chat</Text>
          </View>
        </Animated.View>

        {/* ---------- YouFind Bot: the public live room ---------- */}
        <Animated.View
          entering={FadeInDown.delay(220).duration(380).reduceMotion(RM)}
          style={{ gap: 12 }}
        >
          <View style={[styles.sectionHead, { marginBottom: -2 }]}>
            <Ionicons name="globe-outline" size={12} color={ROOM} />
            <Text style={[styles.sectionKicker, { color: ROOM }]}>EVERYONE · LIVE ROOM</Text>
          </View>
          <View style={styles.room}>
            <View style={styles.roomHead}>
              <View style={styles.roomIcon}>
                <Ionicons name="search" size={22} color={colors.white} />
              </View>
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={styles.roomName}>YouFind Bot</Text>
                <Text style={styles.roomTag}>
                  Ask for any product - the bot answers in the room
                </Text>
              </View>
              <View style={styles.liveChip}>
                <LiveDot />
                <Text style={styles.liveChipText}>LIVE</Text>
              </View>
            </View>

            {/* Who's asking */}
            <View style={styles.crowd}>
              {askers.length > 0 ? (
                <View style={styles.faces}>
                  {askers.map((n, i) => (
                    <View key={n} style={[styles.face, i > 0 && { marginLeft: -9 }]}>
                      <ChatAvatar name={n} size={24} />
                    </View>
                  ))}
                </View>
              ) : (
                <Ionicons name="people" size={18} color={ROOM} />
              )}
              <Text style={styles.crowdText}>
                {today != null
                  ? `${today} ${today === 1 ? 'question' : 'questions'} asked today`
                  : 'Shoppers are asking right now'}
              </Text>
            </View>

            {/* The live feed */}
            {recent.length > 0 ? (
              <View style={styles.feed}>
                {recent.map((m) => (
                  <View key={m.id} style={styles.feedRow}>
                    <ChatAvatar name={m.name} size={28} />
                    <View style={{ flex: 1, gap: 4 }}>
                      <Text style={styles.feedAsk} numberOfLines={1}>
                        <Text style={styles.feedName}>{m.mine ? 'You' : m.name}</Text>
                        {'  '}“{m.text}”
                      </Text>
                      <View style={styles.botLine}>
                        <Ionicons name="return-down-forward" size={12} color="#94a3b8" />
                        <View
                          style={[
                            styles.pill,
                            m.result === 'FOUND' ? styles.pillFound : styles.pillMissing,
                          ]}
                        >
                          <Ionicons
                            name={m.result === 'FOUND' ? 'checkmark-circle' : 'time-outline'}
                            size={11}
                            color={m.result === 'FOUND' ? ROOM : '#b45309'}
                          />
                          <Text
                            style={[
                              styles.pillText,
                              { color: m.result === 'FOUND' ? ROOM : '#b45309' },
                            ]}
                          >
                            {m.result === 'FOUND'
                              ? `Bot found ${m.found} ${m.found === 1 ? 'match' : 'matches'}`
                              : 'Restock requested'}
                          </Text>
                        </View>
                      </View>
                    </View>
                  </View>
                ))}
              </View>
            ) : null}

            {/* Looks like the room's input; opens the room */}
            <Pressable
              onPress={openLive}
              style={({ pressed }) => [styles.roomInput, pressed && styles.pressed]}
              accessibilityRole="button"
              accessibilityLabel="Ask the room for a product"
            >
              <Text style={styles.roomInputText}>Which product are you looking for?</Text>
              <View style={styles.roomSend}>
                <Ionicons name="send" size={15} color={colors.white} />
              </View>
            </Pressable>
          </View>

          {/* How the room works */}
          <View style={styles.steps}>
            {STEPS.map((st, i) => (
              <View key={st.title} style={styles.step}>
                <View style={styles.stepIcon}>
                  <Ionicons name={st.icon} size={19} color={ROOM} />
                  <View style={styles.stepNum}>
                    <Text style={styles.stepNumText}>{i + 1}</Text>
                  </View>
                </View>
                <Text style={styles.stepTitle}>{st.title}</Text>
                <Text style={styles.stepText}>{st.text}</Text>
              </View>
            ))}
          </View>

          <View style={styles.note}>
            <Ionicons name="shield-checkmark" size={18} color={ROOM} />
            <Text style={styles.noteText}>
              Safe by design: only product names are allowed in the live room, shoppers can&apos;t
              message each other, and only your first name is shown.
            </Text>
          </View>
        </Animated.View>
      </View>
    </ScrollView>
  );
}

/** A softly pulsing "live" dot (emerald, for light backgrounds). */
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
  pressed: { opacity: 0.9, transform: [{ scale: 0.985 }] },
  // Hero
  hero: {
    paddingHorizontal: space.lg,
    paddingBottom: 22,
    gap: 16,
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
    overflow: 'hidden',
    backgroundColor: '#0b2a6f',
    experimental_backgroundImage: HERO,
  },
  blob: { position: 'absolute', borderRadius: 999 },
  blobA: {
    width: 220,
    height: 220,
    right: -70,
    top: -40,
    backgroundColor: 'rgba(168,85,247,0.18)',
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
  kicker: { fontFamily: font.uiBold, fontSize: 11.5, letterSpacing: 1.6, color: '#93c5fd' },
  heroTitle: {
    fontFamily: font.uiBold,
    fontSize: 26,
    letterSpacing: -0.4,
    color: colors.white,
    marginTop: 4,
  },
  heroText: {
    fontFamily: font.body,
    fontSize: 14,
    lineHeight: 20,
    color: 'rgba(255,255,255,0.82)',
    marginTop: 6,
  },
  switcher: { flexDirection: 'row', gap: 10 },
  switchBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    borderRadius: 16,
    paddingHorizontal: 11,
    paddingVertical: 11,
  },
  switchYumo: { backgroundColor: '#f5f3ff' },
  switchRoom: { backgroundColor: ROOM_SOFT },
  switchRoomIcon: {
    width: 30,
    height: 30,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: ROOM,
    experimental_backgroundImage: ROOM_BUTTON,
  },
  switchTitle: { fontFamily: font.uiBold, fontSize: 14, color: '#4c1d95' },
  switchSub: { fontFamily: font.uiMedium, fontSize: 11.5, color: '#6d28d9', marginTop: 1 },
  body: { paddingHorizontal: space.lg, marginTop: 22, gap: 26 },
  sectionHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 10,
    marginLeft: 2,
  },
  sectionKicker: { fontFamily: font.uiBold, fontSize: 11, letterSpacing: 1.2 },
  // Yumo (dark violet, conversational)
  yumo: {
    borderRadius: 24,
    padding: 18,
    gap: 12,
    overflow: 'hidden',
    backgroundColor: '#3b0f78',
    experimental_backgroundImage: YUMO_BG,
    shadowColor: '#4c1d95',
    shadowOpacity: 0.35,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 7,
  },
  yumoGlow: {
    position: 'absolute',
    width: 220,
    height: 220,
    borderRadius: 110,
    top: -110,
    right: -70,
    backgroundColor: 'rgba(236,72,153,0.22)',
  },
  yumoHead: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  yumoName: { fontFamily: font.uiBold, fontSize: 24, color: colors.white, letterSpacing: -0.3 },
  yumoTag: { fontFamily: font.body, fontSize: 13, color: '#ddd6fe' },
  bubbleYumo: {
    alignSelf: 'flex-start',
    maxWidth: '92%',
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.16)',
    borderRadius: 18,
    borderTopLeftRadius: 6,
    paddingHorizontal: 14,
    paddingVertical: 11,
  },
  bubbleText: { fontFamily: font.body, fontSize: 13.5, lineHeight: 20, color: '#f5f3ff' },
  yumoHint: {
    fontFamily: font.uiBold,
    fontSize: 10.5,
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: '#c4b5fd',
    alignSelf: 'flex-end',
  },
  replies: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-end',
    gap: 7,
    marginTop: -4,
  },
  reply: {
    backgroundColor: '#f5f3ff',
    borderRadius: 16,
    borderBottomRightRadius: 5,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  replyText: { fontFamily: font.uiSemibold, fontSize: 12.5, color: YUMO_INK },
  yumoCta: {
    marginTop: 4,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 48,
    borderRadius: 14,
    backgroundColor: colors.white,
  },
  yumoCtaText: { fontFamily: font.uiBold, fontSize: 15, color: YUMO_INK },
  yumoFoot: {
    textAlign: 'center',
    fontFamily: font.uiMedium,
    fontSize: 11.5,
    color: '#c4b5fd',
    marginTop: -4,
  },
  // YouFind Bot (light emerald, a live feed)
  room: {
    backgroundColor: colors.white,
    borderRadius: 24,
    borderWidth: 1.5,
    borderColor: ROOM_LINE,
    padding: 16,
    gap: 14,
  },
  roomHead: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  roomIcon: {
    width: 48,
    height: 48,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: ROOM,
    experimental_backgroundImage: ROOM_BUTTON,
  },
  roomName: { fontFamily: font.uiBold, fontSize: 18, color: '#064e3b' },
  roomTag: { fontFamily: font.body, fontSize: 12.5, lineHeight: 17, color: colors.text.body },
  liveChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: ROOM_SOFT,
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 4,
    alignSelf: 'flex-start',
  },
  liveChipText: { fontFamily: font.uiBold, fontSize: 10.5, letterSpacing: 1, color: ROOM },
  dotWrap: { width: 9, height: 9, alignItems: 'center', justifyContent: 'center' },
  dotRing: {
    position: 'absolute',
    width: 9,
    height: 9,
    borderRadius: 5,
    backgroundColor: '#34d399',
  },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#059669' },
  crowd: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: ROOM_SOFT,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  faces: { flexDirection: 'row' },
  face: { borderWidth: 2, borderColor: ROOM_SOFT, borderRadius: 14 },
  crowdText: { flex: 1, fontFamily: font.uiSemibold, fontSize: 12.5, color: '#065f46' },
  feed: { gap: 12 },
  feedRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  feedAsk: { fontFamily: font.body, fontSize: 13, color: colors.text.body },
  feedName: { fontFamily: font.uiBold, color: colors.heading },
  botLine: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  pillFound: { backgroundColor: '#d1fae5' },
  pillMissing: { backgroundColor: '#fef3c7' },
  pillText: { fontFamily: font.uiBold, fontSize: 11 },
  roomInput: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1.5,
    borderColor: ROOM_LINE,
    backgroundColor: '#f8fffb',
    borderRadius: 999,
    paddingLeft: 16,
    paddingRight: 5,
    height: 48,
  },
  roomInputText: { flex: 1, fontFamily: font.uiMedium, fontSize: 13.5, color: '#64748b' },
  roomSend: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: ROOM,
    experimental_backgroundImage: ROOM_BUTTON,
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
    borderColor: '#d1fae5',
  },
  stepIcon: {
    width: 42,
    height: 42,
    borderRadius: 13,
    backgroundColor: ROOM_SOFT,
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
    backgroundColor: ROOM,
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
    backgroundColor: ROOM_SOFT,
    borderRadius: 16,
    padding: 14,
  },
  noteText: {
    flex: 1,
    fontFamily: font.body,
    fontSize: 12.5,
    lineHeight: 18,
    color: '#065f46',
  },
});
