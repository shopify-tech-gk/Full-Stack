import { useRef, useState } from 'react';
import {
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { PROMO_BANNER_SLIDES } from '@youmart/shared-client';
import { colors, font, radii, space } from '@/theme';

// Promo banners as a native paging carousel. The live banner artwork is kept as placeholders
// (per the "don't import youmartshop.com images" rule) — rendered as premium branded cards.
const BANNERS = PROMO_BANNER_SLIDES.flat();
const TONES = [
  colors.brand.DEFAULT,
  colors.info.maroon,
  colors.brand.accent,
  colors.feature.guarantee,
];

/** Last path segment of a shared-client category href, for native routing. */
function slugFromHref(href: string): string {
  return href.split('?')[0]!.split('/').filter(Boolean).pop() ?? '';
}

export function PromoCarousel() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const [index, setIndex] = useState(0);
  const onScroll = useRef((e: NativeSyntheticEvent<NativeScrollEvent>) => {
    setIndex(Math.round(e.nativeEvent.contentOffset.x / width));
  }).current;

  return (
    <View style={styles.wrap}>
      <FlatList
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        data={BANNERS}
        keyExtractor={(b) => b.id}
        onMomentumScrollEnd={onScroll}
        renderItem={({ item, index: i }) => (
          <Pressable
            onPress={() => router.push(`/category/${slugFromHref(item.href)}`)}
            style={({ pressed }) => [{ width }, pressed && styles.pressed]}
          >
            <View style={[styles.card, { backgroundColor: TONES[i % TONES.length] }]}>
              <View style={styles.badge}>
                <Text style={styles.badgeText}>YouMart</Text>
              </View>
              <Text style={styles.title}>{item.title}</Text>
              <View style={styles.cta}>
                <Text style={styles.ctaText}>Shop now</Text>
                <Ionicons name="arrow-forward" size={14} color={colors.brand.DEFAULT} />
              </View>
            </View>
          </Pressable>
        )}
      />
      <View style={styles.dots}>
        {BANNERS.map((b, i) => (
          <View key={b.id} style={[styles.dot, i === index && styles.dotActive]} />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginTop: space.md },
  pressed: { opacity: 0.92 },
  card: {
    marginHorizontal: space.lg,
    borderRadius: radii.banner + 6,
    padding: space.xl,
    height: 150,
    justifyContent: 'space-between',
    overflow: 'hidden',
  },
  badge: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255,255,255,0.22)',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  badgeText: { fontFamily: font.uiBold, fontSize: 11, color: colors.white, letterSpacing: 0.5 },
  title: { fontFamily: font.uiBold, fontSize: 20, color: colors.white, maxWidth: '85%' },
  cta: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.white,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 7,
  },
  ctaText: { fontFamily: font.uiSemibold, fontSize: 13, color: colors.brand.DEFAULT },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: 6, marginTop: space.md },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: colors.card.border },
  dotActive: { backgroundColor: colors.brand.DEFAULT, width: 18 },
});
