import { useEffect } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import {
  FREE_DELIVERY_MIN,
  formatMoney,
  freeDeliveryProgress,
  type Money,
} from '@youmart/shared-client';
import { colors, font } from '@/theme';

/**
 * "Add ₹X more for FREE delivery" with a filling progress bar; "You've unlocked FREE delivery"
 * once the cart reaches FREE_DELIVERY_MIN. `tone` = light (on white) or dark (inside the popup).
 */
export function FreeDeliveryBar({
  subtotal,
  tone = 'light',
  compact = false,
}: {
  subtotal: Money;
  tone?: 'light' | 'dark';
  /** Tighter one-line version (cart summary): smaller icon and text, no footnote. */
  compact?: boolean;
}) {
  const p = freeDeliveryProgress(subtotal);
  const fill = useSharedValue(p.ratio);
  useEffect(() => {
    fill.value = withTiming(p.ratio, { duration: 450 });
  }, [p.ratio, fill]);
  const fillStyle = useAnimatedStyle(() => ({ width: `${fill.value * 100}%` }));
  const dark = tone === 'dark';

  return (
    <View style={[styles.wrap, compact && styles.wrapCompact]}>
      <View style={styles.row}>
        {/* A delivery rider zooming along; a green tick joins it once delivery is free. */}
        <View style={p.unlocked ? styles.iconUnlocked : undefined}>
          <SpeedBike size={compact ? 22 : 28} color={dark ? colors.white : colors.brand.DEFAULT} />
          {p.unlocked ? (
            <View style={styles.tick}>
              <Ionicons name="checkmark" size={9} color={colors.white} />
            </View>
          ) : null}
        </View>
        <Text
          style={[styles.text, compact && styles.textCompact, dark && styles.textDark]}
          numberOfLines={compact ? 1 : 2}
        >
          {p.unlocked ? (
            <>
              <Text style={dark ? styles.strongDark : styles.strongGreen}>Yay! </Text>You&apos;ve
              unlocked{' '}
              <Text style={dark ? styles.strongDark : styles.strongGreen}>FREE delivery</Text>
            </>
          ) : (
            <>
              Add{' '}
              <Text style={dark ? styles.strongDark : styles.strong}>
                {formatMoney(p.remaining)}
              </Text>{' '}
              more for <Text style={dark ? styles.strongDark : styles.strong}>FREE delivery</Text>
            </>
          )}
        </Text>
      </View>
      <View style={[styles.track, compact && styles.trackCompact, dark && styles.trackDark]}>
        <Animated.View
          style={[
            styles.fill,
            {
              backgroundColor: dark ? colors.white : p.unlocked ? '#22c55e' : colors.brand.DEFAULT,
            },
            fillStyle,
          ]}
        />
      </View>
      {!p.unlocked && !compact ? (
        <Text style={[styles.hint, dark && styles.hintDark]}>
          Free delivery on orders of {formatMoney(FREE_DELIVERY_MIN)} or more
        </Text>
      ) : null}
    </View>
  );
}

// eslint-disable-next-line @typescript-eslint/no-require-imports
const RIDER = require('../../assets/icons/delivery-rider.png');
/** The rider artwork is 42 x 35. */
const RIDER_RATIO = 42 / 35;

/** Delivery rider (helmet, parcel box, scooter, speed lines) riding along with a slight bounce. */
function SpeedBike({ size, color }: { size: number; color: string }) {
  const bounce = useSharedValue(0);
  useEffect(() => {
    bounce.value = withRepeat(
      withSequence(withTiming(1, { duration: 140 }), withTiming(0, { duration: 160 })),
      -1,
      false,
    );
  }, [bounce]);
  const bikeStyle = useAnimatedStyle(() => ({ transform: [{ translateY: -bounce.value * 1.2 }] }));
  return (
    <Animated.View style={bikeStyle}>
      <Image
        source={RIDER}
        style={{ width: size * RIDER_RATIO, height: size, tintColor: color }}
        resizeMode="contain"
      />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 6 },
  wrapCompact: { gap: 4 },
  textCompact: { fontSize: 12 },
  trackCompact: { height: 4 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  // Room for the tick, which sits just outside the rider's top-right so it never covers the scooter.
  iconUnlocked: { marginRight: 8 },
  tick: {
    position: 'absolute',
    right: -12,
    top: -5,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#22c55e',
    borderWidth: 1.5,
    borderColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: { flex: 1, fontFamily: font.uiMedium, fontSize: 13, color: colors.text.strong },
  textDark: { color: colors.white },
  strong: { fontFamily: font.uiBold, color: colors.brand.DEFAULT },
  strongDark: { fontFamily: font.uiBold, color: colors.white },
  strongGreen: { fontFamily: font.uiBold, color: '#22c55e' },
  track: { height: 6, borderRadius: 3, backgroundColor: '#e6ecf5', overflow: 'hidden' },
  trackDark: { backgroundColor: 'rgba(255,255,255,0.28)' },
  fill: { height: '100%', borderRadius: 3 },
  hint: { fontFamily: font.body, fontSize: 11, color: colors.text.muted },
  hintDark: { color: 'rgba(255,255,255,0.8)' },
});
