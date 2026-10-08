import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  PRODUCT_FILTER_TABS,
  type ProductCardData,
  type ProductFilter,
} from '@youmart/shared-client';
import { ProductCard } from './ProductCard';
import { colors, font, space } from '@/theme';

// Premium tabbed product grid ("Shop our picks"): New Arrival / Hot Sale / Best Offer, each with an
// icon + accent colour; the active tab is a filled pill. 2-column product grid below.
const TAB_META: Record<ProductFilter, { icon: keyof typeof Ionicons.glyphMap; color: string }> = {
  new: { icon: 'sparkles', color: colors.feature.guarantee },
  all: { icon: 'flame', color: colors.price.discount },
  sale: { icon: 'pricetag', color: colors.brand.DEFAULT },
};

export function ProductShowcase({
  showcase,
}: {
  showcase: Record<ProductFilter, ProductCardData[]>;
}) {
  const [tab, setTab] = useState<ProductFilter>('new');
  const items = (showcase[tab] ?? []).slice(0, 8);
  const accent = TAB_META[tab].color;

  return (
    <View style={styles.wrap}>
      <View style={styles.head}>
        <View style={styles.accent} />
        <View style={{ flex: 1 }}>
          <Text style={styles.heading}>Shop our picks</Text>
          <Text style={styles.sub}>Fresh arrivals, hot sales & the best offers</Text>
        </View>
      </View>

      <View style={styles.tabs}>
        {PRODUCT_FILTER_TABS.map((t) => {
          const on = tab === t.key;
          const meta = TAB_META[t.key];
          return (
            <Pressable
              key={t.key}
              onPress={() => setTab(t.key)}
              style={[styles.tab, on && { backgroundColor: meta.color, borderColor: meta.color }]}
            >
              <Ionicons name={meta.icon} size={15} color={on ? colors.white : meta.color} />
              <Text style={[styles.tabText, on && styles.tabTextActive]}>{t.label}</Text>
            </Pressable>
          );
        })}
      </View>

      {/* Accent underline that follows the active tab colour */}
      <View style={[styles.rule, { backgroundColor: accent }]} />

      <View style={styles.grid}>
        {items.map((product) => (
          <View key={product.id} style={styles.cell}>
            <ProductCard product={product} />
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
  tabs: { flexDirection: 'row', gap: space.sm },
  tab: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1.5,
    borderColor: colors.card.border,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: colors.white,
  },
  tabText: { fontFamily: font.uiSemibold, fontSize: 12.5, color: colors.text.body },
  tabTextActive: { color: colors.white },
  rule: {
    height: 3,
    borderRadius: 2,
    width: 46,
    marginTop: space.md,
    marginBottom: space.md,
    opacity: 0.85,
  },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.md },
  cell: { width: '47%', flexGrow: 1 },
});
