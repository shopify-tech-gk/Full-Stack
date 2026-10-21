import { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
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
        {/* Delivery person with a parcel (was a bicycle); a green tick joins it once delivery is
            free. */}
        <View>
          <MaterialIcons
            name="delivery-dining"
            size={compact ? 20 : 26}
            color={dark ? colors.white : colors.brand.DEFAULT}
          />
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

const styles = StyleSheet.create({
  wrap: { gap: 6 },
  wrapCompact: { gap: 4 },
  textCompact: { fontSize: 12 },
  trackCompact: { height: 4 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  tick: {
    position: 'absolute',
    right: -3,
    bottom: -2,
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
