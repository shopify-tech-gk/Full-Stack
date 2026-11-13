import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import Animated, { FadeInDown, ReduceMotion } from 'react-native-reanimated';
import { ApiError, type AdState, type AdView } from '@youmart/shared-client';
import { api } from '@/lib/api';
import { AD_PRICE_FALLBACK, adUrl, fmtWhen, rupees } from '@/lib/ads';
import { useRouter } from '@/lib/router';
import { useSession } from '@/stores/session';
import { colors, font, space } from '@/theme';

// v1.19 "Advertise on YouMart": how it works + price, and the advertiser's own ads with their
// status - pay (from the YouMart Wallet) once approved, cancel before paying, see why one was
// rejected. Creating an ad is /ads/new.

type IconName = keyof typeof Ionicons.glyphMap;
const RM = ReduceMotion.Never;
const HERO = 'linear-gradient(155deg, #1a0b3d 0%, #3b1a8f 50%, #c2410c 120%)';
const ORANGE = '#f97316';

const STEPS: { icon: IconName; title: string; text: string }[] = [
  { icon: 'images', title: 'Create', text: 'Upload up to 5 photos or one video' },
  { icon: 'shield-checkmark', title: 'Review', text: 'Our team checks it' },
  { icon: 'wallet', title: 'Pay', text: 'Only after approval' },
  { icon: 'rocket', title: 'Go live', text: 'Shown to every shopper' },
];

const AD_STATE: Record<AdState, { label: string; fg: string; bg: string; icon: IconName }> = {
  IN_REVIEW: { label: 'In review', fg: '#b45309', bg: '#fef3c7', icon: 'time' },
  AWAITING_PAYMENT: {
    label: 'Approved · pay to book',
    fg: '#1d4ed8',
    bg: '#dbeafe',
    icon: 'checkmark-circle',
  },
  SCHEDULED: { label: 'Scheduled', fg: '#6d28d9', bg: '#ede9fe', icon: 'calendar' },
  LIVE: { label: 'Live now', fg: '#047857', bg: '#d1fae5', icon: 'radio' },
  ENDED: { label: 'Ended', fg: '#475569', bg: '#e2e8f0', icon: 'flag' },
  REJECTED: { label: 'Not approved', fg: '#b91c1c', bg: '#fee2e2', icon: 'close-circle' },
  EXPIRED: { label: 'Expired · not paid', fg: '#475569', bg: '#e2e8f0', icon: 'hourglass' },
  CANCELLED: { label: 'Cancelled', fg: '#475569', bg: '#e2e8f0', icon: 'remove-circle' },
  REMOVED: { label: 'Taken down', fg: '#b91c1c', bg: '#fee2e2', icon: 'alert-circle' },
};

function AdCard({
  ad,
  busy,
  onPay,
  onCancel,
}: {
  ad: AdView;
  busy: boolean;
  onPay: () => void;
  onCancel: () => void;
}) {
  const st = AD_STATE[ad.state];
  const thumb = ad.media[0];
  return (
    <View style={styles.adCard}>
      <View style={styles.adTop}>
        <View style={styles.thumb}>
          {ad.kind === 'IMAGE' && thumb ? (
            <Image source={{ uri: adUrl(thumb) }} style={styles.thumbImg} contentFit="cover" />
          ) : (
            <Ionicons name="play-circle" size={30} color="#ffffff" />
          )}
          <View style={styles.kindTag}>
            <Ionicons
              name={ad.kind === 'IMAGE' ? 'images' : 'videocam'}
              size={10}
              color="#ffffff"
            />
            {ad.kind === 'IMAGE' && ad.media.length > 1 ? (
              <Text style={styles.kindTagText}>{ad.media.length}</Text>
            ) : null}
          </View>
        </View>
        <View style={{ flex: 1, gap: 3 }}>
          <View style={[styles.state, { backgroundColor: st.bg }]}>
            <Ionicons name={st.icon} size={11} color={st.fg} />
            <Text style={[styles.stateText, { color: st.fg }]}>{st.label}</Text>
          </View>
          <Text style={styles.adHeadline} numberOfLines={1}>
            {ad.headline}
          </Text>
          <Text style={styles.adMeta} numberOfLines={1}>
            {ad.advertiserName} · {ad.referenceCode}
          </Text>
        </View>
      </View>

      <View style={styles.when}>
        <Ionicons name="calendar-outline" size={14} color="#64748b" />
        <Text style={styles.whenText}>
          {fmtWhen(ad.startsAt)} → {fmtWhen(ad.endsAt)}
        </Text>
      </View>
      <View style={styles.priceRow}>
        <Text style={styles.priceLabel}>
          {ad.days} {ad.days === 1 ? 'day' : 'days'} × {rupees(ad.pricePerDay)}
        </Text>
        <Text style={styles.price}>{rupees(ad.amount)}</Text>
      </View>

      {ad.state === 'REJECTED' || ad.state === 'REMOVED' ? (
        <View style={styles.reason}>
          <Ionicons name="information-circle" size={16} color="#b91c1c" />
          <Text style={styles.reasonText}>{ad.rejectReason ?? 'No reason given.'}</Text>
        </View>
      ) : null}
      {ad.state === 'IN_REVIEW' ? (
        <Text style={styles.hint}>
          We&apos;ll review it soon. You pay only after it&apos;s approved.
        </Text>
      ) : null}
      {ad.state === 'AWAITING_PAYMENT' ? (
        <Text style={styles.hint}>
          Approved! Pay before {fmtWhen(ad.startsAt)} to book your slot.
        </Text>
      ) : null}

      {ad.state === 'AWAITING_PAYMENT' || ad.state === 'IN_REVIEW' ? (
        <View style={styles.actions}>
          <Pressable
            onPress={onCancel}
            disabled={busy}
            style={({ pressed }) => [styles.ghostBtn, pressed && styles.pressed]}
          >
            <Text style={styles.ghostText}>Cancel</Text>
          </Pressable>
          {ad.state === 'AWAITING_PAYMENT' ? (
            <Pressable
              onPress={onPay}
              disabled={busy}
              style={({ pressed }) => [styles.payBtn, (pressed || busy) && styles.pressed]}
            >
              {busy ? (
                <ActivityIndicator color="#ffffff" />
              ) : (
                <>
                  <Ionicons name="wallet" size={16} color="#ffffff" />
                  <Text style={styles.payText}>Pay {rupees(ad.amount)}</Text>
                </>
              )}
            </Pressable>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

export default function AdsHome() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const session = useSession();
  const signedIn = session.status === 'authenticated';
  const [ads, setAds] = useState<AdView[] | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!signedIn) {
      setAds([]);
      return;
    }
    try {
      setAds((await api.ads.mine()).items);
    } catch {
      setAds((cur) => cur ?? []);
    }
  }, [signedIn]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const create = () => router.push(signedIn ? '/ads/new' : '/auth/login');

  const pay = (ad: AdView) =>
    Alert.alert(
      `Pay ${rupees(ad.amount)}?`,
      `${ad.days} ${ad.days === 1 ? 'day' : 'days'} of "${ad.headline}" from your YouMart Wallet. It goes live on ${fmtWhen(ad.startsAt)}.`,
      [
        { text: 'Not now', style: 'cancel' },
        {
          text: `Pay ${rupees(ad.amount)}`,
          onPress: async () => {
            setBusy(ad.adId);
            try {
              const res = await api.ads.pay(ad.adId);
              void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(
                () => {},
              );
              setAds((cur) => cur?.map((a) => (a.adId === ad.adId ? res.ad : a)) ?? cur);
              Alert.alert('Booked!', `Your ad goes live on ${fmtWhen(ad.startsAt)}.`);
            } catch (err) {
              const reason = (
                err instanceof ApiError ? (err.details as { reason?: string } | undefined) : null
              )?.reason;
              if (reason === 'INSUFFICIENT_FUNDS') {
                Alert.alert(
                  'Not enough in your wallet',
                  `Add money to your YouMart Wallet to pay ${rupees(ad.amount)} for this ad.`,
                  [
                    { text: 'Later', style: 'cancel' },
                    { text: 'Add money', onPress: () => router.push('/wallet/add') },
                  ],
                );
              } else {
                Alert.alert(
                  'Payment failed',
                  err instanceof ApiError ? err.message : 'Please try again.',
                );
                void load();
              }
            } finally {
              setBusy(null);
            }
          },
        },
      ],
    );

  const cancel = (ad: AdView) =>
    Alert.alert('Cancel this ad?', 'Nothing has been charged. You can book again anytime.', [
      { text: 'Keep it', style: 'cancel' },
      {
        text: 'Cancel ad',
        style: 'destructive',
        onPress: async () => {
          setBusy(ad.adId);
          try {
            const res = await api.ads.cancel(ad.adId);
            setAds((cur) => cur?.map((a) => (a.adId === ad.adId ? res.ad : a)) ?? cur);
          } catch (err) {
            Alert.alert('Could not cancel', err instanceof ApiError ? err.message : 'Try again.');
          } finally {
            setBusy(null);
          }
        },
      },
    ]);

  return (
    <View style={styles.screen}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: insets.bottom + 110 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={async () => {
              setRefreshing(true);
              await load();
              setRefreshing(false);
            }}
          />
        }
      >
        <View style={[styles.hero, { paddingTop: insets.top + 8 }]}>
          <View style={styles.heroGlow} />
          <Pressable onPress={() => router.back()} hitSlop={10} style={styles.back}>
            <Ionicons name="arrow-back" size={20} color="#ffffff" />
          </Pressable>
          <Animated.View entering={FadeInDown.duration(420).reduceMotion(RM)}>
            <View style={styles.heroBadge}>
              <Ionicons name="megaphone" size={12} color={ORANGE} />
              <Text style={styles.heroBadgeText}>YOUMART ADS</Text>
            </View>
            <Text style={styles.heroTitle}>
              Put your brand in front of{'\n'}
              <Text style={{ color: '#fdba74' }}>every shopper.</Text>
            </Text>
            <Text style={styles.heroText}>
              A photo carousel on the Home screen, or your video in the floating player - for whole
              days at a time.
            </Text>
            <View style={styles.priceCard}>
              <View>
                <Text style={styles.priceBig}>
                  {rupees(AD_PRICE_FALLBACK)}
                  <Text style={styles.priceUnit}> / 24 hours</Text>
                </Text>
                <Text style={styles.priceSub}>Pay only after we approve it</Text>
              </View>
              <Pressable
                onPress={create}
                style={({ pressed }) => [styles.heroCta, pressed && styles.pressed]}
              >
                <Ionicons name="add" size={18} color="#1f1300" />
                <Text style={styles.heroCtaText}>Create ad</Text>
              </Pressable>
            </View>
          </Animated.View>
        </View>

        {/* Formats */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>TWO FORMATS</Text>
          <View style={styles.formats}>
            <View style={styles.format}>
              <View style={[styles.formatIcon, { backgroundColor: '#ffedd5' }]}>
                <Ionicons name="images" size={20} color="#c2410c" />
              </View>
              <Text style={styles.formatTitle}>Photo carousel</Text>
              <Text style={styles.formatText}>Up to 5 photos in Home&apos;s Sponsored slot</Text>
            </View>
            <View style={styles.format}>
              <View style={[styles.formatIcon, { backgroundColor: '#ede9fe' }]}>
                <Ionicons name="videocam" size={20} color="#6d28d9" />
              </View>
              <Text style={styles.formatTitle}>Video</Text>
              <Text style={styles.formatText}>Plays on loop in Home&apos;s floating player</Text>
            </View>
          </View>
        </View>

        {/* How it works */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>HOW IT WORKS</Text>
          <View style={styles.steps}>
            {STEPS.map((s, i) => (
              <View key={s.title} style={styles.step}>
                <View style={styles.stepIcon}>
                  <Ionicons name={s.icon} size={17} color="#3b1a8f" />
                </View>
                <Text style={styles.stepTitle}>
                  {i + 1}. {s.title}
                </Text>
                <Text style={styles.stepText}>{s.text}</Text>
              </View>
            ))}
          </View>
          <Text style={styles.rule}>
            One ad of each format runs at a time, so yours is never sharing the spot.
          </Text>
        </View>

        {/* My ads */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>MY ADS</Text>
          {ads === null ? (
            <ActivityIndicator color={colors.brand.DEFAULT} style={{ marginTop: 12 }} />
          ) : ads.length === 0 ? (
            <View style={styles.empty}>
              <Ionicons name="megaphone-outline" size={28} color="#94a3b8" />
              <Text style={styles.emptyText}>
                {signedIn ? 'No ads yet. Create your first one.' : 'Sign in to create an ad.'}
              </Text>
            </View>
          ) : (
            <View style={{ gap: 12 }}>
              {ads.map((ad) => (
                <AdCard
                  key={ad.adId}
                  ad={ad}
                  busy={busy === ad.adId}
                  onPay={() => pay(ad)}
                  onCancel={() => cancel(ad)}
                />
              ))}
            </View>
          )}
        </View>
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + 12 }]}>
        <Pressable
          onPress={create}
          style={({ pressed }) => [styles.cta, pressed && styles.pressed]}
        >
          <Ionicons name="megaphone" size={18} color="#ffffff" />
          <Text style={styles.ctaText}>{signedIn ? 'Create an ad' : 'Sign in to advertise'}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#f4f5fb' },
  pressed: { opacity: 0.88, transform: [{ scale: 0.985 }] },
  hero: {
    paddingHorizontal: space.lg,
    paddingBottom: 22,
    gap: 14,
    backgroundColor: '#3b1a8f',
    experimental_backgroundImage: HERO,
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
    overflow: 'hidden',
  },
  heroGlow: {
    position: 'absolute',
    width: 240,
    height: 240,
    borderRadius: 120,
    right: -80,
    top: -60,
    backgroundColor: 'rgba(249,115,22,0.22)',
  },
  back: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroBadge: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(249,115,22,0.14)',
    borderWidth: 1,
    borderColor: 'rgba(249,115,22,0.45)',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  heroBadgeText: { fontFamily: font.uiBold, fontSize: 10.5, letterSpacing: 1.3, color: '#fdba74' },
  heroTitle: {
    marginTop: 12,
    fontFamily: font.uiBold,
    fontSize: 27,
    lineHeight: 33,
    color: '#ffffff',
    letterSpacing: -0.3,
  },
  heroText: {
    marginTop: 8,
    fontFamily: font.body,
    fontSize: 13.5,
    lineHeight: 20,
    color: '#ddd6fe',
  },
  priceCard: {
    marginTop: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
    borderRadius: 18,
    padding: 14,
  },
  priceBig: { fontFamily: font.uiBold, fontSize: 24, color: '#ffffff' },
  priceUnit: { fontFamily: font.uiMedium, fontSize: 13, color: '#c4b5fd' },
  priceSub: { fontFamily: font.body, fontSize: 12, color: '#c4b5fd', marginTop: 2 },
  heroCta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#ffd60a',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  heroCtaText: { fontFamily: font.uiBold, fontSize: 14, color: '#1f1300' },
  section: { paddingHorizontal: space.lg, marginTop: 24 },
  sectionLabel: {
    fontFamily: font.uiBold,
    fontSize: 11.5,
    letterSpacing: 1.3,
    color: '#64748b',
    marginBottom: 10,
  },
  formats: { flexDirection: 'row', gap: 10 },
  format: {
    flex: 1,
    backgroundColor: colors.white,
    borderRadius: 16,
    padding: 14,
    gap: 6,
    borderWidth: 1,
    borderColor: '#e7e9f3',
  },
  formatIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  formatTitle: { fontFamily: font.uiBold, fontSize: 14, color: colors.heading },
  formatText: { fontFamily: font.body, fontSize: 12, lineHeight: 17, color: colors.text.muted },
  steps: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  step: {
    width: '47%',
    flexGrow: 1,
    flexDirection: 'column',
    backgroundColor: colors.white,
    borderRadius: 14,
    padding: 12,
    gap: 4,
  },
  stepIcon: {
    width: 30,
    height: 30,
    borderRadius: 10,
    backgroundColor: '#ede9fe',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
  },
  stepTitle: { fontFamily: font.uiBold, fontSize: 13, color: colors.heading },
  stepText: { fontFamily: font.body, fontSize: 11.5, lineHeight: 16, color: colors.text.muted },
  rule: {
    marginTop: 10,
    fontFamily: font.body,
    fontSize: 12,
    lineHeight: 17,
    color: colors.text.muted,
  },
  empty: {
    alignItems: 'center',
    gap: 8,
    paddingVertical: 26,
    backgroundColor: colors.white,
    borderRadius: 16,
  },
  emptyText: { fontFamily: font.uiMedium, fontSize: 13, color: colors.text.muted },
  adCard: {
    backgroundColor: colors.white,
    borderRadius: 18,
    padding: 14,
    gap: 10,
    shadowColor: '#0b1b3f',
    shadowOpacity: 0.06,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  adTop: { flexDirection: 'row', gap: 12, alignItems: 'center' },
  thumb: {
    width: 64,
    height: 64,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#1e1b4b',
    alignItems: 'center',
    justifyContent: 'center',
  },
  thumbImg: { width: '100%', height: '100%' },
  kindTag: {
    position: 'absolute',
    bottom: 4,
    right: 4,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: 6,
    paddingHorizontal: 4,
    paddingVertical: 2,
  },
  kindTagText: { fontFamily: font.uiBold, fontSize: 9.5, color: '#ffffff' },
  state: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  stateText: { fontFamily: font.uiBold, fontSize: 11 },
  adHeadline: { fontFamily: font.uiBold, fontSize: 15, color: colors.heading },
  adMeta: { fontFamily: font.body, fontSize: 12, color: colors.text.muted },
  when: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#f6f7fb',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  whenText: { flex: 1, fontFamily: font.uiMedium, fontSize: 12.5, color: '#334155' },
  priceRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  priceLabel: { fontFamily: font.body, fontSize: 12.5, color: colors.text.muted },
  price: { fontFamily: font.uiBold, fontSize: 16, color: colors.heading },
  reason: {
    flexDirection: 'row',
    gap: 7,
    backgroundColor: '#fef2f2',
    borderRadius: 10,
    padding: 10,
  },
  reasonText: { flex: 1, fontFamily: font.body, fontSize: 12.5, lineHeight: 18, color: '#991b1b' },
  hint: { fontFamily: font.body, fontSize: 12.5, lineHeight: 18, color: '#475569' },
  actions: { flexDirection: 'row', gap: 10 },
  ghostBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#d5dae6',
    paddingVertical: 11,
  },
  ghostText: { fontFamily: font.uiSemibold, fontSize: 14, color: '#334155' },
  payBtn: {
    flex: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    borderRadius: 12,
    backgroundColor: '#1d4ed8',
    paddingVertical: 11,
  },
  payText: { fontFamily: font.uiBold, fontSize: 14, color: '#ffffff' },
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
    borderRadius: 14,
    paddingVertical: 15,
    backgroundColor: ORANGE,
    experimental_backgroundImage: 'linear-gradient(110deg, #ea580c 0%, #f97316 100%)',
  },
  ctaText: { fontFamily: font.uiBold, fontSize: 16, color: '#ffffff' },
});
