import { useEffect, useRef } from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { usePathname } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeInDown, FadeOutDown } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { useCart } from '@/stores/cart';
import { BAR_SPACE, bottomBarShown } from './GlobalTabBar';
import { colors, font, space } from '@/theme';

const SHOW_MS = 5000;

/**
 * Why a cart change didn't go through ("Sorry, this product is out of stock.", "we have only 2 in
 * stock"...), on whatever screen the shopper is on - just above the bottom bar. Without it a
 * refused Add looked like a dead button.
 */
export function CartNoticeToast() {
  const { notice, clearNotice } = useCart();
  const pathname = usePathname() ?? '/';
  const insets = useSafeAreaInsets();

  // Exactly SHOW_MS from when the message appears (the store recreates clearNotice on every cart
  // change, so it is read through a ref rather than restarting the timer).
  const clear = useRef(clearNotice);
  clear.current = clearNotice;
  useEffect(() => {
    if (!notice) return;
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => undefined);
    const t = setTimeout(() => clear.current(), SHOW_MS);
    return () => clearTimeout(t);
  }, [notice]);

  if (!notice) return null;
  const bottom = bottomBarShown(pathname) ? BAR_SPACE + 10 : insets.bottom + 16;

  return (
    <Animated.View
      entering={FadeInDown.duration(220)}
      exiting={FadeOutDown.duration(160)}
      style={[styles.wrap, { bottom }]}
    >
      <Pressable onPress={clearNotice} style={styles.toast} accessibilityRole="alert">
        <Ionicons name="alert-circle" size={20} color={colors.white} />
        <Text style={styles.text}>{notice}</Text>
        <Ionicons name="close" size={16} color="rgba(255,255,255,0.8)" />
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: space.md, right: space.md, zIndex: 70, elevation: 32 },
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#c62828',
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 14,
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
  },
  text: { flex: 1, fontFamily: font.uiSemibold, fontSize: 13.5, color: colors.white },
});
