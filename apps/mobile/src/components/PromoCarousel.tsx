import { useEffect, useRef, useState } from 'react';
import {
  FlatList,
  Pressable,
  StyleSheet,
  View,
  useWindowDimensions,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { PROMO_BANNER_SLIDES, PROMO_SLIDER_INTERVAL_MS } from '@youmart/shared-client';
import { colors, radii, space } from '@/theme';

// Real desktop banner poster images (our own assets), bundled for native. Keyed by banner id.
/* eslint-disable @typescript-eslint/no-require-imports */
const POSTERS: Record<string, number> = {
  'pet-products': require('../../assets/banners/pet-products.webp'),
  'sport-gear': require('../../assets/banners/sport-gear.webp'),
  'kitchen-pro': require('../../assets/banners/kitchen-pro.webp'),
  'tech-deals': require('../../assets/banners/tech-deals.webp'),
};
/* eslint-enable @typescript-eslint/no-require-imports */

const BANNERS = PROMO_BANNER_SLIDES.flat();
const RATIO = 3.2; // posters are 1536x480

/** Promo slider — the desktop design with the real banner poster images: full-width landscape
 * banners, native paging swipe, auto-advance with a pause/play control, and dots (like desktop). */
export function PromoCarousel() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const listRef = useRef<FlatList>(null);
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);

  const slideWidth = width - space.lg * 2;
  const bannerHeight = slideWidth / RATIO;

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    setIndex(Math.round(e.nativeEvent.contentOffset.x / width));
  };

  // Auto-advance (pausable), like the desktop slider.
  useEffect(() => {
    if (paused) return;
    const t = setInterval(() => {
      setIndex((i) => {
        const next = (i + 1) % BANNERS.length;
        listRef.current?.scrollToOffset({ offset: next * width, animated: true });
        return next;
      });
    }, PROMO_SLIDER_INTERVAL_MS);
    return () => clearInterval(t);
  }, [paused, width]);

  const openBanner = (href: string) => {
    const slug = href.split('?')[0]?.split('/').filter(Boolean).pop() ?? '';
    if (slug) router.push(`/category/${slug}`);
  };

  return (
    <View style={styles.wrap}>
      <FlatList
        ref={listRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        data={BANNERS}
        keyExtractor={(b) => b.id}
        onMomentumScrollEnd={onScroll}
        renderItem={({ item }) => (
          <Pressable
            onPress={() => openBanner(item.href)}
            style={({ pressed }) => [{ width }, pressed && styles.pressed]}
          >
            <Image
              source={POSTERS[item.id]}
              style={[styles.banner, { width: slideWidth, height: bannerHeight }]}
              contentFit="cover"
              transition={200}
            />
          </Pressable>
        )}
      />

      <View style={styles.controls}>
        <View style={styles.dots}>
          {BANNERS.map((b, i) => (
            <View key={b.id} style={[styles.dot, i === index && styles.dotActive]} />
          ))}
        </View>
        <Pressable onPress={() => setPaused((p) => !p)} hitSlop={8} style={styles.pause}>
          <Ionicons name={paused ? 'play' : 'pause'} size={12} color={colors.brand.DEFAULT} />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginTop: space.md },
  pressed: { opacity: 0.95 },
  banner: {
    marginHorizontal: space.lg,
    borderRadius: radii.banner + 6,
    backgroundColor: colors.brandPopup.bg,
  },
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    marginTop: space.md,
  },
  dots: { flexDirection: 'row', gap: 6 },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: colors.card.border },
  dotActive: { backgroundColor: colors.brand.DEFAULT, width: 18 },
  pause: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1,
    borderColor: colors.card.border,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
