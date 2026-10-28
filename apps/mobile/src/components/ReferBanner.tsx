import { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import Animated, {
  Easing,
  ReduceMotion,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { api } from '@/lib/api';
import { shareReferralCode } from '@/lib/share';
import { useSession } from '@/stores/session';
import { font, space } from '@/theme';

// v1.17 Home "Refer & Earn" banner: the reward in one line (2.5% of a friend's ₹500+ orders, into
// the wallet after delivery - same rule as /refer), the shopper's own code with copy, and Invite
// (the share sheet). Guests see "Invite & earn", which opens /refer (it handles sign-in).
// Built from shapes + icons (no image) so it stays sharp at any width.

const RM = ReduceMotion.Never;
const INK = '#2a1a8f';
const GOLD = '#ffc94d';

/** A gold ₹ coin that floats up and down - the banner's moving accent. */
function Coin({ size, delay, style }: { size: number; delay: number; style: object }) {
  const y = useSharedValue(0);
  useEffect(() => {
    y.value = withDelay(
      delay,
      withRepeat(
        withSequence(
          withTiming(-6, { duration: 1300, easing: Easing.inOut(Easing.quad), reduceMotion: RM }),
          withTiming(0, { duration: 1300, easing: Easing.inOut(Easing.quad), reduceMotion: RM }),
        ),
        -1,
        false,
        undefined,
        RM,
      ),
    );
  }, [delay, y]);
  const anim = useAnimatedStyle(() => ({ transform: [{ translateY: y.value }] }));
  return (
    <Animated.View
      style={[styles.coin, { width: size, height: size, borderRadius: size / 2 }, style, anim]}
    >
      <Text style={[styles.coinText, { fontSize: size * 0.48 }]}>₹</Text>
    </Animated.View>
  );
}

export function ReferBanner() {
  const router = useRouter();
  const session = useSession();
  const signedIn = session.status === 'authenticated';
  const [code, setCode] = useState<string | null>(null);
  const [friends, setFriends] = useState(0);
  const [copied, setCopied] = useState(false);

  useFocusEffect(
    useCallback(() => {
      if (!signedIn) {
        setCode(null);
        return;
      }
      let active = true;
      api.auth
        .referral()
        .then((r) => {
          if (!active) return;
          setCode(r.code);
          setFriends(r.friendsJoined);
        })
        .catch(() => undefined);
      return () => {
        active = false;
      };
    }, [signedIn]),
  );

  const tap = () => void Haptics.selectionAsync().catch(() => undefined);
  const open = () => {
    tap();
    router.push('/refer');
  };
  const invite = () => {
    tap();
    if (code) void shareReferralCode(code);
    else router.push('/refer');
  };
  const copy = async () => {
    if (!code) return;
    tap();
    await Clipboard.setStringAsync(code).catch(() => undefined);
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  };

  return (
    <Pressable
      onPress={open}
      style={({ pressed }) => [styles.wrap, pressed && { transform: [{ scale: 0.985 }] }]}
      accessibilityRole="button"
      accessibilityLabel="Refer and earn: invite friends and earn 2.5 percent of their orders"
    >
      <View style={styles.card}>
        {/* Depth: soft glows behind the content. */}
        <View style={[styles.glow, styles.glowA]} />
        <View style={[styles.glow, styles.glowB]} />
        <View style={[styles.glow, styles.glowC]} />

        <View style={styles.body}>
          <View style={styles.tag}>
            <Ionicons name="sparkles" size={11} color={INK} />
            <Text style={styles.tagText}>REFER & EARN</Text>
          </View>
          <Text style={styles.title}>
            Invite friends,{'\n'}earn <Text style={styles.titleGold}>2.5%</Text> on their orders
          </Text>
          <Text style={styles.sub}>
            On every order of ₹500+ · credited to your wallet after delivery
          </Text>

          <View style={styles.actions}>
            {code ? (
              <Pressable onPress={() => void copy()} style={styles.code} hitSlop={6}>
                <Text style={styles.codeLabel}>CODE</Text>
                <Text style={styles.codeText}>{code}</Text>
                <Ionicons
                  name={copied ? 'checkmark-circle' : 'copy-outline'}
                  size={15}
                  color={copied ? '#86efac' : '#ffffff'}
                />
              </Pressable>
            ) : null}
            <Pressable onPress={invite} style={styles.cta} hitSlop={6}>
              <Text style={styles.ctaText}>{code ? 'Invite now' : 'Invite & earn'}</Text>
              <Ionicons name="arrow-forward" size={15} color={INK} />
            </Pressable>
          </View>
          {copied ? <Text style={styles.copied}>Code copied</Text> : null}
          {!copied && friends > 0 ? (
            <Text style={styles.friends}>
              {friends} friend{friends === 1 ? '' : 's'} joined with your code
            </Text>
          ) : null}
        </View>

        {/* Illustration: a gift with coins floating around it. */}
        <View style={styles.art} pointerEvents="none">
          <View style={styles.ring} />
          <View style={styles.giftDisc}>
            <Ionicons name="gift" size={46} color={INK} />
          </View>
          <Coin size={30} delay={0} style={{ top: 6, right: 6 }} />
          <Coin size={22} delay={500} style={{ bottom: 18, left: 0 }} />
          <Coin size={18} delay={900} style={{ bottom: 4, right: 18 }} />
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: { marginHorizontal: space.lg, marginTop: space.xl },
  card: {
    flexDirection: 'row',
    minHeight: 196,
    borderRadius: 24,
    backgroundColor: '#3a22c4',
    overflow: 'hidden',
    paddingVertical: 18,
    paddingLeft: 18,
    paddingRight: 8,
    shadowColor: '#2a1a8f',
    shadowOpacity: 0.35,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
  },
  glow: { position: 'absolute', borderRadius: 999 },
  glowA: { width: 260, height: 260, right: -90, top: -110, backgroundColor: '#5a3cf0' },
  glowB: { width: 200, height: 200, left: -80, bottom: -120, backgroundColor: '#2c1a9e' },
  glowC: {
    width: 120,
    height: 120,
    right: 40,
    bottom: -70,
    backgroundColor: '#ff7a59',
    opacity: 0.35,
  },
  body: { flex: 1, gap: 7, zIndex: 1 },
  tag: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: GOLD,
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 3,
  },
  tagText: { fontFamily: font.uiBold, fontSize: 10.5, letterSpacing: 1, color: INK },
  title: { fontFamily: font.uiBold, fontSize: 21, lineHeight: 26, color: '#ffffff' },
  titleGold: { color: GOLD },
  sub: { fontFamily: font.uiMedium, fontSize: 12, lineHeight: 17, color: 'rgba(255,255,255,0.82)' },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6, flexWrap: 'wrap' },
  code: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 12,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: 'rgba(255,255,255,0.55)',
    backgroundColor: 'rgba(255,255,255,0.1)',
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  codeLabel: {
    fontFamily: font.uiBold,
    fontSize: 9.5,
    letterSpacing: 1,
    color: 'rgba(255,255,255,0.7)',
  },
  codeText: { fontFamily: font.uiBold, fontSize: 14, letterSpacing: 1.2, color: '#ffffff' },
  cta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#ffffff',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  ctaText: { fontFamily: font.uiBold, fontSize: 13.5, color: INK },
  copied: { fontFamily: font.uiSemibold, fontSize: 11.5, color: '#86efac' },
  friends: { fontFamily: font.uiSemibold, fontSize: 11.5, color: 'rgba(255,255,255,0.8)' },
  art: { width: 112, alignItems: 'center', justifyContent: 'center' },
  ring: {
    position: 'absolute',
    width: 104,
    height: 104,
    borderRadius: 52,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.18)',
  },
  giftDisc: {
    width: 82,
    height: 82,
    borderRadius: 41,
    backgroundColor: GOLD,
    alignItems: 'center',
    justifyContent: 'center',
    transform: [{ rotate: '-8deg' }],
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
    elevation: 5,
  },
  coin: {
    position: 'absolute',
    backgroundColor: '#ffd75e',
    borderWidth: 2,
    borderColor: '#f2b622',
    alignItems: 'center',
    justifyContent: 'center',
  },
  coinText: { fontFamily: font.uiBold, color: '#9a6400' },
});
