import { Fragment } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { usePathname, useRouter, type Href } from 'expo-router';
import {
  SafeAreaInsetsContext,
  initialWindowMetrics,
  useSafeAreaInsets,
} from 'react-native-safe-area-context';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { runOnJS } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { authUserLabel } from '@youmart/shared-client';
import { useCart } from '@/stores/cart';
import { useSession } from '@/stores/session';
import { useAvatar } from '@/stores/profile';
import { Avatar } from '@/components/Avatar';
import { AiNavButton } from '@/components/AiNavButton';
import { colors, font } from '@/theme';

/** The four bottom tabs, in order (same as app/(tabs)); YouMart AI sits between Favourites and My Cart. */
const TABS = [
  { path: '/', label: 'Home' },
  { path: '/buy-again', label: 'Favourites' },
  { path: '/cart', label: 'My Cart' },
  { path: '/account', label: 'Account' },
] as const;

export const BAR_HEIGHT = 52;

/**
 * Space kept under the bar's icons. The full bottom safe area (iPhone home-indicator strip, ~34)
 * left a visible empty band; keep just enough to stay clear of the swipe-up line.
 */
export function barBottomPad(bottomInset: number): number {
  // Android gets a little extra room under the icons; iPhone stays as tuned.
  if (Platform.OS === 'android') return Math.max(22, Math.round(bottomInset * 0.6) + 12);
  return bottomInset > 0 ? Math.max(10, Math.round(bottomInset * 0.6)) : 10;
}

/**
 * The bar's full height (icons + the space under them), from the phone's bottom safe area measured
 * at launch - one fixed number, so the tab screens' bar and this bar always match exactly (even
 * mid-transition, when screens see adjusted insets).
 */
export const BAR_SPACE = BAR_HEIGHT + barBottomPad(initialWindowMetrics?.insets.bottom ?? 0);

/** The tab screens themselves draw the real tab bar. */
const TAB_PATHS = new Set<string>(TABS.map((t) => t.path));

/** Screens where a bottom bar would get in the way (focused flows, full-screen camera / map). */
const HIDDEN = [
  '/welcome',
  '/lens',
  '/scan',
  '/checkout',
  '/payment',
  '/order-success',
  '/auth',
  '/addresses/map',
  // The assistant chat has its own message bar at the bottom.
  '/help/assistant',
];

const ACCOUNT_AREA = [
  '/account',
  '/orders',
  '/coupons',
  '/inbox',
  '/wallet',
  '/returns',
  '/help',
  '/addresses',
  '/review',
  '/info',
  '/track-order',
];

const under = (path: string, prefix: string) => path === prefix || path.startsWith(`${prefix}/`);

/** True on any screen that shows a bottom bar (the four tabs, or this bar). */
export function bottomBarShown(pathname: string): boolean {
  return TAB_PATHS.has(pathname) || globalTabBarVisible(pathname);
}

export function globalTabBarVisible(pathname: string): boolean {
  return !TAB_PATHS.has(pathname) && !HIDDEN.some((p) => under(pathname, p));
}

/** For the root Stack: does this route (e.g. "category/[slug]") sit above this bar? */
export function routeNeedsBar(routeName: string): boolean {
  if (routeName.startsWith('(')) return false; // the (tabs) group draws its own bar
  const path = `/${routeName}`;
  return !HIDDEN.some((p) => under(path, p));
}

/** Which tab a stacked screen belongs to (highlighted in the bar). */
function activeTab(pathname: string): number {
  if (under(pathname, '/my-cart')) return 2;
  if (under(pathname, '/wishlist')) return 1;
  if (ACCOUNT_AREA.some((p) => under(pathname, p))) return 3;
  return 0;
}

/**
 * The bottom navigation bar on every other screen (product, category, search, orders, account
 * pages...), matching the tab bar: tap a tab to go straight back to it, or swipe across the bar to
 * move to the next / previous tab. Rendered by the root layout under the screen stack.
 */
export function GlobalTabBar() {
  const pathname = usePathname() ?? '/';
  const router = useRouter();
  const { itemCount } = useCart();
  const session = useSession();
  const { uri } = useAvatar();
  const avatarName = session.status === 'authenticated' ? authUserLabel(session.user) : '';
  const hasAvatar = Boolean(uri) || avatarName.length > 0;

  const active = activeTab(pathname);

  const goTab = (index: number) => {
    const tab = TABS[index];
    if (!tab) return;
    void Haptics.selectionAsync().catch(() => undefined);
    // Close the stacked screens, then switch to the tab.
    if (router.canDismiss()) router.dismissAll();
    router.navigate(tab.path as Href);
  };

  const swipe = (dir: number) => goTab(Math.min(TABS.length - 1, Math.max(0, active + dir)));

  const pan = Gesture.Pan()
    .activeOffsetX([-15, 15])
    .failOffsetY([-12, 12])
    .onEnd((e) => {
      'worklet';
      if (Math.abs(e.translationX) < 40 && Math.abs(e.velocityX) < 500) return;
      runOnJS(swipe)(e.translationX < 0 ? 1 : -1);
    });

  if (!globalTabBarVisible(pathname)) return null;

  return (
    <GestureDetector gesture={pan}>
      <View style={[styles.bar, { paddingBottom: BAR_SPACE - BAR_HEIGHT, height: BAR_SPACE }]}>
        {TABS.map((tab, i) => {
          const on = i === active;
          const color = on ? colors.brand.DEFAULT : colors.nav.inactiveIcon;
          return (
            <Fragment key={tab.path}>
              {i === 2 ? <AiNavButton /> : null}
              <Pressable
                style={styles.tab}
                onPress={() => goTab(i)}
                accessibilityRole="tab"
                accessibilityState={{ selected: on }}
                accessibilityLabel={
                  i === 2 && itemCount > 0 ? `My Cart, ${itemCount} items` : tab.label
                }
              >
                <View>
                  {i === 0 ? (
                    <Ionicons name="home" size={24} color={color} />
                  ) : i === 1 ? (
                    <Ionicons name="bookmark" size={24} color={color} />
                  ) : i === 2 ? (
                    <Ionicons name="cart" size={24} color={color} />
                  ) : hasAvatar ? (
                    <View style={[styles.avatarRing, on && styles.avatarRingOn]}>
                      <Avatar name={avatarName} uri={uri} size={24} />
                    </View>
                  ) : (
                    <Ionicons name="person" size={24} color={color} />
                  )}
                  {i === 2 && itemCount > 0 ? (
                    <View style={styles.badge}>
                      <Text style={styles.badgeText}>{itemCount > 99 ? '99+' : itemCount}</Text>
                    </View>
                  ) : null}
                </View>
                <Text style={[styles.label, { color }]}>{tab.label}</Text>
              </Pressable>
            </Fragment>
          );
        })}
      </View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  // Laid over the screens (they keep room for it via the Stack's contentStyle), never squeezing
  // them - so going back to a tab, whose own bar sits in exactly this spot, shows no second bar.
  bar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    backgroundColor: colors.white,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border.menu,
  },
  tab: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 2, paddingTop: 4 },
  label: { fontFamily: font.uiMedium, fontSize: 11 },
  avatarRing: { borderRadius: 15, padding: 0, borderWidth: 0, borderColor: colors.brand.DEFAULT },
  avatarRingOn: { borderWidth: 2, padding: 1 },
  badge: {
    position: 'absolute',
    top: -6,
    right: -12,
    minWidth: 19,
    height: 19,
    paddingHorizontal: 4,
    borderRadius: 10,
    backgroundColor: colors.price.discount,
    borderWidth: 1.5,
    borderColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: { fontFamily: font.uiBold, fontSize: 10, lineHeight: 13, color: colors.white },
});

/**
 * The screen stack with the bar over its bottom edge. While the bar shows it owns the bottom safe
 * area, so screens inside are told the bottom inset is 0 (no double gap under their own bottom
 * buttons); the room above it comes from the Stack's contentStyle (routeNeedsBar + BAR_SPACE).
 */
export function WithGlobalTabBar({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() ?? '/';
  const insets = useSafeAreaInsets();
  const show = globalTabBarVisible(pathname);
  return (
    <View style={styles.fill}>
      <SafeAreaInsetsContext.Provider value={show ? { ...insets, bottom: 0 } : insets}>
        <View style={styles.fill}>{children}</View>
      </SafeAreaInsetsContext.Provider>
      <GlobalTabBar />
    </View>
  );
}
