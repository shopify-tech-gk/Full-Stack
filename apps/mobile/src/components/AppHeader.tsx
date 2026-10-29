import { useState } from 'react';
import { Image } from 'expo-image';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { usePathname, useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import Animated, {
  ReduceMotion,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SEARCH_PLACEHOLDER } from '@youmart/shared-client';
import { colors, font, radii, space } from '@/theme';
import { DeliveryBar } from '@/components/DeliveryBar';
import { VoiceSearchSheet } from '@/components/VoiceSearchSheet';
import { useUnreadCount } from '@/stores/inbox';
import { emitHomeLogoTap, markLogoArrival } from '@/lib/home-tap';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const LOGO = require('../../assets/images/logo.png');

/** App header for the tab screens: the YouMart logo, Track Order + Customer Care quick tiles on the
 * right (like youmartshop.com), the delivery address and a search entry. The cart lives in the tab
 * bar. */
export function AppHeader() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [voice, setVoice] = useState(false);
  const unread = useUnreadCount();
  const pathname = usePathname();

  // A quick squeeze-and-bounce on the logo; from another tab Home then glides in (see Home).
  const logoScale = useSharedValue(1);
  const logoStyle = useAnimatedStyle(() => ({ transform: [{ scale: logoScale.value }] }));
  const logoTap = () => {
    void Haptics.selectionAsync().catch(() => undefined);
    logoScale.value = withSequence(
      withTiming(0.86, { duration: 90, reduceMotion: ReduceMotion.Never }),
      withSpring(1, { damping: 7, stiffness: 260, reduceMotion: ReduceMotion.Never }),
    );
    if (pathname === '/') {
      emitHomeLogoTap();
      return;
    }
    markLogoArrival();
    // Let the bounce show before the screen changes.
    setTimeout(() => {
      if (router.canDismiss()) router.dismissAll();
      router.navigate('/');
    }, 160);
  };

  return (
    <View style={[styles.wrap, { paddingTop: insets.top + 6 }]}>
      <View style={styles.row}>
        {/* Logo: elsewhere -> Home; on Home -> back to the top, or reload if already there. */}
        <Pressable onPress={logoTap} hitSlop={6} accessibilityLabel="YouMart home">
          <Animated.View style={logoStyle}>
            <Image source={LOGO} style={styles.logo} contentFit="contain" />
          </Animated.View>
        </Pressable>
        <View style={styles.actions}>
          <Pressable
            style={styles.tile}
            onPress={() => router.push('/scan')}
            hitSlop={6}
            accessibilityLabel="Scan QR to sign in on a computer"
          >
            <Ionicons name="qr-code-outline" size={22} color={colors.brand.DEFAULT} />
            <Text style={styles.tileLabel}>QR{'\n'}Login</Text>
          </Pressable>
          <Pressable style={styles.tile} onPress={() => router.push('/track-order')} hitSlop={6}>
            <Ionicons name="cube-outline" size={22} color={colors.brand.DEFAULT} />
            <Text style={styles.tileLabel}>Track{'\n'}Order</Text>
          </Pressable>
          {/* v1.15: the inbox - order updates, refunds, support replies. */}
          <Pressable
            style={styles.tile}
            onPress={() => router.push('/inbox')}
            hitSlop={6}
            accessibilityLabel={unread > 0 ? `Alerts, ${unread} unread` : 'Alerts'}
          >
            <View>
              <Ionicons
                name={unread > 0 ? 'notifications' : 'notifications-outline'}
                size={22}
                color={colors.brand.DEFAULT}
              />
              {unread > 0 ? (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>{unread > 9 ? '9+' : unread}</Text>
                </View>
              ) : null}
            </View>
            <Text style={styles.tileLabel}>Alerts</Text>
          </Pressable>
          <Pressable
            style={styles.tile}
            onPress={() => router.push('/info/customer-care')}
            hitSlop={6}
          >
            <Ionicons name="headset-outline" size={22} color={colors.brand.DEFAULT} />
            <Text style={styles.tileLabel}>Customer{'\n'}Care</Text>
          </Pressable>
        </View>
      </View>
      <DeliveryBar />
      <View style={styles.search}>
        <Pressable style={styles.searchTap} onPress={() => router.push('/search')}>
          <Ionicons name="search" size={18} color={colors.text.placeholder} />
          <Text style={styles.searchText} numberOfLines={1}>
            {SEARCH_PLACEHOLDER}
          </Text>
        </Pressable>
        <Pressable
          style={styles.scan}
          onPress={() => router.push('/lens')}
          hitSlop={8}
          accessibilityLabel="Search with a photo"
        >
          <Ionicons name="camera-outline" size={21} color={colors.brand.DEFAULT} />
        </Pressable>
        <Pressable
          style={styles.mic}
          onPress={() => setVoice(true)}
          hitSlop={8}
          accessibilityLabel="Search by voice"
        >
          <Ionicons name="mic" size={18} color={colors.white} />
        </Pressable>
      </View>
      <VoiceSearchSheet
        visible={voice}
        onClose={() => setVoice(false)}
        onResult={(text) => {
          setVoice(false);
          router.push({ pathname: '/search', params: { q: text } });
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: colors.white,
    paddingHorizontal: space.lg,
    paddingBottom: space.md,
  },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  logo: { width: 132, height: 50 },
  // Tiles line up by their tops so every icon sits on one row (labels are 1 or 2 lines).
  actions: { flexDirection: 'row', alignItems: 'flex-start', gap: 6, marginLeft: 'auto' },
  tile: { alignItems: 'center', gap: 2, width: 46 },
  badge: {
    position: 'absolute',
    top: -5,
    right: -9,
    minWidth: 17,
    height: 17,
    paddingHorizontal: 4,
    borderRadius: 9,
    backgroundColor: '#e11d48',
    borderWidth: 1.5,
    borderColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: { fontFamily: font.uiBold, fontSize: 9.5, lineHeight: 12, color: colors.white },
  tileLabel: {
    fontFamily: font.uiSemibold,
    fontSize: 9.5,
    lineHeight: 11,
    color: colors.brand.DEFAULT,
    textAlign: 'center',
  },
  search: {
    marginTop: space.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 2,
    borderColor: colors.brand.accent,
    borderRadius: radii.tile,
    paddingLeft: space.lg,
    paddingRight: 4,
    height: 42,
  },
  searchTap: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, height: '100%' },
  scan: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  mic: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.brand.DEFAULT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchText: {
    fontFamily: font.body,
    fontSize: 15,
    color: colors.text.placeholder,
    flexShrink: 1,
  },
});
