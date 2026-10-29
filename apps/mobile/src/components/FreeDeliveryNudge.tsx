import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { usePathname, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  FadeOutDown,
  FadeInDown,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { formatMoney, freeDeliveryProgress } from '@youmart/shared-client';
import { useCart } from '@/stores/cart';
import { useSession } from '@/stores/session';
import { BAR_SPACE, bottomBarShown } from './GlobalTabBar';
import { FreeDeliveryBar } from './FreeDeliveryBar';
import { colors, font, space } from '@/theme';

const SHOW_MS = 5000;

/** The product page's Add to Cart / Buy Now bar (app/product/[slug].tsx buyBar), without its
 * bottom inset: the popup sits above it there, so it never covers those buttons. */
const PRODUCT_BUY_BAR = 68;

/**
 * Instamart-style popup just above the bottom bar after something goes into the cart: how much
 * more unlocks FREE delivery (with a progress bar), or a "you unlocked FREE delivery" cheer once
 * the cart reaches ₹2,000 - plus a Checkout button either way. Disappears by itself after a few
 * seconds (or on the ×); every new add brings it back with the updated amount. It is also the
 * one "Added to cart" confirmation, so no second toast stacks up behind it.
 */
export function FreeDeliveryNudge() {
  const pathname = usePathname() ?? '/';
  const router = useRouter();
  const session = useSession();
  const insets = useSafeAreaInsets();
  const { cart } = useCart();
  const [visible, setVisible] = useState(false);
  const [bump, setBump] = useState(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wasUnlocked = useRef(false);

  const pop = useSharedValue(1);
  const popStyle = useAnimatedStyle(() => ({ transform: [{ scale: pop.value }] }));

  const show = () => {
    setVisible(true);
    setBump((n) => n + 1);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setVisible(false), SHOW_MS);
  };

  // Shown whenever the cart's item count goes UP (Add, +, Buy now...). Watching the cart itself
  // keeps it working however the item got in; the count the cart first loads with (app start,
  // sign-in, guest-cart merge) is skipped by comparing only within the same cart mode.
  const { mode, itemCount } = useCart();
  const last = useRef<{ mode: string; count: number } | null>(null);
  useEffect(() => {
    const prev = last.current;
    last.current = { mode, count: itemCount };
    if (!prev || prev.mode !== mode || mode === 'loading') return;
    if (itemCount > prev.count) show();
  }, [mode, itemCount]);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  const progress = freeDeliveryProgress(cart.subtotal);

  // A little celebration the moment the threshold is crossed; a soft nudge on every other add.
  useEffect(() => {
    if (!bump) return;
    if (progress.unlocked && !wasUnlocked.current) {
      pop.value = withSequence(
        withTiming(1.06, { duration: 140 }),
        withSpring(1, { damping: 6, stiffness: 200 }),
      );
    } else {
      pop.value = withSequence(withTiming(1.02, { duration: 90 }), withSpring(1, { damping: 10 }));
    }
    wasUnlocked.current = progress.unlocked;
  }, [bump, progress.unlocked, pop]);

  if (!visible || cart.items.length === 0 || !bottomBarShown(pathname)) return null;

  const checkout = () => {
    setVisible(false);
    router.push(session.status === 'authenticated' ? '/checkout' : '/auth/login');
  };

  return (
    <Animated.View
      entering={FadeInDown.duration(220)}
      exiting={FadeOutDown.duration(180)}
      pointerEvents="box-none"
      style={[
        styles.wrap,
        {
          bottom:
            BAR_SPACE +
            10 +
            (pathname.startsWith('/product/') ? PRODUCT_BUY_BAR + insets.bottom : 0),
        },
      ]}
    >
      <Animated.View
        style={[styles.card, progress.unlocked && styles.cardUnlocked, popStyle]}
        accessibilityLiveRegion="polite"
      >
        <View style={styles.body}>
          <View style={styles.added}>
            <View style={styles.addedIcon}>
              <Ionicons name="checkmark" size={11} color={colors.white} />
            </View>
            <Text style={styles.addedText}>Added to cart</Text>
            <Text style={styles.cheerMuted} numberOfLines={1}>
              · {cart.itemCount} item{cart.itemCount === 1 ? '' : 's'} ·{' '}
              {formatMoney(cart.subtotal)}
            </Text>
          </View>
          {progress.unlocked ? <Text style={styles.cheer}>🎉 Congratulations!</Text> : null}
          <FreeDeliveryBar subtotal={cart.subtotal} tone="dark" />
        </View>
        <View style={styles.side}>
          <Pressable
            onPress={() => setVisible(false)}
            hitSlop={10}
            style={styles.close}
            accessibilityLabel="Dismiss"
          >
            <Ionicons name="close" size={15} color="rgba(255,255,255,0.75)" />
          </Pressable>
          <Pressable
            onPress={checkout}
            style={({ pressed }) => [styles.cta, pressed && { opacity: 0.85 }]}
            accessibilityLabel="Checkout"
          >
            <Text style={styles.ctaText}>Checkout</Text>
            <Ionicons name="arrow-forward" size={14} color={colors.brand.DEFAULT} />
          </Pressable>
        </View>
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: space.md, right: space.md, zIndex: 60, elevation: 30 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    backgroundColor: colors.brand.DEFAULT,
    borderRadius: 18,
    paddingVertical: 12,
    paddingLeft: 14,
    paddingRight: 10,
    shadowColor: colors.brand.DEFAULT,
    shadowOpacity: 0.35,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
    elevation: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
  },
  cardUnlocked: { borderColor: 'rgba(255,255,255,0.6)' },
  body: { flex: 1, gap: 4 },
  cheer: { fontFamily: font.uiBold, fontSize: 14, color: colors.white },
  added: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  addedIcon: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: colors.feature.guarantee,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addedText: { fontFamily: font.uiBold, fontSize: 12.5, color: colors.white },
  cheerMuted: { fontFamily: font.uiMedium, fontSize: 11.5, color: 'rgba(255,255,255,0.85)' },
  side: { alignItems: 'flex-end', gap: 8 },
  close: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.18)',
  },
  cta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.white,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  ctaText: { fontFamily: font.uiBold, fontSize: 13, color: colors.brand.DEFAULT },
});
