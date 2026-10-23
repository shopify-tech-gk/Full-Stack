import { useEffect } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { colors, font } from '@/theme';

const ORB_GRADIENT = 'linear-gradient(135deg, #60a5fa 0%, #0142aa 45%, #7c3aed 100%)';

/**
 * v1.17 the centre item of the bottom bar (both the tab bar and GlobalTabBar): a breathing
 * gradient orb that opens YouMart AI. It is a shortcut, not a tab - the assistant opens on top.
 */
export function AiNavButton() {
  const router = useRouter();
  const glow = useSharedValue(0);
  const press = useSharedValue(1);
  const twinkle = useSharedValue(0);

  useEffect(() => {
    glow.value = withRepeat(
      withTiming(1, { duration: 1600, easing: Easing.inOut(Easing.quad) }),
      -1,
      true,
    );
    twinkle.value = withRepeat(
      withSequence(
        withTiming(0, { duration: 2400 }),
        withTiming(1, { duration: 260 }),
        withTiming(0, { duration: 260 }),
      ),
      -1,
      false,
    );
  }, [glow, twinkle]);

  const halo = useAnimatedStyle(() => ({
    opacity: 0.12 + glow.value * 0.18,
    transform: [{ scale: 0.9 + glow.value * 0.15 }],
  }));
  const orb = useAnimatedStyle(() => ({ transform: [{ scale: press.value }] }));
  const spark = useAnimatedStyle(() => ({
    transform: [{ rotate: `${twinkle.value * 20}deg` }, { scale: 1 + twinkle.value * 0.15 }],
  }));

  return (
    <Pressable
      style={styles.item}
      accessibilityRole="button"
      accessibilityLabel="YouMart AI - ask our shopping assistant"
      onPressIn={() => {
        press.value = withSpring(0.86, { damping: 12, stiffness: 300 });
      }}
      onPressOut={() => {
        press.value = withSpring(1, { damping: 8, stiffness: 220 });
      }}
      onPress={() => {
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => undefined);
        router.push('/help/assistant');
      }}
    >
      <View style={styles.raise}>
        <Animated.View style={[styles.halo, halo]} />
        <Animated.View style={[styles.orb, orb]}>
          <Animated.View style={spark}>
            <Ionicons name="sparkles" size={15} color={colors.white} />
          </Animated.View>
        </Animated.View>
      </View>
      <Text style={styles.label}>YouMart AI</Text>
    </Pressable>
  );
}

/** About the size of the other tab icons (24), so the orb sits in the same row. */
const SIZE = 28;
const HALO = SIZE + 6;

const styles = StyleSheet.create({
  // Same layout as the other bar items: icon, then the label, centred.
  item: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 2, paddingTop: 4 },
  // 24 tall like the other icons; the slightly bigger orb overflows by 2 on each side.
  raise: { width: HALO, height: 24, alignItems: 'center', justifyContent: 'center' },
  halo: {
    position: 'absolute',
    width: HALO,
    height: HALO,
    borderRadius: HALO / 2,
    backgroundColor: '#3b82f6',
  },
  orb: {
    width: SIZE,
    height: SIZE,
    borderRadius: SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
    experimental_backgroundImage: ORB_GRADIENT,
  },
  label: { fontFamily: font.uiBold, fontSize: 11, color: colors.brand.DEFAULT },
});
