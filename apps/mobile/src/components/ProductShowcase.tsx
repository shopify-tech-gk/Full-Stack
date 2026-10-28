import { useEffect, useState } from 'react';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  PRODUCT_FILTER_TABS,
  type ProductCardData,
  type ProductFilter,
} from '@youmart/shared-client';
import { ProductCard } from './ProductCard';

/** Cards per row (v1.17 trying 3, compact cards; was 2 - set back to 2 to revert). */
const COLS: number = 3;
/** Rows shown at 3 across (7 x 3 = 21 products; getHome fetches 21 per tab). */
const ROWS = 7;
import { colors, font, space } from '@/theme';

// "Shop our picks": the three poster tabs from the desktop site (New Arrival / Hot Sale / Best
// Offer - each card keeps its colours and two-tone wording), sized for a phone row of three. The
// active poster lifts with a ring and a tick; the 2-column product grid below follows it.
interface Poster {
  icon: keyof typeof Ionicons.glyphMap;
  lead: string;
  word: string;
  note: string;
  bg: string;
  ink: string;
  leadTone: string;
  wordTone: string;
  ring: string;
  glow: string;
}

const POSTERS: Record<ProductFilter, Poster> = {
  new: {
    icon: 'sparkles',
    lead: 'New',
    word: 'Arrival',
    note: 'Fresh in store',
    bg: colors.brand.DEFAULT,
    ink: colors.white,
    leadTone: '#fee533',
    wordTone: colors.white,
    ring: colors.brand.DEFAULT,
    glow: 'rgba(1,66,170,0.55)',
  },
  all: {
    icon: 'flame',
    lead: 'Hot',
    word: 'Sale',
    note: 'Trending now',
    bg: '#fdd039',
    ink: colors.heading,
    leadTone: '#ff0000',
    wordTone: '#ff0000',
    ring: '#ff3300',
    glow: 'rgba(255,51,0,0.45)',
  },
  sale: {
    icon: 'pricetags',
    lead: 'Best',
    word: 'Offer',
    note: 'Biggest savings',
    bg: colors.heading,
    ink: colors.white,
    leadTone: colors.white,
    wordTone: '#ff3300',
    ring: colors.heading,
    glow: 'rgba(15,23,42,0.6)',
  },
};

function PosterTab({
  poster,
  active,
  onPress,
}: {
  poster: Poster;
  active: boolean;
  onPress: () => void;
}) {
  const lift = useSharedValue(active ? 1 : 0);
  useEffect(() => {
    lift.value = withSpring(active ? 1 : 0, { damping: 14, stiffness: 180 });
  }, [active, lift]);
  const style = useAnimatedStyle(() => ({
    opacity: 0.78 + lift.value * 0.22,
    transform: [{ translateY: -3 * lift.value }, { scale: 0.97 + lift.value * 0.03 }],
  }));

  return (
    <Pressable
      onPress={onPress}
      style={styles.posterCell}
      accessibilityRole="tab"
      accessibilityState={{ selected: active }}
      accessibilityLabel={`${poster.lead} ${poster.word}`}
    >
      <Animated.View
        style={[
          styles.poster,
          { backgroundColor: poster.bg, shadowColor: poster.glow },
          active && { borderColor: poster.ring, borderWidth: 2.5 },
          style,
        ]}
      >
        {/* Soft sheen, like the desktop card's gradient overlay. */}
        <View style={styles.sheen} pointerEvents="none" />
        <Ionicons name={poster.icon} size={64} color={poster.ink} style={styles.bgIcon} />
        <View style={styles.iconChip}>
          <Ionicons name={poster.icon} size={17} color={poster.ink} />
        </View>
        <Text style={[styles.lead, { color: poster.leadTone }]}>{poster.lead.toUpperCase()}</Text>
        <Text
          style={[styles.word, { color: poster.wordTone }]}
          numberOfLines={1}
          adjustsFontSizeToFit
        >
          {poster.word.toUpperCase()}
        </Text>
        <Text style={[styles.note, { color: poster.ink }]} numberOfLines={1}>
          {poster.note}
        </Text>
        {active ? (
          <View style={styles.tick}>
            <Ionicons name="checkmark" size={12} color={colors.heading} />
          </View>
        ) : null}
      </Animated.View>
    </Pressable>
  );
}

export function ProductShowcase({
  showcase,
}: {
  showcase: Record<ProductFilter, ProductCardData[]>;
}) {
  const [tab, setTab] = useState<ProductFilter>('new');
  const items = (showcase[tab] ?? []).slice(0, COLS === 3 ? COLS * ROWS : 8);

  return (
    <View style={styles.wrap}>
      <View style={styles.head}>
        <View style={styles.accent} />
        <View style={{ flex: 1 }}>
          <Text style={styles.heading}>Shop our picks</Text>
          <Text style={styles.sub}>Fresh arrivals, hot sales & the best offers</Text>
        </View>
      </View>

      <View style={styles.tabs} accessibilityRole="tablist">
        {PRODUCT_FILTER_TABS.map((t) => (
          <PosterTab
            key={t.key}
            poster={POSTERS[t.key]}
            active={tab === t.key}
            onPress={() => setTab(t.key)}
          />
        ))}
      </View>

      <View style={styles.grid}>
        {items.map((product) => (
          <View key={product.id} style={[styles.cell, COLS === 3 && styles.cell3]}>
            <ProductCard product={product} compact={COLS === 3} stacked={COLS === 3} />
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginTop: space.xxl, paddingHorizontal: space.lg },
  head: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: space.md },
  accent: { width: 4, height: 34, borderRadius: 2, backgroundColor: colors.brand.DEFAULT },
  heading: { fontFamily: font.uiBold, fontSize: 18, color: colors.heading },
  sub: { fontFamily: font.body, fontSize: 12.5, color: colors.text.muted, marginTop: 1 },
  tabs: { flexDirection: 'row', gap: space.sm, marginBottom: space.lg, paddingTop: 4 },
  posterCell: { flex: 1 },
  poster: {
    height: 112,
    borderRadius: 18,
    paddingHorizontal: 10,
    paddingTop: 10,
    paddingBottom: 9,
    overflow: 'hidden',
    borderWidth: 2.5,
    borderColor: 'transparent',
    shadowOpacity: 1,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 8 },
    elevation: 5,
  },
  sheen: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    experimental_backgroundImage:
      'linear-gradient(135deg, rgba(255,255,255,0.28) 0%, rgba(255,255,255,0) 45%, rgba(0,0,0,0.1) 100%)',
  },
  bgIcon: { position: 'absolute', right: -10, bottom: -14, opacity: 0.14 },
  iconChip: {
    width: 30,
    height: 30,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.22)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.32)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  lead: { fontFamily: font.uiBold, fontSize: 15, lineHeight: 17, letterSpacing: 0.4 },
  word: { fontFamily: font.uiBold, fontSize: 17, lineHeight: 20, letterSpacing: 0.4 },
  note: { fontFamily: font.body, fontSize: 10.5, opacity: 0.85, marginTop: 2 },
  tick: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: COLS === 3 ? space.sm : space.md },
  cell: { width: '47%', flexGrow: 1 },
  // 3 across: no grow, so a short last row keeps the same card width.
  cell3: { width: '31.5%', flexGrow: 0 },
});
