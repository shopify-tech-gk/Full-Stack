import { Image } from 'expo-image';
import { StyleSheet, Text, View } from 'react-native';
import { colors, font } from '@/theme';

// youmartshop.com's offer starburst: its exact 28-point red burst with the pale-yellow inner burst
// (rendered once from the live site's SVG polygons - same shape as the website's OfferBadge).
// eslint-disable-next-line @typescript-eslint/no-require-imports
const STARBURST = require('../../assets/badges/starburst.png');

/** The live offer badge: starburst + two-line offer ("5% to 90%" / "OFF") in the live brown. */
export function StarburstBadge({
  lines,
  size = 70,
}: {
  lines: readonly [string, string];
  size?: number;
}) {
  // Live shrinks the text when the first line is long ("5% to 90%").
  const compact = lines[0].length >= 8;
  const fontSize = (compact ? 9 : 10) * (size / 70);
  return (
    <View style={[styles.wrap, { width: size, height: size }]}>
      <Image source={STARBURST} style={styles.burst} contentFit="contain" />
      <Text
        style={[
          styles.text,
          { fontSize, lineHeight: fontSize * 1.1, paddingHorizontal: size * 0.12 },
        ]}
        numberOfLines={2}
      >
        {lines[0]}
        {'\n'}
        {lines[1]}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    justifyContent: 'center',
    // Live: drop-shadow(0 1px 2px rgba(0,0,0,.25)).
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 2,
    shadowOffset: { width: 0, height: 1 },
  },
  burst: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  text: {
    fontFamily: font.uiMedium,
    color: colors.offerBadge.text,
    textAlign: 'center',
    marginTop: 1,
  },
});
