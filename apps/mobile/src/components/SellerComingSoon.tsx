import { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  Easing,
  ReduceMotion,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { useFocusEffect } from 'expo-router';
import type { SellerApplicationStatus, SellerBusinessType } from '@youmart/shared-client';
import { api } from '@/lib/api';
import { useRouter } from '@/lib/router';
import { useSession } from '@/stores/session';
import { colors, font, space } from '@/theme';

export const SELLER_GOLD = '#ffd60a';

/** Short status line for the Account strip once they have applied. */
export const APPLICATION_STATUS_LABEL: Record<SellerApplicationStatus, string> = {
  NEW: 'Application received · under review',
  CONTACTED: 'Our team has contacted you',
  SHORTLISTED: "You're shortlisted for launch",
  ONBOARDED: 'Ready to sell at launch',
  DECLINED: 'Application closed',
};

export const BUSINESS_TYPE_LABEL: Record<SellerBusinessType, string> = {
  INDIVIDUAL: 'Individual',
  SHOP: 'Shop / retailer',
  BRAND: 'Own brand',
  MANUFACTURER: 'Manufacturer',
  WHOLESALER: 'Wholesaler',
};

/** A dot that softly pulses: the "live soon" signal. */
export function PulseDot({ color = SELLER_GOLD, size = 7 }: { color?: string; size?: number }) {
  const t = useSharedValue(0);
  useEffect(() => {
    t.value = withRepeat(
      withTiming(1, {
        duration: 1400,
        easing: Easing.out(Easing.quad),
        reduceMotion: ReduceMotion.Never,
      }),
      -1,
      false,
    );
  }, [t]);
  const halo = useAnimatedStyle(() => ({
    opacity: 0.55 * (1 - t.value),
    transform: [{ scale: 1 + t.value * 1.6 }],
  }));
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Animated.View
        style={[
          {
            position: 'absolute',
            width: size,
            height: size,
            borderRadius: size,
            backgroundColor: color,
          },
          halo,
        ]}
      />
      <View style={{ width: size, height: size, borderRadius: size, backgroundColor: color }} />
    </View>
  );
}

/** Account-tab entry to the "Sell on YouMart" launch page (multi-vendor, not live yet). */
export function SellerComingSoon() {
  const router = useRouter();
  const session = useSession();
  const signedIn = session.status === 'authenticated';
  const [applied, setApplied] = useState<{ code: string; status: SellerApplicationStatus } | null>(
    null,
  );

  useFocusEffect(
    useCallback(() => {
      if (!signedIn) {
        setApplied(null);
        return;
      }
      api.sellers
        .myApplication()
        .then((r) =>
          setApplied(
            r.application
              ? { code: r.application.referenceCode, status: r.application.status }
              : null,
          ),
        )
        .catch(() => {});
    }, [signedIn]),
  );

  return (
    <View style={styles.wrap}>
      <Pressable
        onPress={() => router.push('/sell')}
        style={({ pressed }) => [styles.strip, pressed && styles.pressed]}
        accessibilityRole="button"
        accessibilityLabel="Sell on YouMart, coming soon"
      >
        <View style={styles.sheen} />
        <View style={styles.iconTile}>
          <Ionicons name="cart" size={21} color={SELLER_GOLD} />
        </View>
        <View style={styles.text}>
          <Text style={styles.title}>Sell on YouMart</Text>
          <Text style={styles.sub} numberOfLines={1}>
            {applied
              ? APPLICATION_STATUS_LABEL[applied.status]
              : 'Take your business online with us'}
          </Text>
        </View>
        {applied ? (
          <View style={styles.soon}>
            <Text style={styles.soonText}>{applied.code}</Text>
          </View>
        ) : (
          <View style={styles.soon}>
            <PulseDot size={6} />
            <Text style={styles.soonText}>COMING SOON</Text>
          </View>
        )}
        <Ionicons name="chevron-forward" size={16} color="rgba(255,255,255,0.55)" />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingHorizontal: space.lg, marginTop: space.lg },
  strip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 16,
    paddingVertical: 13,
    paddingHorizontal: 14,
    overflow: 'hidden',
    // Same solid blue as the Account tab's header.
    backgroundColor: colors.brand.DEFAULT,
  },
  pressed: { opacity: 0.9, transform: [{ scale: 0.985 }] },
  sheen: {
    position: 'absolute',
    top: -40,
    right: 40,
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  iconTile: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: 'rgba(255,214,10,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255,214,10,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: { flex: 1, gap: 2 },
  title: { fontFamily: font.uiBold, fontSize: 15, color: '#ffffff' },
  sub: { fontFamily: font.body, fontSize: 12, color: '#a9bbe6' },
  soon: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 4,
    backgroundColor: 'rgba(255,214,10,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255,214,10,0.4)',
  },
  soonText: { fontFamily: font.uiBold, fontSize: 9.5, letterSpacing: 0.9, color: SELLER_GOLD },
});
