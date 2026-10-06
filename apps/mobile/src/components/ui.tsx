import { Image } from 'expo-image';
import {
  StyleSheet,
  Text,
  View,
  type ImageStyle,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { discountPercent, formatMoney, type Money } from '@youmart/shared-client';
import { colors, font } from '@/theme';
import { isRemoteImage } from '@/lib/image';

/** Loads a real network image; falls back to a branded native placeholder for shared-client's
 * web-relative/demo paths (the local catalog has no product images yet). */
export function ProductImage({
  src,
  style,
  icon = 34,
}: {
  src?: string;
  style?: StyleProp<ViewStyle>;
  icon?: number;
}) {
  if (isRemoteImage(src)) {
    return (
      <Image
        source={{ uri: src }}
        style={[styles.img, style] as StyleProp<ImageStyle>}
        contentFit="cover"
        transition={150}
      />
    );
  }
  return (
    <View style={[styles.img, styles.placeholder, style]}>
      <Ionicons name="image-outline" size={icon} color={colors.card.border} />
    </View>
  );
}

export function Price({
  mrp,
  price,
  size = 'md',
}: {
  mrp: Money;
  price: Money;
  size?: 'sm' | 'md' | 'lg';
}) {
  const off = discountPercent(mrp, price);
  return (
    <View style={styles.priceRow}>
      <Text style={[styles.price, size === 'lg' && styles.priceLg]}>{formatMoney(price)}</Text>
      {off > 0 && (
        <>
          <Text style={[styles.mrp, size === 'lg' && styles.mrpLg]}>{formatMoney(mrp)}</Text>
          <Text style={[styles.off, size === 'lg' && styles.offLg]}>{off}% OFF</Text>
        </>
      )}
    </View>
  );
}

export function Stars({ rating, size = 13 }: { rating: number; size?: number }) {
  const full = Math.round(rating);
  return (
    <View style={styles.stars}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Ionicons
          key={n}
          name={n <= full ? 'star' : 'star-outline'}
          size={size}
          color={colors.star.filled}
        />
      ))}
    </View>
  );
}

export function SectionTitle({ children }: { children: string }) {
  return <Text style={styles.sectionTitle}>{children}</Text>;
}

const styles = StyleSheet.create({
  img: { width: '100%', aspectRatio: 1, backgroundColor: colors.rail.thumb },
  placeholder: { alignItems: 'center', justifyContent: 'center' },
  priceRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6 },
  price: { fontFamily: font.uiBold, fontSize: 15, color: colors.text.strong },
  priceLg: { fontSize: 22 },
  mrp: {
    fontFamily: font.body,
    fontSize: 12,
    color: colors.price.label,
    textDecorationLine: 'line-through',
    textDecorationColor: colors.price.strike,
  },
  mrpLg: { fontSize: 15 },
  off: { fontFamily: font.uiSemibold, fontSize: 11.5, color: colors.price.discount },
  offLg: { fontSize: 14 },
  stars: { flexDirection: 'row', gap: 1 },
  sectionTitle: { fontFamily: font.uiBold, fontSize: 18, color: colors.heading },
});
