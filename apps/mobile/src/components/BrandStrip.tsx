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

const TILE = 156;
const GAP = 14;

/** "Top Brands, Big Offers" — premium brand tiles with the real desktop poster images inside a
 * gradient ring, the brand name, a "Shop" pill and the live starburst offer badge, on a soft
 * brand-tinted band. Native horizontal scroll. */
export function BrandStrip() {
  const router = useRouter();

  const openBrand = (href: string, name: string) => {
    // href = /category/<cat>?brand=...&orderby=discount — the brand's category, with only that
    // brand selected (the other brands stay as tiles to switch to).
    const slug = href.split('?')[0]?.split('/').filter(Boolean).pop() ?? '';
    if (slug) router.push({ pathname: '/category/[slug]', params: { slug, brand: name } });
  };

  return (
    <View style={styles.wrap}>
      {/* Soft brand-tinted band behind the whole section */}
      <View style={styles.band} pointerEvents="none" />

      <View style={styles.head}>
        <View style={{ flex: 1 }}>
          <View style={styles.eyebrow}>
            <Ionicons name="flash" size={10} color="#1f1300" />
            <Text style={styles.eyebrowText}>BRAND FEST</Text>
          </View>
          <Text style={styles.heading}>
            Top Brands, <Text style={styles.headingAccent}>Big Offers</Text>
          </Text>
          <Text style={styles.sub}>Biggest discounts first · tap a brand to shop</Text>
        </View>
        <View style={styles.swipeHint}>
          <Text style={styles.swipeText}>Swipe</Text>
          <Ionicons name="chevron-forward" size={13} color={colors.brand.DEFAULT} />
        </View>
      </View>

      <FlatList
        horizontal
        data={BRAND_OFFERS}
        keyExtractor={(b) => b.id}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.list}
        ItemSeparatorComponent={() => <View style={{ width: GAP }} />}
        decelerationRate="fast"
        snapToInterval={TILE + GAP}
        renderItem={({ item }) => (
          <Pressable
            style={({ pressed }) => [styles.tileWrap, pressed && styles.pressed]}
            onPress={() => openBrand(item.href, item.name)}
            accessibilityLabel={`${item.name}, ${item.badge.join(' ')}`}
          >
            {/* Gradient ring around the poster */}
            <View style={styles.ring}>
              <View style={styles.tile}>
                <Image
                  source={POSTERS[item.id]}
                  style={styles.poster}
                  contentFit="cover"
                  transition={200}
                />
                <View style={styles.scrim} />
                <View style={styles.namePill}>
                  <Text style={styles.nameText} numberOfLines={1}>
                    {item.name}
                  </Text>
                </View>
                <View style={styles.shopPill}>
                  <Text style={styles.shopText}>Shop</Text>
                  <View style={styles.shopArrow}>
                    <Ionicons name="arrow-forward" size={10} color={colors.white} />
                  </View>
                </View>
              </View>
            </View>
            <View style={styles.badge}>
              <StarburstBadge lines={item.badge} size={64} />
            </View>
          </Pressable>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginTop: space.xxl, paddingTop: space.lg, paddingBottom: space.sm },
  band: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    experimental_backgroundImage:
      'linear-gradient(180deg, rgba(1,66,170,0.08) 0%, rgba(124,58,237,0.05) 60%, rgba(255,255,255,0) 100%)',
  },
  head: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: space.lg,
    marginBottom: space.sm,
    gap: 10,
  },
  eyebrow: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#ffe500',
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 2,
    marginBottom: 5,
  },
  eyebrowText: { fontFamily: font.uiBold, fontSize: 9.5, letterSpacing: 0.8, color: '#1f1300' },
  heading: { fontFamily: font.uiBold, fontSize: 19, color: colors.heading },
  headingAccent: { color: colors.brand.DEFAULT },
  sub: { fontFamily: font.body, fontSize: 12, color: colors.text.muted, marginTop: 2 },
  swipeHint: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    backgroundColor: colors.white,
    borderRadius: 999,
    paddingLeft: 10,
    paddingRight: 6,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: 'rgba(1,66,170,0.15)',
  },
  swipeText: { fontFamily: font.uiSemibold, fontSize: 11, color: colors.brand.DEFAULT },
  list: { paddingHorizontal: space.lg, paddingTop: 10, paddingBottom: 18 },
  tileWrap: { width: TILE },
  pressed: { opacity: 0.92, transform: [{ scale: 0.97 }] },
  ring: {
    borderRadius: 24,
    padding: 2,
    experimental_backgroundImage: 'linear-gradient(135deg, #2f6ae8 0%, #7c3aed 50%, #ffe500 100%)',
    shadowColor: colors.brand.DEFAULT,
    shadowOpacity: 0.25,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 7 },
    elevation: 5,
  },
  tile: {
    width: TILE - 4,
    height: TILE - 4,
    borderRadius: 22,
    overflow: 'hidden',
    backgroundColor: colors.white,
  },
  poster: { width: '100%', height: '100%' },
  scrim: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: '55%',
    experimental_backgroundImage:
      'linear-gradient(180deg, rgba(0,0,0,0) 0%, rgba(0,0,0,0.45) 100%)',
  },
  namePill: {
    position: 'absolute',
    top: 8,
    left: 8,
    maxWidth: TILE - 24,
    backgroundColor: 'rgba(11,27,63,0.55)',
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.25)',
  },
  nameText: { fontFamily: font.uiBold, fontSize: 10.5, color: colors.white, letterSpacing: 0.3 },
  shopPill: {
    position: 'absolute',
    bottom: 9,
    right: 9,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: colors.white,
    borderRadius: 999,
    paddingLeft: 10,
    paddingRight: 3,
    paddingVertical: 3,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 3,
  },
  shopText: { fontFamily: font.uiBold, fontSize: 11.5, color: colors.brand.DEFAULT },
  shopArrow: {
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.brand.DEFAULT,
  },
  // Live: the starburst overlaps the poster's bottom-left corner.
  badge: { position: 'absolute', bottom: -8, left: -8 },
});
