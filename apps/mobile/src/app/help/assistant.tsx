import { useEffect, useRef, useState } from 'react';
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
import { Ionicons } from '@expo/vector-icons';
import { Stack, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import Animated, {
  Easing,
  FadeIn,
  FadeInDown,
  FadeInUp,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import {
  ApiError,
  HELP_TOPIC_LABELS,
  assistantTranscript,
  type AssistantEscalation,
  type AssistantTurn,
} from '@youmart/shared-client';
import { api } from '@/lib/api';
import { useSession } from '@/stores/session';
import { colors, font, space } from '@/theme';

// v1.17 YouMart AI: a premium chat with the store assistant (Claude). Opening plays an intro (a
// glowing orb that resolves into the chat); every answer "thinks" first (animated orb + shimmering
// steps, never instant), then types itself out word by word. When it can't solve something it
// hands over with a prefilled "Send to support" card (help request + this chat attached).

const BRAND = colors.brand.DEFAULT;
const HERO_GRADIENT = 'linear-gradient(145deg, #0b1b3f 0%, #0142aa 55%, #3b6fe0 100%)';
const ORB_GRADIENT = 'linear-gradient(135deg, #60a5fa 0%, #0142aa 45%, #7c3aed 100%)';
const USER_GRADIENT = 'linear-gradient(135deg, #0142aa 0%, #2f6ae8 100%)';

const SUGGESTIONS: { icon: keyof typeof Ionicons.glyphMap; text: string }[] = [
  { icon: 'cube-outline', text: 'Where is my order?' },
  { icon: 'return-down-back-outline', text: 'How do I return an item?' },
  { icon: 'cash-outline', text: 'Is Cash on Delivery available?' },
  { icon: 'wallet-outline', text: 'When will I get my refund?' },
  { icon: 'bicycle-outline', text: 'Is there a delivery charge?' },
  { icon: 'pricetags-outline', text: 'How do coupons work?' },
];

/** Never answer instantly - a short, natural think time even when the model is fast. */
const MIN_THINK_MS = 1900;
const EXTRA_THINK_MS = 900;
/** Give up (and say so) if no answer arrives - e.g. the phone can't reach the server. */
const REPLY_TIMEOUT_MS = 45_000;
/** Typewriter: two words every this many ms. */
const TICK_MS = 55;

interface Bubble extends AssistantTurn {
  id: number;
  escalate?: AssistantEscalation | null;
  error?: boolean;
  /** Typewriter: tokens shown so far (undefined = fully shown). */
  shown?: number;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export default function AssistantScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const session = useSession();
  const signedIn = session.status === 'authenticated';
  const firstName =
    session.status === 'authenticated' ? (session.user.name?.split(' ')[0] ?? '') : '';
  const [intro, setIntro] = useState(true);
  const [bubbles, setBubbles] = useState<Bubble[]>([]);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [remaining, setRemaining] = useState<number | null>(null);
  const scroll = useRef<ScrollView>(null);
  const nextId = useRef(1);
  const typing = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(
    () => () => {
      if (typing.current) clearInterval(typing.current);
    },
    [],
  );

  useEffect(() => {
    const t = setTimeout(() => scroll.current?.scrollToEnd({ animated: true }), 50);
    return () => clearTimeout(t);
  }, [bubbles, busy]);

  /** Reveals a reply a couple of words at a time (Claude / ChatGPT style). */
  const typeOut = (id: number, tokens: number) => {
    if (typing.current) clearInterval(typing.current);
    let n = 0;
    typing.current = setInterval(() => {
      n = Math.min(tokens, n + 4); // a token is a word or the space after it
      const done = n >= tokens;
      setBubbles((all) =>
        all.map((b) => (b.id === id ? { ...b, shown: done ? undefined : n } : b)),
      );
      if (done && typing.current) {
        clearInterval(typing.current);
        typing.current = null;
      }
    }, TICK_MS);
  };

  const ask = async (question: string) => {
    const q = question.trim();
    if (!q || busy) return;
    setText('');
    void Haptics.selectionAsync().catch(() => undefined);
    const turns: AssistantTurn[] = [
      ...bubbles
        .filter((b) => !b.error)
        .map(({ role, text: t }) => ({ role, text: t.slice(0, 1500) })),
      { role: 'user' as const, text: q.slice(0, 1500) },
    ].slice(-24);
    setBubbles((b) => [...b, { id: nextId.current++, role: 'user', text: q }]);
    setBusy(true);
    const started = Date.now();
    let next: Bubble;
    try {
      const res = await Promise.race([
        api.support.askAssistant(turns),
        sleep(REPLY_TIMEOUT_MS).then(() => {
          throw new Error('timeout');
        }),
      ]);
      setRemaining(res.remaining);
      next = { id: nextId.current++, role: 'assistant', text: res.reply, escalate: res.escalate };
    } catch (err) {
      next = {
        id: nextId.current++,
        role: 'assistant',
        error: true,
        text:
          err instanceof ApiError && (err.status === 429 || err.status === 503)
            ? err.message
            : "Sorry, I couldn't reply just now. Please check your connection and try again.",
      };
    }
    const wait = MIN_THINK_MS + Math.random() * EXTRA_THINK_MS - (Date.now() - started);
    if (wait > 0) await sleep(wait);
    const tokens = next.text.split(/(\s+)/).length;
    setBubbles((b) => [...b, { ...next, shown: next.error ? undefined : 0 }]);
    setBusy(false);
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
    if (!next.error) typeOut(next.id, tokens);
  };

  const transcript = () =>
    assistantTranscript(
      bubbles.filter((b) => !b.error).map(({ role, text: t }) => ({ role, text: t })),
    );

  const empty = bubbles.length === 0;

  return (
    <View style={styles.screen}>
      <Stack.Screen options={{ headerShown: false }} />

      {/* Header: gradient bar with the AI's identity */}
      <View style={[styles.header, { paddingTop: insets.top + 6 }]}>
        <Pressable onPress={() => router.back()} hitSlop={10} style={styles.back}>
          <Ionicons name="chevron-back" size={24} color={colors.white} />
        </Pressable>
        <Orb size={34} />
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>YouMart AI</Text>
          <View style={styles.statusRow}>
            <View style={styles.online} />
            <Text style={styles.headerSub}>Your shopping assistant · online</Text>
          </View>
        </View>
        {!empty ? (
          <Pressable
            onPress={() => {
              if (typing.current) clearInterval(typing.current);
              setBubbles([]);
            }}
            hitSlop={10}
            accessibilityLabel="New chat"
            style={styles.newChat}
          >
            <Ionicons name="create-outline" size={19} color={colors.white} />
          </Pressable>
        ) : null}
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          ref={scroll}
          contentContainerStyle={[styles.list, empty && styles.listEmpty]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {empty ? (
            <Animated.View
              entering={FadeInDown.delay(intro ? 1500 : 0).duration(420)}
              style={styles.welcome}
            >
              <Orb size={64} glow />
              <Text style={styles.hello}>{firstName ? `Hi ${firstName} 👋` : 'Hi there 👋'}</Text>
              <Text style={styles.helloSub}>How can I help you today?</Text>
              <View style={styles.grid}>
                {SUGGESTIONS.map((s, i) => (
                  <Animated.View
                    key={s.text}
                    entering={FadeInUp.delay((intro ? 1650 : 100) + i * 70).duration(320)}
                    style={styles.gridCell}
                  >
                    <Pressable
                      onPress={() => void ask(s.text)}
                      style={({ pressed }) => [styles.suggestion, pressed && styles.pressed]}
                    >
                      <View style={styles.suggestionIcon}>
                        <Ionicons name={s.icon} size={17} color={BRAND} />
                      </View>
                      <Text style={styles.suggestionText}>{s.text}</Text>
                    </Pressable>
                  </Animated.View>
                ))}
              </View>
              {!signedIn ? (
                <Pressable onPress={() => router.push('/auth/login')} style={styles.signIn}>
                  <Ionicons name="lock-closed-outline" size={13} color={BRAND} />
                  <Text style={styles.signInText}>Sign in so I can look up your orders</Text>
                </Pressable>
              ) : null}
            </Animated.View>
          ) : null}

          {bubbles.map((b) =>
            b.role === 'user' ? (
              <Animated.View key={b.id} entering={FadeInUp.duration(200)} style={styles.userRow}>
                <View style={styles.userBubble}>
                  <Text style={styles.userText}>{b.text}</Text>
                </View>
              </Animated.View>
            ) : (
              <Animated.View key={b.id} entering={FadeIn.duration(220)} style={styles.aiBlock}>
                <View style={styles.aiHead}>
                  <Orb size={22} error={b.error} />
                  <Text style={styles.aiName}>YouMart AI</Text>
                </View>
                <AiText text={b.text} shown={b.shown} error={b.error} />
                {b.escalate && b.shown === undefined ? (
                  <Animated.View entering={FadeInUp.duration(300)}>
                    <HandoverCard
                      escalation={b.escalate}
                      signedIn={signedIn}
                      transcript={transcript}
                      onSignIn={() => router.push('/auth/login')}
                    />
                  </Animated.View>
                ) : null}
              </Animated.View>
            ),
          )}
          {busy ? <Thinking /> : null}
        </ScrollView>

        <View style={[styles.composer, { paddingBottom: Math.max(insets.bottom, 10) }]}>
          <View style={styles.inputWrap}>
            <TextInput
              value={text}
              onChangeText={setText}
              placeholder="Ask YouMart AI anything…"
              placeholderTextColor={colors.text.placeholder}
              style={styles.input}
              multiline
              maxLength={1500}
              editable={!busy}
            />
            <Pressable
              onPress={() => void ask(text)}
              disabled={busy || !text.trim()}
              style={[styles.send, (busy || !text.trim()) && styles.sendOff]}
              accessibilityLabel="Send"
            >
              {busy ? (
                <ActivityIndicator size="small" color={colors.white} />
              ) : (
                <Ionicons name="arrow-up" size={20} color={colors.white} />
              )}
            </Pressable>
          </View>
          <Text style={styles.disclaimer}>
            {remaining !== null && remaining <= 5
              ? `${remaining} questions left today`
              : 'YouMart AI can make mistakes. Check important details in My Orders.'}
          </Text>
        </View>
      </KeyboardAvoidingView>

      {intro ? <IntroOverlay onDone={() => setIntro(false)} /> : null}
    </View>
  );
}

/** The AI's mark: a gradient orb with a sparkle (optionally with a breathing glow). */
function Orb({ size, glow, error }: { size: number; glow?: boolean; error?: boolean }) {
  const pulse = useSharedValue(0);
  useEffect(() => {
    if (!glow) return;
    pulse.value = withRepeat(
      withTiming(1, { duration: 1800, easing: Easing.inOut(Easing.quad) }),
      -1,
      true,
    );
  }, [glow, pulse]);
  const halo = useAnimatedStyle(() => ({
    opacity: 0.22 + pulse.value * 0.22,
    transform: [{ scale: 1.15 + pulse.value * 0.2 }],
  }));
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      {glow ? (
        <Animated.View
          style={[
            {
              position: 'absolute',
              width: size,
              height: size,
              borderRadius: size / 2,
              backgroundColor: '#3b82f6',
            },
            halo,
          ]}
        />
      ) : null}
      <View
        style={{
          width: size,
          height: size,
          borderRadius: size / 2,
          alignItems: 'center',
          justifyContent: 'center',
          experimental_backgroundImage: error
            ? 'linear-gradient(135deg, #f87171 0%, #b91c1c 100%)'
            : ORB_GRADIENT,
        }}
      >
        <Ionicons name={error ? 'alert' : 'sparkles'} size={size * 0.5} color={colors.white} />
      </View>
    </View>
  );
}

/** Opening animation: the orb blooms with a ripple, the name rises in, then everything lifts away. */
function IntroOverlay({ onDone }: { onDone: () => void }) {
  const orb = useSharedValue(0);
  const ring = useSharedValue(0);
  const title = useSharedValue(0);
  const leave = useSharedValue(0);

  useEffect(() => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Soft).catch(() => undefined);
    orb.value = withSpring(1, { damping: 11, stiffness: 120 });
    ring.value = withDelay(
      250,
      withRepeat(withTiming(1, { duration: 1100, easing: Easing.out(Easing.quad) }), 2, false),
    );
    title.value = withDelay(480, withTiming(1, { duration: 450 }));
    leave.value = withDelay(
      1450,
      withTiming(1, { duration: 420, easing: Easing.in(Easing.quad) }, (done) => {
        if (done) runOnJS(onDone)();
      }),
    );
  }, [orb, ring, title, leave, onDone]);

  const wrap = useAnimatedStyle(() => ({
    opacity: 1 - leave.value,
    transform: [{ translateY: -leave.value * 40 }],
  }));
  const orbStyle = useAnimatedStyle(() => ({
    opacity: Math.min(1, orb.value * 1.5),
    transform: [{ scale: 0.3 + orb.value * 0.7 }, { rotate: `${(1 - orb.value) * -120}deg` }],
  }));
  const ringStyle = useAnimatedStyle(() => ({
    opacity: (1 - ring.value) * 0.6,
    transform: [{ scale: 1 + ring.value * 1.6 }],
  }));
  const titleStyle = useAnimatedStyle(() => ({
    opacity: title.value,
    transform: [{ translateY: (1 - title.value) * 14 }],
  }));

  return (
    <Animated.View style={[styles.intro, wrap]} pointerEvents="none">
      <View style={styles.introCenter}>
        <Animated.View style={[styles.introRing, ringStyle]} />
        <Animated.View style={orbStyle}>
          <Orb size={96} />
        </Animated.View>
      </View>
      <Animated.View style={[{ alignItems: 'center', gap: 6 }, titleStyle]}>
        <Text style={styles.introTitle}>YouMart AI</Text>
        <Text style={styles.introSub}>Smart help for everything you shop</Text>
      </Animated.View>
    </Animated.View>
  );
}

/** Loading state while the AI answers: a spinning ring around the orb + three pulsing dots. */
function Thinking() {
  const spin = useSharedValue(0);
  useEffect(() => {
    spin.value = withRepeat(withTiming(1, { duration: 1200, easing: Easing.linear }), -1, false);
  }, [spin]);
  const ringStyle = useAnimatedStyle(() => ({ transform: [{ rotate: `${spin.value * 360}deg` }] }));

  return (
    <Animated.View entering={FadeIn.duration(200)} style={styles.thinking}>
      <View style={styles.thinkingOrb}>
        <Animated.View style={[styles.thinkingRing, ringStyle]} />
        <Orb size={22} />
      </View>
      <View style={styles.dots}>
        {[0, 1, 2].map((i) => (
          <Dot key={i} delay={i * 160} />
        ))}
      </View>
    </Animated.View>
  );
}

function Dot({ delay }: { delay: number }) {
  const v = useSharedValue(0);
  useEffect(() => {
    v.value = withDelay(
      delay,
      withRepeat(withTiming(1, { duration: 480, easing: Easing.inOut(Easing.quad) }), -1, true),
    );
  }, [v, delay]);
  const style = useAnimatedStyle(() => ({
    opacity: 0.3 + v.value * 0.7,
    transform: [{ translateY: -v.value * 4 }],
  }));
  return <Animated.View style={[styles.dot, style]} />;
}

/** AI answer text: **bold**, "- " bullets, and the typewriter reveal (`shown` tokens). */
function AiText({ text, shown, error }: { text: string; shown?: number; error?: boolean }) {
  const visible = shown === undefined ? text : text.split(/(\s+)/).slice(0, shown).join('');
  const lines = visible.split('\n');
  return (
    <View style={[styles.aiCard, error && styles.aiCardError]}>
      {lines.map((line, i) => {
        if (!line.trim()) return <View key={i} style={{ height: 7 }} />;
        const bullet = /^\s*[-*•]\s+/.test(line);
        const body = line.replace(/^\s*[-*•]\s+/, '');
        const last = i === lines.length - 1;
        return (
          <View key={i} style={bullet ? styles.bulletRow : undefined}>
            {bullet ? <View style={styles.bulletDot} /> : null}
            <Text style={[styles.aiText, bullet && { flex: 1 }]}>
              {body.split(/(\*\*[^*]+\*\*)/g).map((part, j) =>
                /^\*\*[^*]+\*\*$/.test(part) ? (
                  <Text key={j} style={styles.bold}>
                    {part.slice(2, -2)}
                  </Text>
                ) : (
                  part.replace(/\*\*/g, '')
                ),
              )}
              {shown !== undefined && last ? <Text style={styles.cursor}> ▍</Text> : null}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

/** "Send to our support team" - prefilled from the AI's handover; becomes a help request. */
function HandoverCard({
  escalation,
  signedIn,
  transcript,
  onSignIn,
}: {
  escalation: AssistantEscalation;
  signedIn: boolean;
  transcript: () => string;
  onSignIn: () => void;
}) {
  const [message, setMessage] = useState(escalation.summary);
  const [state, setState] = useState<'idle' | 'sending' | 'sent'>('idle');
  const [reference, setReference] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const send = async () => {
    if (message.trim().length < 10) {
      setError('Please describe the problem in a few more words.');
      return;
    }
    setState('sending');
    setError(null);
    try {
      const orderId = escalation.orderNumber
        ? await api.orders
            .get(escalation.orderNumber)
            .then((o) => o.orderId)
            .catch(() => undefined)
        : undefined;
      const ticket = await api.support.createTicket({
        topic: escalation.topic,
        message: message.trim(),
        ...(orderId ? { orderId } : {}),
        transcript: transcript(),
      });
      setReference(ticket.reference);
      setState('sent');
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(
        () => undefined,
      );
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not send. Please try again.');
      setState('idle');
    }
  };

  if (state === 'sent') {
    return (
      <View style={[styles.card, styles.cardDone]}>
        <View style={styles.doneIcon}>
          <Ionicons name="checkmark" size={18} color={colors.white} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.cardTitle}>Sent to our support team</Text>
          <Text style={styles.cardText}>
            Reference {reference}. We&apos;ll reply soon - you&apos;ll see it in Alerts and under My
            help requests.
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.card}>
      <View style={styles.cardHead}>
        <View style={styles.cardIcon}>
          <Ionicons name="headset" size={16} color={colors.white} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.cardTitle}>Send to our support team</Text>
          <Text style={styles.cardTopic}>
            {HELP_TOPIC_LABELS[escalation.topic]}
            {escalation.orderNumber ? ` · ${escalation.orderNumber}` : ''}
          </Text>
        </View>
      </View>
      <TextInput
        value={message}
        onChangeText={setMessage}
        multiline
        maxLength={2000}
        style={styles.cardInput}
        editable={signedIn && state === 'idle'}
      />
      {error ? <Text style={styles.cardError}>{error}</Text> : null}
      <Pressable
        onPress={signedIn ? () => void send() : onSignIn}
        disabled={state === 'sending'}
        style={({ pressed }) => [styles.cardBtn, pressed && { opacity: 0.88 }]}
      >
        {state === 'sending' ? (
          <ActivityIndicator size="small" color={colors.white} />
        ) : (
          <>
            <Ionicons name={signedIn ? 'send' : 'log-in-outline'} size={15} color={colors.white} />
            <Text style={styles.cardBtnText}>
              {signedIn ? 'Send to support' : 'Sign in to send'}
            </Text>
          </>
        )}
      </Pressable>
      <Text style={styles.cardNote}>This chat is attached so our team sees what you asked.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#f4f7fd' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: space.md,
    paddingBottom: 12,
    experimental_backgroundImage: HERO_GRADIENT,
  },
  back: { width: 32, alignItems: 'center' },
  headerTitle: { fontFamily: font.uiBold, fontSize: 17, color: colors.white },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 1 },
  online: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#4ade80' },
  headerSub: { fontFamily: font.body, fontSize: 11.5, color: 'rgba(255,255,255,0.85)' },
  newChat: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  list: { padding: space.lg, gap: 16, paddingBottom: space.xl },
  listEmpty: { flexGrow: 1, justifyContent: 'center' },
  welcome: { alignItems: 'center', gap: 6 },
  hello: { fontFamily: font.uiBold, fontSize: 24, color: colors.heading, marginTop: 10 },
  helloSub: { fontFamily: font.uiMedium, fontSize: 15, color: colors.text.muted, marginBottom: 14 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, width: '100%' },
  gridCell: { width: '48%', flexGrow: 1 },
  suggestion: {
    backgroundColor: colors.white,
    borderRadius: 16,
    padding: 12,
    gap: 8,
    borderWidth: 1,
    borderColor: '#e2e9f6',
    shadowColor: BRAND,
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 1,
    minHeight: 86,
  },
  pressed: { opacity: 0.85, transform: [{ scale: 0.98 }] },
  suggestionIcon: {
    width: 30,
    height: 30,
    borderRadius: 10,
    backgroundColor: '#eaf1ff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  suggestionText: {
    fontFamily: font.uiSemibold,
    fontSize: 13,
    color: colors.heading,
    lineHeight: 17,
  },
  signIn: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 14 },
  signInText: { fontFamily: font.uiSemibold, fontSize: 12.5, color: BRAND },
  userRow: { alignItems: 'flex-end' },
  userBubble: {
    maxWidth: '84%',
    borderRadius: 20,
    borderBottomRightRadius: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
    experimental_backgroundImage: USER_GRADIENT,
    shadowColor: BRAND,
    shadowOpacity: 0.2,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
  },
  userText: { fontFamily: font.body, fontSize: 14.5, lineHeight: 21, color: colors.white },
  aiBlock: { gap: 7 },
  aiHead: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  aiName: { fontFamily: font.uiBold, fontSize: 12.5, color: colors.heading },
  aiCard: {
    backgroundColor: colors.white,
    borderRadius: 18,
    borderTopLeftRadius: 6,
    paddingHorizontal: 14,
    paddingVertical: 11,
    gap: 3,
    borderWidth: 1,
    borderColor: '#e2e9f6',
  },
  aiCardError: { borderColor: '#f5c6c6', backgroundColor: '#fff7f7' },
  aiText: { fontFamily: font.body, fontSize: 14.5, lineHeight: 22, color: colors.text.strong },
  bold: { fontFamily: font.uiBold, color: colors.heading },
  cursor: { color: BRAND, fontFamily: font.uiBold },
  bulletRow: { flexDirection: 'row', gap: 8, alignItems: 'flex-start' },
  bulletDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: BRAND, marginTop: 8 },
  thinking: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 4 },
  thinkingOrb: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center' },
  thinkingRing: {
    position: 'absolute',
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 2.5,
    borderColor: '#d6e3ff',
    borderTopColor: BRAND,
    borderRightColor: '#7c3aed',
  },
  dots: { flexDirection: 'row', gap: 5, alignItems: 'center', height: 20 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: BRAND },
  composer: {
    paddingHorizontal: space.md,
    paddingTop: 8,
    backgroundColor: '#f4f7fd',
    gap: 6,
  },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    backgroundColor: colors.white,
    borderRadius: 26,
    borderWidth: 1,
    borderColor: '#dbe4f3',
    paddingLeft: 16,
    padding: 5,
    shadowColor: BRAND,
    shadowOpacity: 0.08,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  input: {
    flex: 1,
    maxHeight: 110,
    minHeight: 40,
    paddingTop: 10,
    paddingBottom: 10,
    fontFamily: font.body,
    fontSize: 15,
    color: colors.text.strong,
  },
  send: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    experimental_backgroundImage: USER_GRADIENT,
  },
  sendOff: { opacity: 0.4 },
  disclaimer: {
    textAlign: 'center',
    fontFamily: font.body,
    fontSize: 10.5,
    color: colors.text.muted,
  },
  intro: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 26,
    experimental_backgroundImage: HERO_GRADIENT,
  },
  introCenter: { width: 140, height: 140, alignItems: 'center', justifyContent: 'center' },
  introRing: {
    position: 'absolute',
    width: 110,
    height: 110,
    borderRadius: 55,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.6)',
  },
  introTitle: { fontFamily: font.uiBold, fontSize: 28, color: colors.white, letterSpacing: 0.3 },
  introSub: { fontFamily: font.uiMedium, fontSize: 14, color: 'rgba(255,255,255,0.8)' },
  card: {
    backgroundColor: colors.white,
    borderRadius: 18,
    padding: 14,
    gap: 10,
    borderWidth: 1.5,
    borderColor: '#c7d7f5',
    shadowColor: BRAND,
    shadowOpacity: 0.1,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  cardDone: { flexDirection: 'row', alignItems: 'center', borderColor: '#86efac', gap: 12 },
  doneIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#16a34a',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  cardIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    experimental_backgroundImage: USER_GRADIENT,
  },
  cardTitle: { fontFamily: font.uiBold, fontSize: 14.5, color: colors.heading },
  cardTopic: { fontFamily: font.uiSemibold, fontSize: 12, color: BRAND, marginTop: 1 },
  cardText: { fontFamily: font.body, fontSize: 12.5, lineHeight: 18, color: colors.text.body },
  cardInput: {
    minHeight: 76,
    borderWidth: 1,
    borderColor: '#dbe4f3',
    borderRadius: 12,
    padding: 10,
    fontFamily: font.body,
    fontSize: 13.5,
    color: colors.text.strong,
    textAlignVertical: 'top',
    backgroundColor: '#f8faff',
  },
  cardError: { fontFamily: font.uiMedium, fontSize: 12, color: '#c62828' },
  cardBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    borderRadius: 12,
    paddingVertical: 11,
    experimental_backgroundImage: USER_GRADIENT,
  },
  cardBtnText: { fontFamily: font.uiBold, fontSize: 14, color: colors.white },
  cardNote: {
    fontFamily: font.body,
    fontSize: 11,
    color: colors.text.muted,
    textAlign: 'center',
  },
});
