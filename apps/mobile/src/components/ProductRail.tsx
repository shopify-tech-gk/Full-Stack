import { FlatList, StyleSheet, Text, View } from 'react-native';
import type { ProductRailSlider } from '@youmart/shared-client';
import { colors, font, space } from '@/theme';
import { ProductCard } from './ProductCard';

const CARD_WIDTH = 160;

/** A horizontal, native-scrolling product rail. Reuses the web's resolveProductRails output
 * (personal recently-viewed first, heading-matched fallback) — only the rendering is native. */
export function ProductRail({ rail }: { rail: ProductRailSlider }) {
  return (
    <View style={styles.wrap}>
      <View style={styles.head}>
        <View style={styles.titleRow}>
          <View style={styles.accent} />
          <Text style={styles.heading}>{rail.heading}</Text>
        </View>
        {rail.badge ? (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{rail.badge}</Text>
          </View>
        ) : null}
      </View>
      <FlatList
        horizontal
        data={rail.products}
        keyExtractor={(p) => p.id}
        renderItem={({ item }) => <ProductCard product={item} width={CARD_WIDTH} />}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.list}
        ItemSeparatorComponent={() => <View style={styles.sep} />}
        decelerationRate="fast"
        snapToInterval={CARD_WIDTH + space.md}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginTop: space.xl },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: space.lg,
    marginBottom: space.md,
  },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 10, flexShrink: 1 },
  accent: { width: 4, height: 18, borderRadius: 2, backgroundColor: colors.brand.DEFAULT },
  heading: { fontFamily: font.uiBold, fontSize: 17, color: colors.heading, flexShrink: 1 },
  badge: {
    backgroundColor: colors.brand.DEFAULT,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  badgeText: { fontFamily: font.uiSemibold, fontSize: 11, color: colors.white },
  list: { paddingHorizontal: space.lg },
  sep: { width: space.md },
});
