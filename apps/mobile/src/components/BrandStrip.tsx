import { StyleSheet, Text, View } from 'react-native';
import { BRAND_OFFERS } from '@youmart/shared-client';
import { colors, font, radii, space } from '@/theme';

// "Top Brands, Big Offers" — the live brand strip. Posters are kept as branded placeholder tiles
// (per the no-youmartshop.com-images rule); each shows the live offer badge.
const TONES = [
  colors.brand.DEFAULT,
  colors.info.maroon,
  colors.feature.guarantee,
  colors.brand.accent,
];

export function BrandStrip() {
  return (
    <View style={styles.wrap}>
      <View style={styles.head}>
        <View style={styles.accent} />
        <Text style={styles.heading}>Top Brands, Big Offers</Text>
      </View>
      <View style={styles.grid}>
        {BRAND_OFFERS.map((brand, i) => (
          <View key={brand.id} style={styles.tile}>
            <View style={[styles.poster, { backgroundColor: TONES[i % TONES.length] }]}>
              <Text style={styles.brandName}>{brand.name}</Text>
            </View>
            <View style={styles.badge}>
              <Text style={styles.badgeTop}>{brand.badge[0]}</Text>
              <Text style={styles.badgeBottom}>{brand.badge[1]}</Text>
            </View>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginTop: space.xxl, paddingHorizontal: space.lg },
  head: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: space.md },
  accent: { width: 4, height: 18, borderRadius: 2, backgroundColor: colors.brand.DEFAULT },
  heading: { fontFamily: font.uiBold, fontSize: 17, color: colors.heading },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.md },
  tile: { width: '47%', flexGrow: 1, position: 'relative' },
  poster: {
    aspectRatio: 1.4,
    borderRadius: radii.brandTile / 2,
    alignItems: 'center',
    justifyContent: 'center',
    padding: space.md,
  },
  brandName: { fontFamily: font.uiBold, fontSize: 16, color: colors.white, textAlign: 'center' },
  badge: {
    position: 'absolute',
    bottom: -8,
    left: 10,
    backgroundColor: colors.offerBadge.inner,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 3,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: colors.offerBadge.outer,
  },
  badgeTop: { fontFamily: font.uiBold, fontSize: 11, color: colors.offerBadge.text },
  badgeBottom: { fontFamily: font.uiBold, fontSize: 9, color: colors.offerBadge.text },
});
