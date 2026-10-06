import { useCallback, useEffect, useLayoutEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useNavigation } from 'expo-router';
import type { ListingQuery } from '@youmart/shared-client';
import { emptyListingQuery, getListing, type Listing } from '@/lib/catalog';
import { ProductCard } from '@/components/ProductCard';
import { FilterSheet } from '@/components/FilterSheet';
import { colors, font, space } from '@/theme';

export default function CategoryScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const category = String(slug ?? '');
  const navigation = useNavigation();
  const [query, setQuery] = useState<ListingQuery>(emptyListingQuery());
  const [data, setData] = useState<Listing | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [sheet, setSheet] = useState(false);

  const filterKey = JSON.stringify(query.filters);

  // Reload page 1 whenever the category or applied filters/sort change (not on page append).
  useEffect(() => {
    let active = true;
    setLoading(true);
    getListing(category, { ...query, page: 1 })
      .then((res) => active && setData(res))
      .catch(() => active && setData({ products: [], total: 0, filters: null }))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [category, query.sort, query.minRating, query.minPrice, query.maxPrice, filterKey]);

  useLayoutEffect(() => {
    navigation.setOptions({ title: data?.filters?.category.name ?? 'Category' });
  }, [navigation, data]);

  const loadMore = useCallback(async () => {
    if (!data || loadingMore || loading || data.products.length >= data.total) return;
    setLoadingMore(true);
    const nextPage = query.page + 1;
    try {
      const res = await getListing(category, { ...query, page: nextPage });
      setData((prev) => (prev ? { ...res, products: [...prev.products, ...res.products] } : res));
      setQuery((q) => ({ ...q, page: nextPage }));
    } catch {
      /* keep what we have */
    } finally {
      setLoadingMore(false);
    }
  }, [data, loadingMore, loading, query, category]);

  return (
    <View style={styles.screen}>
      <View style={styles.bar}>
        <Text style={styles.count}>{data ? `${data.total} products` : ''}</Text>
        <Pressable style={styles.filterBtn} onPress={() => setSheet(true)}>
          <Ionicons name="options-outline" size={16} color={colors.white} />
          <Text style={styles.filterText}>Filter &amp; Sort</Text>
        </Pressable>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.brand.DEFAULT} />
        </View>
      ) : data && data.products.length > 0 ? (
        <FlatList
          data={data.products}
          keyExtractor={(p) => p.id}
          numColumns={2}
          columnWrapperStyle={styles.col}
          contentContainerStyle={styles.grid}
          renderItem={({ item }) => <ProductCard product={item} />}
          onEndReached={loadMore}
          onEndReachedThreshold={0.4}
          showsVerticalScrollIndicator={false}
          ListFooterComponent={
            loadingMore ? (
              <ActivityIndicator color={colors.brand.DEFAULT} style={{ margin: space.lg }} />
            ) : null
          }
        />
      ) : (
        <View style={styles.center}>
          <Ionicons name="cube-outline" size={48} color={colors.card.border} />
          <Text style={styles.emptyText}>No products in this category yet.</Text>
        </View>
      )}

      <FilterSheet
        visible={sheet}
        filters={data?.filters ?? null}
        query={query}
        onClose={() => setSheet(false)}
        onApply={setQuery}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.page },
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
    backgroundColor: colors.white,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.menu,
  },
  count: { fontFamily: font.uiMedium, fontSize: 13.5, color: colors.text.body },
  filterBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.brand.DEFAULT,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  filterText: { fontFamily: font.uiSemibold, fontSize: 13, color: colors.white },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: space.md },
  emptyText: { fontFamily: font.body, fontSize: 14, color: colors.text.body },
  grid: { padding: space.lg, gap: space.md },
  col: { gap: space.md },
});
