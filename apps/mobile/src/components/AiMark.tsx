import { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  ReduceMotion,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { colors, font } from '@/theme';

// v1.18 YouMart AI's own mark: an aurora gradient sphere with "AI" lettering, a tilted orbit ring
// and a glinting spark - drawn from views (no image), so it's crisp at any size.

const GRADIENT = 'linear-gradient(140deg, #22d3ee 0%, #6366f1 42%, #a855f7 72%, #ec4899 100%)';
const GLOSS = 'linear-gradient(180deg, rgba(255,255,255,0.42) 0%, rgba(255,255,255,0) 100%)';

export function AiMark({ size = 48, animated = false }: { size?: number; animated?: boolean }) {
  const spin = useSharedValue(0);
  const glint = useSharedValue(0);

  useEffect(() => {
    if (!animated) return;
    spin.value = withRepeat(
      withTiming(1, { duration: 9000, easing: Easing.linear, reduceMotion: ReduceMotion.Never }),
      -1,
      false,
    );
    glint.value = withRepeat(
      withSequence(
        withTiming(0, { duration: 1800 }),
        withTiming(1, { duration: 450 }),
        withTiming(0, { duration: 450 }),
      ),
      -1,
      false,
    );
  }, [animated, spin, glint]);

  const ring = useAnimatedStyle(() => ({
    transform: [{ rotate: `${-28 + spin.value * 360}deg` }, { scaleY: 0.42 }],
  }));
  const spark = useAnimatedStyle(() => ({
    opacity: 0.75 + glint.value * 0.25,
    transform: [{ scale: 1 + glint.value * 0.35 }],
  }));

  const ringSize = size * 0.92;
  const dot = Math.max(3, size * 0.13);

  return (
    <View
      style={[styles.sphere, { width: size, height: size, borderRadius: size / 2 }]}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <View
        style={[
          StyleSheet.absoluteFill,
          { borderRadius: size / 2, experimental_backgroundImage: GLOSS, height: size * 0.55 },
        ]}
      />
      <Animated.View
        style={[
          styles.ring,
          {
            width: ringSize,
            height: ringSize,
            borderRadius: ringSize / 2,
            borderWidth: Math.max(1, size * 0.035),
          },
          ring,
        ]}
      />
      <Text
        style={[styles.ai, { fontSize: size * 0.34, letterSpacing: -size * 0.01 }]}
        allowFontScaling={false}
      >
        AI
      </Text>
      <Animated.View
        style={[
          styles.spark,
          {
            width: dot,
            height: dot,
            borderRadius: dot / 2,
            top: size * 0.14,
            right: size * 0.16,
          },
          spark,
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  sphere: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    experimental_backgroundImage: GRADIENT,
  },
  ring: { position: 'absolute', borderColor: 'rgba(255,255,255,0.6)' },
  ai: { fontFamily: font.uiBold, color: colors.white, includeFontPadding: false },
  spark: {
    position: 'absolute',
    backgroundColor: colors.white,
    shadowColor: colors.white,
    shadowOpacity: 0.9,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 0 },
  },
});
