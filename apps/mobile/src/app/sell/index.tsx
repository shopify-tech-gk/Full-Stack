import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  Easing,
  FadeInDown,
  ReduceMotion,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import type { SellerApplication, SellerApplicationStatus } from '@youmart/shared-client';
import { api } from '@/lib/api';
import { useRouter } from '@/lib/router';
import { useSession } from '@/stores/session';
import { BUSINESS_TYPE_LABEL, PulseDot, SELLER_GOLD } from '@/components/SellerComingSoon';
import { colors, font, space } from '@/theme';

// v1.19 "Sell on YouMart" launch page. Multi-vendor selling is not live yet: this explains what
// is coming and takes an early-access application (seller-service), which the admin team works
// through Admin -> Seller applications. Once applied, the page shows its live status.

type IconName = keyof typeof Ionicons.glyphMap;

const HERO = 'linear-gradient(160deg, #050f26 0%, #0a2463 55%, #0142aa 100%)';
const NAVY = '#0a2463';
const GOLD_INK = '#1f1300';
const RM = ReduceMotion.Never;

const ORBIT: IconName[] = ['cube', 'cash', 'bicycle', 'stats-chart'];
const ORBIT_R = 92;

const STEPS: { title: string; text: string }[] = [
  { title: 'Register your business', text: 'Sign up with your GST, PAN and bank details.' },
  { title: 'List your products', text: 'Add photos, prices and stock from your phone.' },
  { title: 'Receive orders', text: 'Customers across India discover and buy from your store.' },
  { title: 'Get paid', text: 'We deliver, and your earnings land in your bank account.' },
];

const PERKS: { icon: IconName; title: string; text: string }[] = [
  { icon: 'storefront', title: 'Your brand store', text: 'A page for your brand and catalogue' },
  { icon: 'grid', title: 'Seller dashboard', text: 'Orders, stock and payouts in one place' },
  { icon: 'bicycle', title: 'Delivery handled', text: 'We pick up, pack and deliver' },
  { icon: 'shield-checkmark', title: 'Secure payouts', text: 'Clear statements for every order' },
];

/** The application's journey, in order. DECLINED is shown separately. */
const TRACK: { status: SellerApplicationStatus; title: string; text: string }[] = [
  { status: 'NEW', title: 'Application received', text: 'Our seller team is reviewing it.' },
  { status: 'CONTACTED', title: 'Team in touch', text: 'We have reached out to you.' },
  { status: 'SHORTLISTED', title: 'Shortlisted', text: "You're on the launch list." },
  { status: 'ONBOARDED', title: 'Ready to sell', text: 'We will set up your store at launch.' },
];

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });

/** The storefront with icons slowly orbiting it. */
function Orbit() {
  const spin = useSharedValue(0);
  useEffect(() => {
    spin.value = withRepeat(
      withTiming(360, { duration: 24000, easing: Easing.linear, reduceMotion: RM }),
      -1,
      false,
    );
  }, [spin]);
  const ring = useAnimatedStyle(() => ({ transform: [{ rotate: `${spin.value}deg` }] }));
  const upright = useAnimatedStyle(() => ({ transform: [{ rotate: `${-spin.value}deg` }] }));

  return (
    <View style={styles.orbitBox}>
      <View
        style={[styles.track, { width: ORBIT_R * 2, height: ORBIT_R * 2, borderRadius: ORBIT_R }]}
      />
      <View style={[styles.track, styles.trackInner]} />
      <Animated.View style={[styles.ring, ring]}>
        {ORBIT.map((icon, i) => {
          const a = (i / ORBIT.length) * Math.PI * 2;
          return (
            <View
              key={icon}
              style={[
                styles.satellite,
                {
                  transform: [
                    { translateX: Math.cos(a) * ORBIT_R },
                    { translateY: Math.sin(a) * ORBIT_R },
                  ],
                },
              ]}
            >
              <Animated.View style={[styles.satelliteInner, upright]}>
                <Ionicons name={icon} size={16} color="#ffffff" />
              </Animated.View>
            </View>
          );
        })}
      </Animated.View>
      <View style={styles.core}>
        <Ionicons name="storefront" size={34} color={GOLD_INK} />
      </View>
    </View>
  );
}

/** "Your application": reference, what they sent, and where it is now. */
function ApplicationCard({ app }: { app: SellerApplication }) {
  const declined = app.status === 'DECLINED';
  const reached = TRACK.findIndex((t) => t.status === app.status);
  return (
    <View style={styles.appCard}>
      <View style={styles.appHead}>
        <View style={{ flex: 1 }}>
          <Text style={styles.appLabel}>YOUR APPLICATION</Text>
          <Text style={styles.appBiz} numberOfLines={1}>
            {app.businessName}
          </Text>
          <Text style={styles.appMeta} numberOfLines={1}>
            {BUSINESS_TYPE_LABEL[app.businessType]} · {app.category} · {app.city}
          </Text>
        </View>
        <View style={styles.refBox}>
          <Text style={styles.refLabel}>Ref.</Text>
          <Text style={styles.refCode}>{app.referenceCode}</Text>
        </View>
      </View>

      {declined ? (
        <View style={styles.declined}>
          <Ionicons name="information-circle" size={18} color="#9a3412" />
          <Text style={styles.declinedText}>
            We can't take this application forward right now. We'll reach out if that changes as the
            marketplace grows.
          </Text>
        </View>
      ) : (
        <View style={styles.trackList}>
          {TRACK.map((t, i) => {
            const done = i <= reached;
            const current = i === reached;
            return (
              <View key={t.status} style={styles.trackRow}>
                <View style={styles.trackRail}>
                  <View style={[styles.dot, done && styles.dotDone, current && styles.dotCurrent]}>
                    {done ? <Ionicons name="checkmark" size={12} color="#ffffff" /> : null}
                  </View>
                  {i < TRACK.length - 1 ? (
                    <View style={[styles.trackLine, i < reached && styles.trackLineDone]} />
                  ) : null}
                </View>
                <View style={styles.trackBody}>
                  <Text style={[styles.trackTitle, !done && styles.trackTitleTodo]}>{t.title}</Text>
                  {current ? (
                    <Text style={styles.trackText}>
                      {t.status === 'NEW' ? `Submitted ${fmtDate(app.createdAt)}. ` : ''}
                      {t.text}
                    </Text>
                  ) : null}
                </View>
              </View>
            );
          })}
        </View>
      )}
    </View>
  );
}

export default function SellScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const session = useSession();
  const signedIn = session.status === 'authenticated';
  const [app, setApp] = useState<SellerApplication | null | undefined>(undefined);
  const [failed, setFailed] = useState(false);

  // Refreshed every time the page is shown (e.g. coming back from the form, or after the team
  // updates the status).
  useFocusEffect(
    useCallback(() => {
      if (!signedIn) {
        setApp(null);
        return;
      }
      setFailed(false);
      api.sellers
        .myApplication()
        .then((r) => setApp(r.application))
        .catch(() => {
          setFailed(true);
          setApp((prev) => prev ?? null);
        });
    }, [signedIn]),
  );

  const loading = signedIn && app === undefined;

  return (
    <View style={styles.screen}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: insets.bottom + (app ? 32 : 110) }}
        showsVerticalScrollIndicator={false}
      >
        {/* Hero */}
        <View style={[styles.hero, { paddingTop: insets.top + 8 }]}>
          <View style={styles.heroTop}>
            <Pressable onPress={() => router.back()} hitSlop={10} style={styles.back}>
              <Ionicons name="arrow-back" size={20} color="#ffffff" />
            </Pressable>
            <View style={styles.statusChip}>
              <PulseDot size={6} />
              <Text style={styles.statusText}>LAUNCHING SOON</Text>
            </View>
          </View>

          <Animated.View entering={FadeInDown.duration(500).reduceMotion(RM)}>
            <Orbit />
          </Animated.View>

          <Animated.View entering={FadeInDown.delay(120).duration(500).reduceMotion(RM)}>
            <Text style={styles.eyebrow}>YOUMART FOR SELLERS</Text>
            <Text style={styles.headline}>
              Your shop.{'\n'}
              <Text style={styles.headlineGold}>Every doorstep.</Text>
            </Text>
            <Text style={styles.lede}>
              YouMart is opening to sellers. Bring your products to customers across India, and we
              take care of orders, delivery and payments.
            </Text>
          </Animated.View>
        </View>

        {app ? (
          <Animated.View
            entering={FadeInDown.delay(180).duration(500).reduceMotion(RM)}
            style={styles.section}
          >
            <ApplicationCard app={app} />
          </Animated.View>
        ) : null}

        {failed && !app ? (
          <Text style={styles.failNote}>
            Couldn't load your application status. Check your connection.
          </Text>
        ) : null}

        {/* How it will work */}
        <Animated.View
          entering={FadeInDown.delay(220).duration(500).reduceMotion(RM)}
          style={styles.section}
        >
          <Text style={styles.sectionLabel}>HOW IT WILL WORK</Text>
          {STEPS.map((s, i) => (
            <View key={s.title} style={styles.step}>
              <View style={styles.rail}>
                <View style={styles.node}>
                  <Text style={styles.nodeText}>{i + 1}</Text>
                </View>
                {i < STEPS.length - 1 ? <View style={styles.railLine} /> : null}
              </View>
              <View style={styles.stepBody}>
                <Text style={styles.stepTitle}>{s.title}</Text>
                <Text style={styles.stepText}>{s.text}</Text>
              </View>
            </View>
          ))}
        </Animated.View>

        {/* What you get */}
        <Animated.View
          entering={FadeInDown.delay(320).duration(500).reduceMotion(RM)}
          style={styles.section}
        >
          <Text style={styles.sectionLabel}>BUILT FOR SELLERS</Text>
          <View style={styles.perkGrid}>
            {PERKS.map((p) => (
              <View key={p.title} style={styles.perk}>
                <Ionicons name={p.icon} size={20} color={colors.brand.DEFAULT} />
                <Text style={styles.perkTitle}>{p.title}</Text>
                <Text style={styles.perkText}>{p.text}</Text>
              </View>
            ))}
          </View>
        </Animated.View>
      </ScrollView>

      {/* Sticky action bar: only until they have applied. */}
      {app ? null : (
        <View style={[styles.footer, { paddingBottom: insets.bottom + 12 }]}>
          {loading ? (
            <View style={[styles.cta, styles.ctaLoading]}>
              <ActivityIndicator color={GOLD_INK} />
            </View>
          ) : (
            <Pressable
              onPress={() => router.push(signedIn ? '/sell/apply' : '/auth/login')}
              style={({ pressed }) => [styles.cta, pressed && styles.ctaPressed]}
            >
              <Text style={styles.ctaText}>
                {signedIn ? 'Apply for early access' : 'Sign in to apply'}
              </Text>
              <Ionicons name="arrow-forward" size={18} color={GOLD_INK} />
            </Pressable>
          )}
          <Text style={styles.footNote}>Takes about a minute · No fees to apply</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.white },
  hero: {
    paddingHorizontal: space.lg,
    paddingBottom: 28,
    backgroundColor: NAVY,
    experimental_backgroundImage: HERO,
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
    overflow: 'hidden',
  },
  heroTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  back: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    borderRadius: 999,
    paddingHorizontal: 11,
    paddingVertical: 5,
    backgroundColor: 'rgba(255,214,10,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255,214,10,0.4)',
  },
  statusText: { fontFamily: font.uiBold, fontSize: 10.5, letterSpacing: 1.3, color: SELLER_GOLD },
  orbitBox: { height: 236, alignItems: 'center', justifyContent: 'center', marginTop: 4 },
  track: {
    position: 'absolute',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    borderStyle: 'dashed',
  },
  trackInner: {
    width: 120,
    height: 120,
    borderRadius: 60,
    borderStyle: 'solid',
    borderColor: 'rgba(255,214,10,0.18)',
  },
  ring: {
    position: 'absolute',
    width: 0,
    height: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  satellite: { position: 'absolute' },
  satelliteInner: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  core: {
    width: 80,
    height: 80,
    borderRadius: 26,
    backgroundColor: SELLER_GOLD,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: SELLER_GOLD,
    shadowOpacity: 0.5,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 0 },
    elevation: 12,
  },
  eyebrow: { fontFamily: font.uiBold, fontSize: 11, letterSpacing: 1.6, color: '#8fa6dc' },
  headline: {
    marginTop: 6,
    fontFamily: font.uiBold,
    fontSize: 32,
    lineHeight: 38,
    color: '#ffffff',
  },
  headlineGold: { color: SELLER_GOLD },
  lede: { marginTop: 10, fontFamily: font.body, fontSize: 14, lineHeight: 21, color: '#c3cfee' },
  section: { paddingHorizontal: space.lg, marginTop: 28 },
  sectionLabel: {
    fontFamily: font.uiBold,
    fontSize: 11.5,
    letterSpacing: 1.4,
    color: colors.text.muted,
    marginBottom: 14,
  },
  failNote: {
    marginTop: 16,
    paddingHorizontal: space.lg,
    fontFamily: font.body,
    fontSize: 12.5,
    color: colors.text.muted,
    textAlign: 'center',
  },
  // Application card
  appCard: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#dfe6f3',
    backgroundColor: '#ffffff',
    padding: 16,
    shadowColor: NAVY,
    shadowOpacity: 0.08,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3,
  },
  appHead: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    paddingBottom: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#dfe6f3',
  },
  appLabel: { fontFamily: font.uiBold, fontSize: 10.5, letterSpacing: 1.3, color: '#5d6b85' },
  appBiz: { marginTop: 4, fontFamily: font.uiBold, fontSize: 17, color: colors.text.strong },
  appMeta: { marginTop: 2, fontFamily: font.body, fontSize: 12.5, color: colors.text.muted },
  refBox: {
    alignItems: 'flex-end',
    backgroundColor: '#f3f6fc',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  refLabel: { fontFamily: font.uiMedium, fontSize: 10, color: '#5d6b85' },
  refCode: { fontFamily: font.uiBold, fontSize: 13, color: NAVY, letterSpacing: 0.4 },
  trackList: { paddingTop: 14 },
  trackRow: { flexDirection: 'row', gap: 12 },
  trackRail: { alignItems: 'center', width: 22 },
  dot: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: '#d5ddec',
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dotDone: { backgroundColor: '#1e8e4f', borderColor: '#1e8e4f' },
  dotCurrent: { shadowColor: '#1e8e4f', shadowOpacity: 0.4, shadowRadius: 6, elevation: 3 },
  trackLine: { flex: 1, width: 2, minHeight: 14, backgroundColor: '#e3e8f3', marginVertical: 3 },
  trackLineDone: { backgroundColor: '#1e8e4f' },
  trackBody: { flex: 1, paddingBottom: 14, paddingTop: 1 },
  trackTitle: { fontFamily: font.uiSemibold, fontSize: 14, color: colors.text.strong },
  trackTitleTodo: { color: '#9aa6bd', fontFamily: font.uiMedium },
  trackText: {
    marginTop: 2,
    fontFamily: font.body,
    fontSize: 12.5,
    lineHeight: 18,
    color: colors.text.body,
  },
  declined: {
    marginTop: 14,
    flexDirection: 'row',
    gap: 8,
    backgroundColor: '#fff7ed',
    borderRadius: 12,
    padding: 12,
  },
  declinedText: { flex: 1, fontFamily: font.body, fontSize: 13, lineHeight: 19, color: '#9a3412' },
  // How it works
  step: { flexDirection: 'row', gap: 14 },
  rail: { alignItems: 'center', width: 28 },
  node: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: NAVY,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nodeText: { fontFamily: font.uiBold, fontSize: 13, color: SELLER_GOLD },
  railLine: { flex: 1, width: 2, backgroundColor: '#e3e8f3', marginVertical: 4 },
  stepBody: { flex: 1, paddingBottom: 18, paddingTop: 3 },
  stepTitle: { fontFamily: font.uiSemibold, fontSize: 15, color: colors.text.strong },
  stepText: {
    marginTop: 3,
    fontFamily: font.body,
    fontSize: 13,
    lineHeight: 19,
    color: colors.text.body,
  },
  perkGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  perk: {
    width: '48%',
    flexGrow: 1,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e6ebf5',
    padding: 14,
    gap: 6,
    backgroundColor: '#f8faff',
  },
  perkTitle: { fontFamily: font.uiSemibold, fontSize: 14, color: colors.text.strong },
  perkText: { fontFamily: font.body, fontSize: 12, lineHeight: 17, color: colors.text.muted },
  // Footer
  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: space.lg,
    paddingTop: 12,
    backgroundColor: colors.white,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#e3e8f3',
  },
  cta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: SELLER_GOLD,
    borderRadius: 14,
    paddingVertical: 15,
  },
  ctaLoading: { opacity: 0.7 },
  ctaPressed: { opacity: 0.88, transform: [{ scale: 0.985 }] },
  ctaText: { fontFamily: font.uiBold, fontSize: 16, color: GOLD_INK },
  footNote: {
    marginTop: 7,
    textAlign: 'center',
    fontFamily: font.body,
    fontSize: 11.5,
    color: colors.text.muted,
  },
});
