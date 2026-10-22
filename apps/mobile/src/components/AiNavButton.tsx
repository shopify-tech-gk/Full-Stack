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
 * v1.17 the centre item of the bottom bar (both the tab bar and GlobalTabBar): a raised, breathing
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
    opacity: 0.16 + glow.value * 0.22,
    transform: [{ scale: 1 + glow.value * 0.22 }],
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
            <Ionicons name="sparkles" size={22} color={colors.white} />
          </Animated.View>
        </Animated.View>
      </View>
      <Text style={styles.label}>YouMart AI</Text>
    </Pressable>
  );
}

const SIZE = 50;

const styles = StyleSheet.create({
  item: { flex: 1, alignItems: 'center', justifyContent: 'flex-end', paddingBottom: 2 },
  raise: {
    width: SIZE + 8,
    height: SIZE + 8,
    marginTop: -24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  halo: {
    position: 'absolute',
    width: SIZE + 8,
    height: SIZE + 8,
    borderRadius: (SIZE + 8) / 2,
    backgroundColor: '#3b82f6',
  },
  orb: {
    width: SIZE,
    height: SIZE,
    borderRadius: SIZE / 2,
    borderWidth: 3,
    borderColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    experimental_backgroundImage: ORB_GRADIENT,
    shadowColor: '#0142aa',
    shadowOpacity: 0.35,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  label: { fontFamily: font.uiBold, fontSize: 11, color: colors.brand.DEFAULT, marginTop: 1 },
});
