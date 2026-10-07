import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import {
  PRODUCT_FILTER_TABS,
  type ProductCardData,
  type ProductFilter,
} from '@youmart/shared-client';
import { ProductCard } from './ProductCard';
import { colors, font, space } from '@/theme';

/** The live homepage product grid with "New Arrival / Hot Sale / Best Offer" tabs. */
export function ProductShowcase({
  showcase,
}: {
  showcase: Record<ProductFilter, ProductCardData[]>;
}) {
  const [tab, setTab] = useState<ProductFilter>('new');
  const items = showcase[tab] ?? [];

  return (
    <View style={styles.wrap}>
      <View style={styles.head}>
        <View style={styles.accent} />
        <Text style={styles.heading}>Shop our picks</Text>
      </View>

      <View style={styles.tabs}>
        {PRODUCT_FILTER_TABS.map((t) => (
          <Pressable
            key={t.key}
            style={[styles.tab, tab === t.key && styles.tabActive]}
            onPress={() => setTab(t.key)}
          >
            <Text style={[styles.tabText, tab === t.key && styles.tabTextActive]}>{t.label}</Text>
          </Pressable>
        ))}
      </View>

      <View style={styles.grid}>
        {items.slice(0, 8).map((product) => (
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
  accent: { width: 4, height: 18, borderRadius: 2, backgroundColor: colors.brand.DEFAULT },
  heading: { fontFamily: font.uiBold, fontSize: 17, color: colors.heading },
  tabs: { flexDirection: 'row', gap: space.sm, marginBottom: space.md },
  tab: {
    borderWidth: 1,
    borderColor: colors.card.border,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 7,
    backgroundColor: colors.white,
  },
  tabActive: { backgroundColor: colors.brand.DEFAULT, borderColor: colors.brand.DEFAULT },
  tabText: { fontFamily: font.uiMedium, fontSize: 12.5, color: colors.text.body },
  tabTextActive: { color: colors.white, fontFamily: font.uiSemibold },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.md },
  cell: { width: '47%', flexGrow: 1 },
});
