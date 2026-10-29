import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import Animated, { FadeIn, FadeInDown, ReduceMotion } from 'react-native-reanimated';
import {
  ApiError,
  formatMoney,
  type MyReferral,
  type MyReferralRewards,
} from '@youmart/shared-client';
import { api } from '@/lib/api';
import { shareReferralCode } from '@/lib/share';
import { useSession } from '@/stores/session';
import { colors, font, space } from '@/theme';

// v1.17 Refer & Earn: the customer's code (share / copy), friends joined + money earned, how it
// works, entering a friend's code (new accounts, once), and the reward history. Rewards: 2.5% of
// each delivered item of a friend's order of Rs 500+ (items after coupons), into the YouMart
// Wallet; taken back if that item is returned.

const BRAND = colors.brand.DEFAULT;
const HERO = 'linear-gradient(140deg, #0b1b3f 0%, #0142aa 55%, #7c3aed 100%)';
const RM = ReduceMotion.Never;
const money = (m: string) => formatMoney(m).replace(/\.00$/, '');

const STEPS: { icon: keyof typeof Ionicons.glyphMap; title: string; text: string }[] = [
  {
    icon: 'share-social',
    title: 'Share your code',
    text: 'Send it to friends on WhatsApp, Instagram, Facebook or anywhere.',
  },
  {
    icon: 'person-add',
    title: 'They join YouMart',
    text: 'Your friend signs up and enters your code under Refer & Earn.',
  },
  {
    icon: 'wallet',
    title: 'You earn 2.5%',
    text: 'On every order of ₹500 or more they get delivered - straight to your YouMart Wallet.',
  },
];

export default function ReferScreen() {
  const router = useRouter();
  const session = useSession();
  const signedIn = session.status === 'authenticated';
  const [info, setInfo] = useState<MyReferral | null>(null);
  const [rewards, setRewards] = useState<MyReferralRewards | null>(null);
  const [failed, setFailed] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [copied, setCopied] = useState(false);
  const [friendCode, setFriendCode] = useState('');
  const [applying, setApplying] = useState(false);
  const [applyMsg, setApplyMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const load = useCallback(async () => {
    if (session.status !== 'authenticated') return;
    try {
      const [r, w] = await Promise.all([
        api.auth.referral(),
        api.orders.referralRewards().catch(() => null),
      ]);
      setInfo(r);
      setRewards(w);
      setFailed(false);
    } catch {
      setFailed(true);
    }
  }, [session.status]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const copy = async () => {
    if (!info) return;
    await Clipboard.setStringAsync(info.code);
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  const apply = async () => {
    const code = friendCode.trim();
    if (code.length < 4) {
      setApplyMsg({ ok: false, text: "Please enter your friend's code." });
      return;
    }
    setApplying(true);
    setApplyMsg(null);
    try {
      const res = await api.auth.applyReferral(code);
      setApplyMsg({
        ok: true,
        text: `Done! You joined with ${res.referredBy.name ?? 'your friend'}'s code.`,
      });
      setFriendCode('');
      void load();
    } catch (err) {
      setApplyMsg({
        ok: false,
        text: err instanceof ApiError ? err.message : 'Could not add the code. Please try again.',
      });
    } finally {
      setApplying(false);
    }
  };

  if (!signedIn) {
    return (
      <View style={styles.center}>
        <View style={styles.signInIcon}>
          <Ionicons name="gift" size={34} color={colors.white} />
        </View>
        <Text style={styles.signInTitle}>Refer friends, earn 2.5%</Text>
        <Text style={styles.signInText}>
          Sign in to get your referral code and start earning on your friends&apos; orders.
        </Text>
        <Pressable style={styles.primaryBtn} onPress={() => router.push('/auth/login')}>
          <Text style={styles.primaryBtnText}>Sign in</Text>
        </Pressable>
      </View>
    );
  }

  if (!info) {
    return (
      <View style={styles.center}>
        {failed ? (
          <>
            <Text style={styles.signInText}>Could not load Refer & Earn.</Text>
            <Pressable style={styles.primaryBtn} onPress={() => void load()}>
              <Text style={styles.primaryBtnText}>Try again</Text>
            </Pressable>
          </>
        ) : (
          <ActivityIndicator size="large" color={BRAND} />
        )}
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.body}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={async () => {
            setRefreshing(true);
            await load();
            setRefreshing(false);
          }}
          tintColor={BRAND}
        />
      }
    >
      {/* Hero: the offer + your code */}
      <Animated.View entering={FadeInDown.duration(320).reduceMotion(RM)} style={styles.hero}>
        <View style={[styles.glow, styles.glowTop]} pointerEvents="none" />
        <View style={[styles.glow, styles.glowBottom]} pointerEvents="none" />
        <View style={styles.heroIcon}>
          <Ionicons name="gift" size={26} color="#1f1300" />
        </View>
        <Text style={styles.heroTitle}>Refer & Earn</Text>
        <Text style={styles.heroText}>
          Earn <Text style={styles.heroStrong}>2.5%</Text> of every order of ₹500+ your friends get
          delivered - added straight to your YouMart Wallet.
        </Text>

        <Text style={styles.codeLabel}>YOUR CODE</Text>
        <View style={styles.codeBox}>
          <Text style={styles.code} selectable>
            {info.code}
          </Text>
          <Pressable
            onPress={() => void copy()}
            style={({ pressed }) => [styles.copyBtn, pressed && { opacity: 0.85 }]}
            accessibilityLabel="Copy your referral code"
          >
            <Ionicons name={copied ? 'checkmark' : 'copy-outline'} size={15} color={BRAND} />
            <Text style={styles.copyText}>{copied ? 'Copied' : 'Copy'}</Text>
          </Pressable>
        </View>
        <Pressable
          onPress={() => {
            void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
            void shareReferralCode(info.code);
          }}
          style={({ pressed }) => [styles.shareBtn, pressed && { opacity: 0.9 }]}
        >
          <Ionicons name="logo-whatsapp" size={18} color="#1f1300" />
          <Text style={styles.shareText}>Share with friends</Text>
        </Pressable>
      </Animated.View>

      {/* Stats */}
      <Animated.View
        entering={FadeInDown.delay(80).duration(320).reduceMotion(RM)}
        style={styles.stats}
      >
        <View style={styles.stat}>
          <Ionicons name="people" size={18} color={BRAND} />
          <Text style={styles.statValue}>{info.friendsJoined}</Text>
          <Text style={styles.statLabel}>
            {info.friendsJoined === 1 ? 'Friend joined' : 'Friends joined'}
          </Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.stat}>
          <Ionicons name="wallet" size={18} color="#16a34a" />
          <Text style={[styles.statValue, { color: '#16a34a' }]}>
            {money(rewards?.totalEarned ?? '0.00')}
          </Text>
          <Text style={styles.statLabel}>Earned so far</Text>
        </View>
      </Animated.View>

      {/* Enter a friend's code (new accounts, once) */}
      {info.canApplyCode ? (
        <Animated.View
          entering={FadeInDown.delay(140).duration(320).reduceMotion(RM)}
          style={styles.card}
        >
          <Text style={styles.cardTitle}>Joined with a friend&apos;s code?</Text>
          <Text style={styles.cardText}>
            Enter it within {info.applyWindowDays} days of creating your account.
          </Text>
          <View style={styles.applyRow}>
            <TextInput
              value={friendCode}
              onChangeText={(t) => setFriendCode(t.toUpperCase())}
              placeholder="e.g. YMAB12CD"
              placeholderTextColor={colors.text.placeholder}
              autoCapitalize="characters"
              autoCorrect={false}
              maxLength={20}
              style={styles.applyInput}
            />
            <Pressable
              onPress={() => void apply()}
              disabled={applying}
              style={({ pressed }) => [styles.applyBtn, pressed && { opacity: 0.88 }]}
            >
              {applying ? (
                <ActivityIndicator size="small" color={colors.white} />
              ) : (
                <Text style={styles.applyBtnText}>Apply</Text>
              )}
            </Pressable>
          </View>
          {applyMsg ? (
            <Text style={[styles.applyMsg, { color: applyMsg.ok ? '#16a34a' : '#c62828' }]}>
              {applyMsg.text}
            </Text>
          ) : null}
        </Animated.View>
      ) : info.referredBy ? (
        <Animated.View entering={FadeIn.duration(250).reduceMotion(RM)} style={styles.joinedNote}>
          <Ionicons name="heart" size={14} color="#e11d48" />
          <Text style={styles.joinedText}>
            You joined with {info.referredBy.name ?? 'a friend'}&apos;s code.
          </Text>
        </Animated.View>
      ) : null}

      {/* How it works */}
      <Text style={styles.section}>How it works</Text>
      <View style={styles.card}>
        {STEPS.map((s, i) => (
          <View key={s.title} style={[styles.step, i < STEPS.length - 1 && styles.stepLine]}>
            <View style={styles.stepIcon}>
              <Ionicons name={s.icon} size={18} color={BRAND} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.stepTitle}>
                {i + 1}. {s.title}
              </Text>
              <Text style={styles.stepText}>{s.text}</Text>
            </View>
          </View>
        ))}
      </View>

      {/* Rewards */}
      <Text style={styles.section}>Your rewards</Text>
      <View style={styles.card}>
        {!rewards || rewards.rewards.length === 0 ? (
          <View style={styles.empty}>
            <Ionicons name="sparkles-outline" size={26} color={BRAND} />
            <Text style={styles.emptyText}>
              No rewards yet. Share your code - you&apos;ll see each reward here.
            </Text>
          </View>
        ) : (
          rewards.rewards.map((r, i) => (
            <View
              key={r.rewardId}
              style={[styles.reward, i < rewards.rewards.length - 1 && styles.stepLine]}
            >
              <View
                style={[
                  styles.rewardIcon,
                  { backgroundColor: r.status === 'CREDITED' ? '#dcfce7' : '#fee2e2' },
                ]}
              >
                <Ionicons
                  name={r.status === 'CREDITED' ? 'arrow-down' : 'return-up-back'}
                  size={16}
                  color={r.status === 'CREDITED' ? '#16a34a' : '#c62828'}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.rewardTitle}>
                  {r.status === 'CREDITED'
                    ? 'Friend’s order delivered'
                    : 'Item returned - reversed'}
                </Text>
                <Text style={styles.rewardDate}>
                  {new Date(r.createdAt).toLocaleDateString('en-IN', {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric',
                  })}
                </Text>
              </View>
              <Text
                style={[
                  styles.rewardAmount,
                  r.status === 'CREDITED' ? styles.plus : styles.reversed,
                ]}
              >
                {r.status === 'CREDITED' ? '+' : ''}
                {money(r.amount)}
              </Text>
            </View>
          ))
        )}
      </View>

      <Text style={styles.terms}>
        Rewards are 2.5% of what your friend pays for each item (after coupons, not counting
        delivery) on orders of ₹500 or more, added once the item is delivered. If an item is
        returned, its reward is taken back. Wallet money can be spent on YouMart orders.
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.page },
  body: { padding: space.lg, gap: 12, paddingBottom: space.xxl },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: space.xl,
    gap: 12,
    backgroundColor: colors.page,
  },
  signInIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    experimental_backgroundImage: HERO,
  },
  signInTitle: { fontFamily: font.uiBold, fontSize: 20, color: colors.heading },
  signInText: {
    fontFamily: font.body,
    fontSize: 14,
    lineHeight: 20,
    color: colors.text.body,
    textAlign: 'center',
  },
  primaryBtn: {
    backgroundColor: BRAND,
    borderRadius: 10,
    paddingHorizontal: 28,
    paddingVertical: 11,
    marginTop: 4,
  },
  primaryBtnText: { fontFamily: font.uiBold, fontSize: 15, color: colors.white },
  hero: {
    borderRadius: 24,
    padding: 20,
    gap: 8,
    overflow: 'hidden',
    experimental_backgroundImage: HERO,
  },
  glow: { position: 'absolute', borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.08)' },
  glowTop: { width: 220, height: 220, top: -100, right: -70 },
  glowBottom: { width: 140, height: 140, bottom: -70, left: -50 },
  heroIcon: {
    width: 50,
    height: 50,
    borderRadius: 16,
    backgroundColor: '#ffe500',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroTitle: { fontFamily: font.uiBold, fontSize: 24, color: colors.white, marginTop: 4 },
  heroText: {
    fontFamily: font.body,
    fontSize: 14,
    lineHeight: 20,
    color: 'rgba(255,255,255,0.85)',
  },
  heroStrong: { fontFamily: font.uiBold, color: '#ffe500' },
  codeLabel: {
    fontFamily: font.uiBold,
    fontSize: 11,
    letterSpacing: 1.4,
    color: 'rgba(255,255,255,0.7)',
    marginTop: 8,
  },
  codeBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderRadius: 16,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: 'rgba(255,255,255,0.55)',
    backgroundColor: 'rgba(255,255,255,0.1)',
    paddingLeft: 16,
    paddingRight: 6,
    paddingVertical: 6,
  },
  code: {
    flex: 1,
    fontFamily: font.uiBold,
    fontSize: 24,
    letterSpacing: 3,
    color: colors.white,
  },
  copyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: colors.white,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  copyText: { fontFamily: font.uiBold, fontSize: 13, color: BRAND },
  shareBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#ffe500',
    borderRadius: 14,
    paddingVertical: 13,
    marginTop: 6,
  },
  shareText: { fontFamily: font.uiBold, fontSize: 15, color: '#1f1300' },
  stats: {
    flexDirection: 'row',
    backgroundColor: colors.white,
    borderRadius: 20,
    paddingVertical: 14,
    shadowColor: '#0b1b3f',
    shadowOpacity: 0.06,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  stat: { flex: 1, alignItems: 'center', gap: 3 },
  statDivider: { width: 1, backgroundColor: '#e6ecf5', marginVertical: 4 },
  statValue: { fontFamily: font.uiBold, fontSize: 22, color: colors.heading },
  statLabel: { fontFamily: font.uiMedium, fontSize: 12, color: colors.text.muted },
  section: {
    fontFamily: font.uiBold,
    fontSize: 12,
    letterSpacing: 1.1,
    textTransform: 'uppercase',
    color: '#8a95ab',
    marginTop: 8,
  },
  card: {
    backgroundColor: colors.white,
    borderRadius: 20,
    padding: 16,
    gap: 6,
    borderWidth: 1,
    borderColor: '#e2e9f6',
  },
  cardTitle: { fontFamily: font.uiBold, fontSize: 15, color: colors.heading },
  cardText: { fontFamily: font.body, fontSize: 12.5, color: colors.text.muted },
  applyRow: { flexDirection: 'row', gap: 8, marginTop: 6 },
  applyInput: {
    flex: 1,
    height: 44,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#d6e2f7',
    paddingHorizontal: 14,
    fontFamily: font.uiBold,
    fontSize: 15,
    letterSpacing: 1.5,
    color: colors.heading,
    backgroundColor: '#f8faff',
  },
  applyBtn: {
    height: 44,
    paddingHorizontal: 20,
    borderRadius: 12,
    backgroundColor: BRAND,
    alignItems: 'center',
    justifyContent: 'center',
  },
  applyBtnText: { fontFamily: font.uiBold, fontSize: 14, color: colors.white },
  applyMsg: { fontFamily: font.uiMedium, fontSize: 12.5, marginTop: 2 },
  joinedNote: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'center',
    backgroundColor: '#fff1f2',
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  joinedText: { fontFamily: font.uiSemibold, fontSize: 12.5, color: '#9f1239' },
  step: { flexDirection: 'row', gap: 12, paddingVertical: 8 },
  stepLine: { borderBottomWidth: 1, borderBottomColor: '#eef2f8' },
  stepIcon: {
    width: 38,
    height: 38,
    borderRadius: 13,
    backgroundColor: '#eaf1ff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepTitle: { fontFamily: font.uiBold, fontSize: 14, color: colors.heading },
  stepText: {
    fontFamily: font.body,
    fontSize: 12.5,
    lineHeight: 18,
    color: colors.text.body,
    marginTop: 2,
  },
  empty: { alignItems: 'center', gap: 8, paddingVertical: 14 },
  emptyText: {
    fontFamily: font.body,
    fontSize: 13,
    color: colors.text.muted,
    textAlign: 'center',
  },
  reward: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10 },
  rewardIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rewardTitle: { fontFamily: font.uiSemibold, fontSize: 13.5, color: colors.heading },
  rewardDate: { fontFamily: font.body, fontSize: 12, color: colors.text.muted, marginTop: 1 },
  rewardAmount: { fontFamily: font.uiBold, fontSize: 15 },
  plus: { color: '#16a34a' },
  reversed: { color: '#c62828', textDecorationLine: 'line-through' },
  terms: {
    fontFamily: font.body,
    fontSize: 11.5,
    lineHeight: 17,
    color: colors.text.muted,
    marginTop: 6,
  },
});
