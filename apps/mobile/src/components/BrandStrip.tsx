import { Image } from 'expo-image';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { BRAND_OFFERS } from '@youmart/shared-client';
import { StarburstBadge } from './StarburstBadge';
import { colors, font, space } from '@/theme';

// Real brand poster images (our own desktop assets), bundled for native. Keyed by BRAND_OFFERS id.
/* eslint-disable @typescript-eslint/no-require-imports */
const POSTERS: Record<string, number> = {
  'loreal-paris': require('../../assets/brands/loreal-paris.webp'),
  philips: require('../../assets/brands/philips.webp'),
  hawkins: require('../../assets/brands/hawkins.webp'),
  samsung: require('../../assets/brands/samsung.webp'),
  cosco: require('../../assets/brands/cosco.webp'),
  safari: require('../../assets/brands/safari.webp'),
  bosch: require('../../assets/brands/bosch.webp'),
  havells: require('../../assets/brands/havells.webp'),
};
/* eslint-enable @typescript-eslint/no-require-imports */

const TILE = 158;

/** "Top Brands, Big Offers" — premium brand tiles with the real desktop poster images, a dark
 * bottom scrim + "Shop" pill, and the live starburst offer badge. Native horizontal scroll. */
export function BrandStrip() {
  const router = useRouter();

  const openBrand = (href: string) => {
    // href = /category/<cat>?brand=...&orderby=discount — route to the category listing.
    const slug = href.split('?')[0]?.split('/').filter(Boolean).pop() ?? '';
    if (slug) router.push(`/category/${slug}`);
  };

  return (
    <View style={styles.wrap}>
      <View style={styles.head}>
        <View style={styles.titleRow}>
          <View style={styles.accent} />
          <Text style={styles.heading}>
            Top Brands, <Text style={styles.headingAccent}>Big Offers</Text>
          </Text>
        </View>
        <Text style={styles.sub}>Biggest discounts first</Text>
      </View>

      <FlatList
        horizontal
        data={BRAND_OFFERS}
        keyExtractor={(b) => b.id}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.list}
        ItemSeparatorComponent={() => <View style={{ width: space.lg }} />}
        decelerationRate="fast"
        snapToInterval={TILE + space.lg}
        renderItem={({ item }) => (
          <Pressable
            style={({ pressed }) => [styles.tileWrap, pressed && styles.pressed]}
            onPress={() => openBrand(item.href)}
            accessibilityLabel={`${item.name}, ${item.badge.join(' ')}`}
          >
            <View style={styles.tile}>
              <Image
                source={POSTERS[item.id]}
                style={styles.poster}
                contentFit="cover"
                transition={200}
              />
              <View style={styles.scrim} />
              <View style={styles.shopPill}>
                <Text style={styles.shopText}>Shop</Text>
                <Ionicons name="arrow-forward" size={11} color={colors.brand.DEFAULT} />
              </View>
            </View>
            <View style={styles.badge}>
              <StarburstBadge lines={item.badge} />
            </View>
          </Pressable>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginTop: space.xxl },
  head: { paddingHorizontal: space.lg, marginBottom: space.md },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  accent: { width: 4, height: 18, borderRadius: 2, backgroundColor: colors.brand.DEFAULT },
  heading: { fontFamily: font.uiBold, fontSize: 18, color: colors.heading },
  headingAccent: { color: colors.brand.DEFAULT },
  sub: {
    fontFamily: font.body,
    fontSize: 12.5,
    color: colors.text.muted,
    marginTop: 2,
    marginLeft: 14,
  },
  list: { paddingHorizontal: space.lg, paddingTop: 10, paddingBottom: 14 },
  tileWrap: { width: TILE },
  pressed: { opacity: 0.9 },
  tile: {
    width: TILE,
    height: TILE,
    borderRadius: 22,
    overflow: 'hidden',
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: 'rgba(1,66,170,0.1)',
    shadowColor: colors.brand.DEFAULT,
    shadowOpacity: 0.28,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
    elevation: 5,
  },
  poster: { width: '100%', height: '100%' },
  scrim: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: '40%',
    backgroundColor: 'rgba(0,0,0,0.18)',
  },
  shopPill: {
    position: 'absolute',
    bottom: 10,
    right: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.white,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 3,
  },
  shopText: { fontFamily: font.uiSemibold, fontSize: 11.5, color: colors.brand.DEFAULT },
  badge: { position: 'absolute', bottom: -6, left: -6 },
});
