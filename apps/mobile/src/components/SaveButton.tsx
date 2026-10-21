import { Pressable, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { colors } from '@/theme';

const SAVED = colors.brand.DEFAULT;

/**
 * Save-for-later (wishlist / Favourites) toggle: a bookmark that fills in. Saving pops the icon
 * with a little tilt, sends a ring out from it and gives a light tap; un-saving shrinks it softly.
 * Used on product cards and the product page.
 */
export function SaveButton({
  saved,
  onToggle,
  size = 18,
  diameter = 34,
  style,
}: {
  saved: boolean;
  onToggle: () => void;
  /** Icon size. */
  size?: number;
  /** The round white button's size. */
  diameter?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const scale = useSharedValue(1);
  const tilt = useSharedValue(0);
  const ring = useSharedValue(0); // 0 -> 1 while the ring expands and fades

  const iconStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }, { rotate: `${tilt.value}deg` }],
  }));
  const ringStyle = useAnimatedStyle(() => ({
    opacity: ring.value === 0 ? 0 : 0.55 * (1 - ring.value),
    transform: [{ scale: 0.6 + ring.value * 0.9 }],
  }));

  const press = () => {
    if (!saved) {
      // Saving: pop + tilt + ring.
      scale.value = withSequence(
        withTiming(1.45, { duration: 130, easing: Easing.out(Easing.quad) }),
        withSpring(1, { damping: 5, stiffness: 220 }),
      );
      tilt.value = withSequence(
        withTiming(-14, { duration: 90 }),
        withTiming(10, { duration: 110 }),
        withSpring(0, { damping: 6 }),
      );
      ring.value = 0.001;
      ring.value = withTiming(1, { duration: 520, easing: Easing.out(Easing.cubic) }, () => {
        ring.value = 0;
      });
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
    } else {
      // Un-saving: a quick soft shrink.
      scale.value = withSequence(
        withTiming(0.75, { duration: 100 }),
        withSpring(1, { damping: 8 }),
      );
      void Haptics.selectionAsync().catch(() => undefined);
    }
    onToggle();
  };

  return (
    <Pressable
      onPress={press}
      hitSlop={8}
      accessibilityRole="button"
      accessibilityLabel={saved ? 'Remove from saved' : 'Save for later'}
      accessibilityState={{ selected: saved }}
      style={({ pressed }) => [
        styles.button,
        { width: diameter, height: diameter, borderRadius: diameter / 2 },
        saved && styles.buttonSaved,
        pressed && styles.pressed,
        style,
      ]}
    >
      <Animated.View
        pointerEvents="none"
        style={[
          styles.ring,
          { width: diameter, height: diameter, borderRadius: diameter / 2 },
          ringStyle,
        ]}
      />
      <Animated.View style={iconStyle}>
        <Ionicons
          name={saved ? 'bookmark' : 'bookmark-outline'}
          size={size}
          color={saved ? SAVED : colors.brand.DEFAULT}
        />
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.card.border,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  buttonSaved: { backgroundColor: '#eef3ff', borderColor: SAVED },
  pressed: { opacity: 0.8 },
  ring: {
    position: 'absolute',
    borderWidth: 2,
    borderColor: SAVED,
  },
});
