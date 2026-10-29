import { useRef, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  type ScrollViewInstance,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import {
  discountPercent,
  formatMoney,
  type Money,
  type ProductCardData,
  type ProductRailKey,
  type ProductRailSlider,
} from '@youmart/shared-client';
import { colors, font, space } from '@/theme';
import { ProductImage } from './ui';

// v1.17 "Handpicked for you" as swipeable deal panels: each rail (Pick up where you left off,
// Trending, Top deals...) becomes one gradient panel holding a 2 x 2 grid of products -
// the shopping-panel structure, drawn in YouMart's own premium style.

const PER_PANEL = 4;
const GAP = 12;

/** Per-rail look, shared with the rail's "View all" screen (app/rail/[key]). */
export const RAIL_THEME: Record<
  ProductRailKey,
  { gradient: string; icon: keyof typeof Ionicons.glyphMap; tagline: string }
> = {
  'left-off': {
    gradient: 'linear-gradient(140deg, #0b1b3f 0%, #0142aa 55%, #2f6ae8 100%)',
    icon: 'time',
    tagline: 'Continue where you stopped',
  },
  trending: {
    gradient: 'linear-gradient(140deg, #3b0a6b 0%, #7c3aed 55%, #c026d3 100%)',
    icon: 'flame',
    tagline: 'What everyone is buying',
  },
  'top-deals': {
    gradient: 'linear-gradient(140deg, #7f1d1d 0%, #e11d48 55%, #f97316 100%)',
    icon: 'pricetags',
    tagline: 'Biggest savings today',
  },
  recommended: {
    gradient: 'linear-gradient(140deg, #053d33 0%, #047857 55%, #14b8a6 100%)',
    icon: 'sparkles',
    tagline: 'Picked to match your taste',
  },
  explore: {
    gradient: 'linear-gradient(140deg, #172554 0%, #1d4ed8 50%, #06b6d4 100%)',
    icon: 'compass',
    tagline: 'Discover something new',
  },
};
export const FALLBACK_RAIL_THEME = RAIL_THEME.explore;

interface Panel {
  id: string;
  rail: ProductRailSlider;
  products: ProductCardData[];
}

/** One panel per rail: its first four products. */
function toPanels(rails: ProductRailSlider[]): Panel[] {
  return rails
    .filter((rail) => rail.products.length > 0)
    .map((rail) => ({ id: rail.key, rail, products: rail.products.slice(0, PER_PANEL) }));
}

/** "₹1,099.00" -> "₹1,099" (paise only when there are any). */
const shortMoney = (m: Money) => formatMoney(m).replace(/\.00$/, '');

export function RailPanels({ rails }: { rails: ProductRailSlider[] }) {
  const { width } = useWindowDimensions();
  const panelWidth = Math.min(width - 48, 380);
  const panels = toPanels(rails);
  const scroll = useRef<ScrollViewInstance>(null);
  const [page, setPage] = useState(0);

  if (panels.length === 0) return null;

  const goTo = (i: number) => {
    const next = Math.min(panels.length - 1, Math.max(0, i));
    scroll.current?.scrollTo({ x: next * (panelWidth + GAP), animated: true });
    void Haptics.selectionAsync().catch(() => undefined);
  };

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const i = Math.round(e.nativeEvent.contentOffset.x / (panelWidth + GAP));
    if (i !== page) setPage(i);
  };

  return (
    <View style={styles.wrap}>
      <ScrollView
        ref={scroll}
        horizontal
        showsHorizontalScrollIndicator={false}
        decelerationRate="fast"
        snapToInterval={panelWidth + GAP}
        contentContainerStyle={styles.track}
        onScroll={onScroll}
        scrollEventThrottle={32}
      >
        {panels.map((panel) => (
          <DealPanel key={panel.id} panel={panel} width={panelWidth} />
        ))}
      </ScrollView>
      <View style={styles.dots}>
        {/* Tap a dot to jump to that panel. */}
        {panels.map((p, i) => (
          <Pressable
            key={p.id}
            onPress={() => goTo(i)}
            hitSlop={6}
            accessibilityLabel={p.rail.heading}
          >
            <View style={[styles.dot, i === page && styles.dotOn]} />
          </Pressable>
        ))}
      </View>
    </View>
  );
}

function DealPanel({ panel, width }: { panel: Panel; width: number }) {
  const theme = RAIL_THEME[panel.rail.key] ?? FALLBACK_RAIL_THEME;
  const router = useRouter();
  const viewAll = () => {
    void Haptics.selectionAsync().catch(() => undefined);
    router.push(`/rail/${panel.rail.key}`);
  };
  const tileWidth = (width - 14 * 2 - 10) / 2;
  return (
    <View style={[styles.panel, { width, experimental_backgroundImage: theme.gradient }]}>
      {/* Soft decorative glows */}
      <View style={[styles.glow, styles.glowTop]} pointerEvents="none" />
      <View style={[styles.glow, styles.glowBottom]} pointerEvents="none" />

      <View style={styles.head}>
        <View style={styles.headIcon}>
          <Ionicons name={theme.icon} size={17} color={colors.white} />
        </View>
        <Pressable style={{ flex: 1 }} onPress={viewAll}>
          <Text style={styles.heading} numberOfLines={1}>
            {panel.rail.heading}
          </Text>
          <Text style={styles.tagline} numberOfLines={1}>
            {theme.tagline}
          </Text>
        </Pressable>
        {panel.rail.badge ? (
          <View style={styles.badge}>
            <Ionicons name="flash" size={11} color="#1f1300" />
            <Text style={styles.badgeText}>{panel.rail.badge.replace(/^Up to /i, '')}</Text>
          </View>
        ) : null}
        <Pressable
          onPress={viewAll}
          hitSlop={8}
          style={({ pressed }) => [styles.viewAll, pressed && { opacity: 0.75 }]}
          accessibilityLabel={`View all ${panel.rail.heading}`}
        >
          <Text style={styles.viewAllText}>View all</Text>
          <Ionicons name="chevron-forward" size={14} color={colors.white} />
        </Pressable>
      </View>

      <View style={styles.grid}>
        {panel.products.map((p) => (
          <DealTile key={p.id} product={p} width={tileWidth} />
        ))}
      </View>
    </View>
  );
}

function DealTile({ product, width }: { product: ProductCardData; width: number }) {
  const router = useRouter();
  const off = discountPercent(product.mrp, product.sellingPrice);
  return (
    <Pressable
      onPress={() => product.slug && router.push(`/product/${product.slug}`)}
      style={({ pressed }) => [styles.tile, { width }, pressed && styles.tilePressed]}
    >
      <View style={styles.imageWrap}>
        <ProductImage src={product.image} style={styles.image} icon={26} />
        {off > 0 ? (
          <View style={styles.off}>
            <Text style={styles.offText}>{off}% OFF</Text>
          </View>
        ) : null}
      </View>
      <Text numberOfLines={1} style={styles.title}>
        {product.title}
      </Text>
      <View style={styles.priceRow}>
        <Text style={styles.price}>{shortMoney(product.sellingPrice)}</Text>
        {off > 0 ? <Text style={styles.mrp}>{shortMoney(product.mrp)}</Text> : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: { marginTop: space.md },
  track: { paddingHorizontal: space.lg, gap: GAP },
  panel: {
    borderRadius: 22,
    padding: 14,
    paddingBottom: 14,
    overflow: 'hidden',
    gap: 10,
  },
  glow: { position: 'absolute', borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.09)' },
  glowTop: { width: 170, height: 170, top: -70, right: -50 },
  glowBottom: { width: 120, height: 120, bottom: -60, left: -40 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  headIcon: {
    width: 34,
    height: 34,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heading: { fontFamily: font.uiBold, fontSize: 16, color: colors.white },
  tagline: { fontFamily: font.uiMedium, fontSize: 11.5, color: 'rgba(255,255,255,0.78)' },
  viewAll: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    paddingLeft: 10,
    paddingRight: 6,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.32)',
  },
  viewAllText: { fontFamily: font.uiBold, fontSize: 11.5, color: colors.white },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#ffe500',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  badgeText: { fontFamily: font.uiBold, fontSize: 10.5, color: '#1f1300' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 2 },
  tile: {
    backgroundColor: colors.white,
    borderRadius: 16,
    padding: 6,
    paddingBottom: 9,
    gap: 4,
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 3,
  },
  tilePressed: { opacity: 0.9, transform: [{ scale: 0.97 }] },
  imageWrap: { borderRadius: 12, overflow: 'hidden', backgroundColor: '#f4f7fd' },
  image: { width: '100%', aspectRatio: 1 },
  off: {
    position: 'absolute',
    left: 6,
    top: 6,
    backgroundColor: '#e11d48',
    borderRadius: 7,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  offText: { fontFamily: font.uiBold, fontSize: 9.5, color: colors.white, letterSpacing: 0.2 },
  title: {
    fontFamily: font.uiMedium,
    fontSize: 12,
    color: colors.text.strong,
    paddingHorizontal: 2,
  },
  priceRow: { flexDirection: 'row', alignItems: 'baseline', gap: 5, paddingHorizontal: 2 },
  price: { fontFamily: font.uiBold, fontSize: 14, color: colors.heading },
  mrp: {
    fontFamily: font.body,
    fontSize: 10.5,
    color: colors.text.muted,
    textDecorationLine: 'line-through',
  },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: 5, marginTop: 10 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#cfd9ea' },
  dotOn: { width: 18, backgroundColor: colors.brand.DEFAULT },
});
