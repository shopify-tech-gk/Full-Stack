import { useRef, useState } from 'react';
import { FlatList, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { ProductRailKey, ProductRailSlider } from '@youmart/shared-client';
import { ProductCard } from './ProductCard';
import { colors, font, radii, space } from '@/theme';

// Desktop-style tabbed product rails (matches the web redesign-3 RailTabs): all rails live behind
// a tab bar; the active rail's products scroll horizontally below. Same data as the stacked rails.
const ICON: Record<ProductRailKey, keyof typeof Ionicons.glyphMap> = {
  'left-off': 'time-outline',
  trending: 'trending-up-outline',
  'top-deals': 'pricetag-outline',
  recommended: 'sparkles-outline',
  explore: 'compass-outline',
};

const CARD_WIDTH = 160;

export function ProductRailTabs({ rails }: { rails: ProductRailSlider[] }) {
  const [active, setActive] = useState(0);
  const listRef = useRef<FlatList>(null);
  const rail = rails[active];
  if (!rail) return null;

  const select = (i: number) => {
    setActive(i);
    listRef.current?.scrollToOffset({ offset: 0, animated: false });
  };

  return (
    <View style={styles.wrap}>
      {/* Tab bar (scrollable pill row inside a brand-tinted container) */}
      <View style={styles.tabBar}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.tabList}
        >
          {rails.map((r, i) => {
            const on = i === active;
            return (
              <Pressable
                key={r.key}
                onPress={() => select(i)}
                style={[styles.tab, on && styles.tabActive]}
              >
                <Ionicons
                  name={ICON[r.key] ?? 'pricetag-outline'}
                  size={15}
                  color={on ? colors.white : colors.brand.DEFAULT}
                />
                <Text numberOfLines={1} style={[styles.tabText, on && styles.tabTextActive]}>
                  {r.heading}
                </Text>
                {r.badge ? (
                  <View style={[styles.badge, on && styles.badgeOn]}>
                    <Text style={[styles.badgeText, on && styles.badgeTextOn]}>{r.badge}</Text>
                  </View>
                ) : null}
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      {/* Active rail products */}
      <FlatList
        ref={listRef}
        horizontal
        data={rail.products}
        keyExtractor={(p) => p.id}
        renderItem={({ item }) => <ProductCard product={item} width={CARD_WIDTH} />}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.products}
        ItemSeparatorComponent={() => <View style={{ width: space.md }} />}
        decelerationRate="fast"
        snapToInterval={CARD_WIDTH + space.md}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginTop: space.lg },
  tabBar: {
    marginHorizontal: space.lg,
    backgroundColor: colors.brandPopup.bg,
    borderRadius: radii.pill,
    paddingVertical: 6,
    paddingHorizontal: 6,
  },
  tabList: { gap: 6, alignItems: 'center' },
  tab: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: radii.pill,
  },
  tabActive: { backgroundColor: colors.brand.DEFAULT },
  tabText: { fontFamily: font.uiSemibold, fontSize: 13, color: colors.brand.DEFAULT },
  tabTextActive: { color: colors.white },
  badge: {
    backgroundColor: colors.white,
    borderRadius: 999,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  badgeOn: { backgroundColor: 'rgba(255,255,255,0.22)' },
  badgeText: { fontFamily: font.uiBold, fontSize: 9.5, color: colors.price.discount },
  badgeTextOn: { color: colors.white },
  products: { paddingHorizontal: space.lg, paddingTop: space.md },
});
