import { useCallback, useEffect, useLayoutEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useNavigation, useRouter } from 'expo-router';
import type { ListingQuery } from '@youmart/shared-client';
import { emptyListingQuery, getListing, listMoreProducts, type Listing } from '@/lib/catalog';
import { ProductCard } from '@/components/ProductCard';
import { CategoryCard } from '@/components/CategoryCard';
import { FilterSheet } from '@/components/FilterSheet';
import {
  browseNode,
  catalogSlugOf,
  taxonomyPathForSlug,
  taxonomyTrail,
  type CatNode,
  type TrailNode,
} from '@/lib/home-categories';
import { colors, font, space } from '@/theme';

export default function CategoryScreen() {
  const { slug, taxo } = useLocalSearchParams<{ slug: string; taxo?: string }>();
  const category = String(slug ?? '');
  const navigation = useNavigation();
  const router = useRouter();
  const [query, setQuery] = useState<ListingQuery>(emptyListingQuery());
  const [data, setData] = useState<Listing | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [sheet, setSheet] = useState(false);

  const filterKey = JSON.stringify(query.filters);

  // Which taxonomy node we're at — from the passed `taxo` path, or resolved from the slug.
  const taxoPath = useMemo(
    () => (typeof taxo === 'string' && taxo ? taxo.split('~') : taxonomyPathForSlug(category)),
    [taxo, category],
  );
  // The sub-categories (or sub-to-sub) to show as a row; only mains/subs have a child level.
  const subNode = useMemo(
    () => (taxoPath.length >= 1 && taxoPath.length <= 2 ? browseNode(taxoPath) : null),
    [taxoPath],
  );
  const trail = useMemo(() => taxonomyTrail(taxoPath), [taxoPath]);

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
    navigation.setOptions({
      title: data?.filters?.category.name ?? trail[trail.length - 1]?.name ?? 'Category',
    });
  }, [navigation, data, trail]);

  const openNode = useCallback(
    (node: CatNode) => {
      if (node.href.startsWith('/search')) {
        router.push({ pathname: '/search', params: { q: node.name } });
        return;
      }
      const cslug = catalogSlugOf(node.href) || node.slug;
      router.push(`/category/${cslug}?taxo=${[...taxoPath, node.slug].join('~')}`);
    },
    [router, taxoPath],
  );

  const openTrail = useCallback(
    (t: TrailNode) => {
      if (t.href.startsWith('/search')) {
        router.push({ pathname: '/search', params: { q: t.name } });
        return;
      }
      router.push(`/category/${catalogSlugOf(t.href)}?taxo=${t.taxo}`);
    },
    [router],
  );

  const loadMore = useCallback(async () => {
    if (!data || loadingMore || loading || data.products.length >= data.total) return;
    setLoadingMore(true);
    const nextPage = query.page + 1;
    try {
      const res = await listMoreProducts(category, { ...query, page: nextPage });
      setData((prev) =>
        prev ? { ...prev, products: [...prev.products, ...res.products], total: res.total } : prev,
      );
      setQuery((q) => ({ ...q, page: nextPage }));
    } catch {
      /* keep what we have */
    } finally {
      setLoadingMore(false);
    }
  }, [data, loadingMore, loading, query, category]);

  const header =
    trail.length > 0 || (subNode && subNode.children.length > 0) ? (
      <View style={styles.header}>
        {trail.length > 0 ? (
          <View style={styles.trail}>
            <Pressable onPress={() => router.navigate('/')} hitSlop={6}>
              <Ionicons name="home-outline" size={13} color={colors.text.body} />
            </Pressable>
            {trail.map((t, i) => {
              const last = i === trail.length - 1;
              return (
                <View key={t.taxo} style={styles.trailItem}>
                  <Ionicons name="chevron-forward" size={11} color={colors.text.body} />
                  {last ? (
                    <Text style={styles.trailCurrent} numberOfLines={1}>
                      {t.name}
                    </Text>
                  ) : (
                    <Pressable onPress={() => openTrail(t)} hitSlop={4}>
                      <Text style={styles.trailLink} numberOfLines={1}>
                        {t.name}
                      </Text>
                    </Pressable>
                  )}
                </View>
              );
            })}
          </View>
        ) : null}

        {subNode && subNode.children.length > 0 ? (
          <View style={styles.strip}>
            <Text style={styles.stripTitle}>Explore in {subNode.name}</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.stripRow}
            >
              {subNode.children.map((c) => (
                <View key={c.slug} style={styles.stripCard}>
                  <CategoryCard
                    name={c.name}
                    hasChildren={c.hasChildren}
                    imageKey={[...taxoPath, c.slug].join('/')}
                    onPress={() => openNode(c)}
                  />
                </View>
              ))}
            </ScrollView>
          </View>
        ) : null}
      </View>
    ) : null;

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
        <ScrollView showsVerticalScrollIndicator={false}>
          {header}
          <View style={styles.center}>
            <ActivityIndicator size="large" color={colors.brand.DEFAULT} />
          </View>
        </ScrollView>
      ) : data && data.products.length > 0 ? (
        <FlatList
          data={data.products}
          keyExtractor={(p) => p.id}
          numColumns={2}
          columnWrapperStyle={styles.col}
          contentContainerStyle={styles.grid}
          ListHeaderComponent={header}
          renderItem={({ item }) => <ProductCard product={item} />}
          onEndReached={loadMore}
          onEndReachedThreshold={1.2}
          showsVerticalScrollIndicator={false}
          ListFooterComponent={
            loadingMore ? (
              <ActivityIndicator color={colors.brand.DEFAULT} style={{ margin: space.lg }} />
            ) : null
          }
        />
      ) : (
        <ScrollView showsVerticalScrollIndicator={false}>
          {header}
          <View style={styles.center}>
            <Ionicons name="cube-outline" size={48} color={colors.card.border} />
            <Text style={styles.emptyText}>No products in this category yet.</Text>
          </View>
        </ScrollView>
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
  header: { paddingTop: space.md },
  trail: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 2,
    paddingHorizontal: space.lg,
    marginBottom: space.sm,
  },
  trailItem: { flexDirection: 'row', alignItems: 'center', gap: 2, maxWidth: 160 },
  trailLink: { fontFamily: font.uiMedium, fontSize: 12, color: colors.brand.DEFAULT },
  trailCurrent: { fontFamily: font.uiSemibold, fontSize: 12, color: colors.text.body },
  strip: { marginBottom: space.sm },
  stripTitle: {
    fontFamily: font.uiBold,
    fontSize: 15,
    color: colors.heading,
    paddingHorizontal: space.lg,
    marginBottom: space.sm,
  },
  stripRow: { paddingHorizontal: space.lg, gap: space.md },
  stripCard: { width: 108 },
  center: { alignItems: 'center', justifyContent: 'center', gap: space.md, paddingVertical: 60 },
  emptyText: { fontFamily: font.body, fontSize: 14, color: colors.text.body },
  grid: { padding: space.lg, gap: space.md },
  col: { gap: space.md },
});
