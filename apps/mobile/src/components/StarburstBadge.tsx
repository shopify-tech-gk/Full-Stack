import { StyleSheet, Text, View } from 'react-native';
import { colors, font } from '@/theme';

/**
 * Starburst "offer" badge (native, no SVG): two stacked rotated squares make an 8-point burst in
 * the live offer colours, with the two-line offer text centered — the premium sale-badge look.
 */
export function StarburstBadge({
  lines,
  size = 62,
}: {
  lines: readonly [string, string];
  size?: number;
}) {
  const sq = size * 0.72;
  const inner = size * 0.56;
  const compact = lines[0].length >= 8;
  const burst = (dim: number, color: string, rotate: string) => ({
    position: 'absolute' as const,
    width: dim,
    height: dim,
    borderRadius: dim * 0.14,
    backgroundColor: color,
    transform: [{ rotate }],
  });

  return (
    <View style={[styles.wrap, { width: size, height: size }]}>
      <View style={burst(sq, colors.offerBadge.outer, '0deg')} />
      <View style={burst(sq, colors.offerBadge.outer, '45deg')} />
      <View style={burst(inner, colors.offerBadge.inner, '0deg')} />
      <View style={burst(inner, colors.offerBadge.inner, '45deg')} />
      <Text style={[styles.text, { fontSize: compact ? 8.5 : 9.5 }]}>
        {lines[0]}
        {'\n'}
        {lines[1]}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', justifyContent: 'center' },
  text: {
    fontFamily: font.uiBold,
    color: colors.offerBadge.text,
    textAlign: 'center',
    lineHeight: 11,
  },
});
