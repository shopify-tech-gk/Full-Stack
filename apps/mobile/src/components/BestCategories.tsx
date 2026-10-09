import { useMemo, useRef, useState } from 'react';
import { FlatList, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { lookupCategoryImage } from '@/lib/category-images';
import { bestCategorySlides, catalogSlugOf } from '@/lib/home-categories';
import { colors, font, radii, space } from '@/theme';

const CARD_WIDTH = 150;

/**
 * "Best Categories Today" — the DESKTOP design, adapted natively: a white rounded card with a
 * tinted header (eyebrow + category title + sub-count + Shop button + prev/next arrows), a
 * scrollable category chip bar, and a horizontal row of sub-category tiles. Uses the SAME taxonomy
 * categories/sub-categories as the home cards / Explore Categories, so every tile has its artwork.
 */
export function BestCategories() {
  const router = useRouter();
  const slides = useMemo(() => bestCategorySlides(), []);
  const [index, setIndex] = useState(0);
  const chipsRef = useRef<ScrollView>(null);
  const trackRef = useRef<FlatList>(null);
  const slide = slides[index];
  if (!slide) return null;

  // Open a taxonomy node's listing (carry the taxo path so the sub-category strip shows).
  const open = (href: string, name: string, taxo: string) => {
    if (href.startsWith('/search')) {
      router.push({ pathname: '/search', params: { q: name } });
    } else {
      router.push(`/category/${catalogSlugOf(href)}?taxo=${taxo}`);
    }
  };

  const go = (next: number) => {
    const wrapped = (next + slides.length) % slides.length;
    setIndex(wrapped);
    trackRef.current?.scrollToOffset({ offset: 0, animated: false });
    chipsRef.current?.scrollTo({ x: Math.max(0, wrapped * 92 - 60), animated: true });
  };

  return (
    <View style={styles.wrap}>
      <View style={styles.card}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.eyebrowRow}>
            <View style={styles.dash} />
            <Text style={styles.eyebrow}>Best Categories Today</Text>
          </View>

          <View style={styles.titleRow}>
            <Text style={styles.title}>{slide.name}</Text>
            <Text style={styles.sub}>{slide.items.length} sub-categories</Text>
          </View>

          <View style={styles.actions}>
            <Pressable
              style={styles.shopBtn}
              onPress={() => open(slide.href, slide.name, slide.slug)}
            >
              <Text style={styles.shopText}>Shop {slide.name}</Text>
              <Ionicons name="arrow-forward" size={14} color={colors.white} />
            </Pressable>
            <View style={styles.arrowGroup}>
              <Pressable
                style={styles.arrow}
                onPress={() => go(index - 1)}
                accessibilityLabel="Previous category"
              >
                <Ionicons name="chevron-back" size={18} color={colors.brand.DEFAULT} />
              </Pressable>
              <Pressable
                style={styles.arrow}
                onPress={() => go(index + 1)}
                accessibilityLabel="Next category"
              >
                <Ionicons name="chevron-forward" size={18} color={colors.brand.DEFAULT} />
              </Pressable>
            </View>
          </View>

          {/* Category chips */}
          <ScrollView
            ref={chipsRef}
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.chips}
          >
            {slides.map((s, i) => {
              const on = i === index;
              return (
                <Pressable
                  key={s.slug}
                  onPress={() => go(i)}
                  style={[styles.chip, on && styles.chipActive]}
                >
                  <Text numberOfLines={1} style={[styles.chipText, on && styles.chipTextActive]}>
                    {s.name}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>

        {/* Sub-category tiles */}
        <FlatList
          ref={trackRef}
          horizontal
          data={slide.items}
          keyExtractor={(it) => it.key}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.track}
          ItemSeparatorComponent={() => <View style={{ width: space.md }} />}
          renderItem={({ item }) => {
            const image = lookupCategoryImage(item.imageKey);
            return (
              <Pressable
                style={styles.tile}
                onPress={() => open(item.href, item.name, `${slide.slug}~${item.slug}`)}
              >
                <View style={styles.tileImage}>
                  {image ? (
                    <Image
                      source={image}
                      style={StyleSheet.absoluteFill}
                      contentFit="cover"
                      transition={150}
                    />
                  ) : (
                    <Ionicons name="pricetags-outline" size={30} color={colors.card.border} />
                  )}
                </View>
                <View style={styles.tileBar}>
                  <Text numberOfLines={1} style={styles.tileName}>
                    {item.name}
                  </Text>
                  <View style={styles.tileArrow}>
                    <Ionicons name="chevron-forward" size={12} color={colors.brand.DEFAULT} />
                  </View>
                </View>
              </Pressable>
            );
          }}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginTop: space.xxl, paddingHorizontal: space.md },
  card: {
    backgroundColor: colors.white,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: colors.brandPopup.border,
    overflow: 'hidden',
  },
  header: {
    backgroundColor: colors.brandPopup.bg,
    paddingHorizontal: space.lg,
    paddingTop: space.lg,
    paddingBottom: space.md,
  },
  eyebrowRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  dash: { width: 22, height: 3, borderRadius: 2, backgroundColor: colors.brand.DEFAULT },
  eyebrow: {
    fontFamily: font.uiBold,
    fontSize: 11.5,
    color: colors.brand.DEFAULT,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 8,
    flexWrap: 'wrap',
    marginTop: 6,
  },
  title: { fontFamily: font.uiBold, fontSize: 24, color: colors.heading },
  sub: { fontFamily: font.body, fontSize: 13, color: colors.text.muted },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: space.md,
  },
  shopBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.brand.DEFAULT,
    borderRadius: radii.pill,
    paddingHorizontal: 16,
    paddingVertical: 10,
    flexShrink: 1,
  },
  shopText: { fontFamily: font.uiSemibold, fontSize: 13, color: colors.white },
  arrowGroup: { flexDirection: 'row', gap: 8 },
  arrow: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.card.border,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chips: { gap: 8, paddingTop: space.md, paddingRight: space.lg },
  chip: {
    height: 34,
    justifyContent: 'center',
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.cart.line,
    backgroundColor: colors.white,
    paddingHorizontal: 14,
  },
  chipActive: { backgroundColor: colors.brand.DEFAULT, borderColor: colors.brand.DEFAULT },
  chipText: { fontFamily: font.uiSemibold, fontSize: 12.5, color: colors.heading },
  chipTextActive: { color: colors.white },
  track: { paddingHorizontal: space.lg, paddingVertical: space.lg },
  tile: {
    width: CARD_WIDTH,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.cart.line,
    backgroundColor: colors.white,
    overflow: 'hidden',
  },
  tileImage: {
    aspectRatio: 2 / 3,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.brandPopup.bg,
    overflow: 'hidden',
  },
  tileBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 6,
    borderTopWidth: 1,
    borderTopColor: colors.cart.line,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  tileName: { flex: 1, fontFamily: font.uiSemibold, fontSize: 13, color: colors.heading },
  tileArrow: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.brand.DEFAULT,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
