import { useCallback, useEffect, useLayoutEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useNavigation } from 'expo-router';
import type { ListingQuery, ProductCardData } from '@youmart/shared-client';
import {
  emptyListingQuery,
  getListing,
  listMoreProducts,
  searchProductsPage,
  type Listing,
} from '@/lib/catalog';
import { lookupCategoryImage } from '@/lib/category-images';
import {
  brandsFor,
  catalogSlugOf,
  taxChildren,
  taxNode,
  taxonomyPathForSlug,
} from '@/lib/home-categories';
import { ProductCard } from '@/components/ProductCard';
import { FilterSheet } from '@/components/FilterSheet';
import { BrandLogo } from '@/components/BrandLogo';
import { colors, font, radii, space } from '@/theme';

const RAIL_W = 80;
const MAX_BRANDS = 40;
const TILE_W = 84;
const TILE_H = 48;

type Results = { products: ProductCardData[]; total: number; filters: Listing['filters'] };

/**
 * Category screen: a sub-category rail on the left (a sub with its own items swaps the rail to
 * its sub-to-sub list), the category's brands across the top (tap to filter), and a compact
 * product grid. Navigation inside the category happens in place, like a native store app.
 */
export default function CategoryScreen() {
  const { slug, taxo } = useLocalSearchParams<{ slug: string; taxo?: string }>();
  const routeSlug = String(slug ?? '');
  const navigation = useNavigation();
  const { width } = useWindowDimensions();

  const startPath = useMemo(
    () => (typeof taxo === 'string' && taxo ? taxo.split('~') : taxonomyPathForSlug(routeSlug)),
    [taxo, routeSlug],
  );
  const [path, setPath] = useState<string[]>(startPath);
  const node = useMemo(() => (path.length ? taxNode(path) : null), [path]);

  // The rail lists the children of a "level": the main, or a sub that has its own items.
  const levelPath = useMemo(() => {
    if (path.length >= 2 && taxNode(path.slice(0, 2))?.hasChildren) return path.slice(0, 2);
    return path.slice(0, 1);
  }, [path]);
  const rail = useMemo(() => (levelPath.length ? taxChildren(levelPath) : []), [levelPath]);
  const levelNode = useMemo(() => (levelPath.length ? taxNode(levelPath) : null), [levelPath]);
  const mainNode = useMemo(() => (path.length ? taxNode(path.slice(0, 1)) : null), [path]);
  const selectedSlug = path.length > levelPath.length ? path[levelPath.length] : null;

  // Where the products come from: the node's catalog category, or a search for nodes the
  // catalog doesn't hold yet. Off-taxonomy links fall back to the route's catalog slug.
  const searchTerm = node && node.href.startsWith('/search') ? node.name : null;
  const catalogSlug = node ? catalogSlugOf(node.href) : routeSlug;

  const [query, setQuery] = useState<ListingQuery>(emptyListingQuery());
  const [data, setData] = useState<Results | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [sheet, setSheet] = useState(false);
  const brand = query.filters.brand ?? '';
  const filterKey = JSON.stringify(query.filters);

  useLayoutEffect(() => {
    navigation.setOptions({ title: node?.name ?? data?.filters?.category.name ?? 'Category' });
  }, [navigation, node, data]);

  // Changing category starts clean (filters belong to the category they were picked in).
  const go = useCallback((next: string[]) => {
    setPath(next);
    setQuery(emptyListingQuery());
  }, []);

  useEffect(() => {
    let active = true;
    setLoading(true);
    const load: Promise<Results> = searchTerm
      ? searchProductsPage(searchTerm, 1, 40, brand || undefined).then((r) => ({
          ...r,
          filters: null,
        }))
      : getListing(catalogSlug, { ...query, page: 1 });
    load
      .then((res) => active && setData(res))
      .catch(() => active && setData({ products: [], total: 0, filters: null }))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [
    catalogSlug,
    searchTerm,
    brand,
    query.sort,
    query.minRating,
    query.minPrice,
    query.maxPrice,
    filterKey,
  ]);

  const loadMore = useCallback(async () => {
    if (!data || loadingMore || loading || data.products.length >= data.total) return;
    setLoadingMore(true);
    const nextPage = query.page + 1;
    try {
      const res = searchTerm
        ? await searchProductsPage(searchTerm, nextPage, 40, brand || undefined)
        : await listMoreProducts(catalogSlug, { ...query, page: nextPage });
      setData((prev) =>
        prev ? { ...prev, products: [...prev.products, ...res.products], total: res.total } : prev,
      );
      setQuery((q) => ({ ...q, page: nextPage }));
    } catch {
      /* keep what we have */
    } finally {
      setLoadingMore(false);
    }
  }, [data, loadingMore, loading, query, catalogSlug, searchTerm, brand]);

  // Brands: the ones with products here first (most products first), then the rest of the
  // category sheet's brands for this node.
  const brands = useMemo(() => {
    const facet =
      data?.filters?.filters.find((f) => f.key === 'brand')?.values?.filter((v) => v.count > 0) ??
      [];
    const stocked = [...facet].sort((a, b) => b.count - a.count).map((v) => v.value);
    const seen = new Set(stocked.map((b) => b.toLowerCase()));
    const listed = brandsFor(path).filter((b) => !seen.has(b.toLowerCase()));
    return [...stocked, ...listed].slice(0, MAX_BRANDS);
  }, [data, path]);

  const pickBrand = (b: string) =>
    setQuery((q) => {
      const filters = { ...q.filters };
      if (!b || filters.brand === b) delete filters.brand;
      else filters.brand = b;
      return { ...q, page: 1, filters };
    });

  const gridWidth = width - (rail.length ? RAIL_W : 0);
  const cardWidth = (gridWidth - space.sm * 3) / 2;

  return (
    <View style={styles.screen}>
      <View style={styles.body}>
        {rail.length ? (
          <View style={styles.rail}>
            <ScrollView showsVerticalScrollIndicator={false}>
              {levelPath.length === 2 && mainNode ? (
                <RailItem
                  label={mainNode.name}
                  back
                  active={false}
                  onPress={() => go(mainNode.path)}
                />
              ) : null}
              <RailItem
                label={`All ${levelNode?.name ?? ''}`.trim()}
                imageKey={levelNode?.imageKey}
                all
                active={selectedSlug === null}
                onPress={() => go(levelPath)}
              />
              {rail.map((item) => (
                <RailItem
                  key={item.slug}
                  label={item.name}
                  imageKey={item.imageKey}
                  more={item.hasChildren}
                  active={selectedSlug === item.slug}
                  onPress={() => go(item.path)}
                />
              ))}
            </ScrollView>
          </View>
        ) : null}

        <View style={styles.main}>
          {data?.filters ? (
            <View style={styles.topBar}>
              <Pressable style={styles.filterBtn} onPress={() => setSheet(true)}>
                <Ionicons name="options-outline" size={14} color={colors.brand.DEFAULT} />
                <Text style={styles.filterText}>Filter & Sort</Text>
              </Pressable>
            </View>
          ) : null}

          {brands.length ? (
            <View style={styles.brandWrap}>
              <Text style={styles.brandLabel}>Shop by brand</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.brandRow}
              >
                <BrandTile label="All" active={!brand} onPress={() => pickBrand('')} />
                {brands.map((b) => (
                  <BrandTile key={b} label={b} active={brand === b} onPress={() => pickBrand(b)} />
                ))}
              </ScrollView>
            </View>
          ) : null}

          {loading ? (
            <View style={styles.center}>
              <ActivityIndicator size="large" color={colors.brand.DEFAULT} />
            </View>
          ) : data && data.products.length > 0 ? (
            <FlatList
              key={path.join('/')}
              data={data.products}
              keyExtractor={(p) => p.id}
              numColumns={2}
              columnWrapperStyle={styles.col}
              contentContainerStyle={styles.grid}
              renderItem={({ item }) => <ProductCard product={item} width={cardWidth} compact />}
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
            <View style={styles.center}>
              <View style={styles.emptyIcon}>
                <Ionicons name="cube-outline" size={30} color={colors.brand.DEFAULT} />
              </View>
              <Text style={styles.emptyTitle}>
                {brand ? `No ${brand} products here yet` : 'No products here yet'}
              </Text>
              <Text style={styles.emptyText}>
                {brand ? 'Try another brand or "All".' : 'Check another category from the list.'}
              </Text>
              {brand ? (
                <Pressable style={styles.emptyBtn} onPress={() => pickBrand('')}>
                  <Text style={styles.emptyBtnText}>Show all brands</Text>
                </Pressable>
              ) : null}
            </View>
          )}
        </View>
      </View>

      {data?.filters ? (
        <FilterSheet
          visible={sheet}
          filters={data.filters}
          query={query}
          onClose={() => setSheet(false)}
          onApply={setQuery}
        />
      ) : null}
    </View>
  );
}

function RailItem({
  label,
  imageKey,
  active,
  all,
  back,
  more,
  onPress,
}: {
  label: string;
  imageKey?: string;
  active: boolean;
  all?: boolean;
  back?: boolean;
  more?: boolean;
  onPress: () => void;
}) {
  const image = imageKey ? lookupCategoryImage(imageKey) : undefined;
  // Portrait curved card - the Explore Categories look (CategoryCard), sized for the rail.
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.railItem,
        active && styles.railItemOn,
        pressed && styles.railPressed,
      ]}
    >
      {active ? <View style={styles.railBar} /> : null}
      <View style={[styles.railCard, active && styles.railCardOn]}>
        <View style={[styles.railArt, back && styles.railArtBack]}>
          {back ? (
            <Ionicons name="chevron-back" size={22} color={colors.brand.DEFAULT} />
          ) : image ? (
            <Image
              source={image}
              style={StyleSheet.absoluteFill}
              contentFit="cover"
              transition={120}
            />
          ) : (
            <>
              <View style={[styles.railBlob, styles.railBlobTop]} />
              <View style={[styles.railBlob, styles.railBlobBottom]} />
              <View style={styles.railIcon}>
                <Ionicons
                  name={all ? 'apps' : 'pricetags'}
                  size={16}
                  color={colors.brand.DEFAULT}
                />
              </View>
            </>
          )}
          {more ? (
            <View style={styles.railMore}>
              <Ionicons name="chevron-forward" size={9} color={colors.white} />
            </View>
          ) : null}
        </View>
        <View style={[styles.railFooter, active && styles.railFooterOn]}>
          <Text numberOfLines={2} style={[styles.railText, active && styles.railTextOn]}>
            {back ? `Back to ${label}` : label}
          </Text>
        </View>
      </View>
    </Pressable>
  );
}

function BrandTile({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  const all = label === 'All';
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      accessibilityLabel={all ? 'All brands' : label}
      style={({ pressed }) => [styles.tile, active && styles.tileOn, pressed && styles.tilePressed]}
    >
      {all ? (
        <View style={styles.allTile}>
          <Ionicons
            name="grid-outline"
            size={16}
            color={active ? colors.brand.DEFAULT : colors.text.body}
          />
          <Text style={[styles.allText, active && styles.allTextOn]}>All</Text>
        </View>
      ) : (
        <BrandLogo name={label} width={TILE_W - 18} height={TILE_H - 18} />
      )}
      {active ? (
        <View style={styles.tick}>
          <Ionicons name="checkmark" size={10} color={colors.white} />
        </View>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.page },
  body: { flex: 1, flexDirection: 'row' },
  rail: {
    width: RAIL_W,
    backgroundColor: '#eef3f9',
    borderRightWidth: StyleSheet.hairlineWidth,
    borderRightColor: colors.brandPopup.border,
  },
  railItem: {
    paddingVertical: 5,
    paddingLeft: 8,
    paddingRight: 6,
  },
  railItemOn: { backgroundColor: colors.page },
  railPressed: { opacity: 0.9 },
  railBar: {
    position: 'absolute',
    left: 0,
    top: 10,
    bottom: 10,
    width: 4,
    borderTopRightRadius: 4,
    borderBottomRightRadius: 4,
    backgroundColor: colors.brand.DEFAULT,
  },
  railCard: {
    borderRadius: radii.categoryCard,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.brandPopup.border,
    overflow: 'hidden',
    shadowColor: colors.brand.DEFAULT,
    shadowOpacity: 0.1,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  railCardOn: { borderColor: colors.brand.DEFAULT, borderWidth: 1.5 },
  railArt: {
    aspectRatio: 3 / 4,
    backgroundColor: colors.brandPopup.bg,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  railArtBack: { aspectRatio: 4 / 3 },
  railBlob: { position: 'absolute', borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.55)' },
  railBlobTop: { width: 40, height: 40, top: -14, right: -12 },
  railBlobBottom: {
    width: 30,
    height: 30,
    bottom: -10,
    left: -8,
    backgroundColor: 'rgba(1,66,170,0.06)',
  },
  railIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.85)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  railMore: {
    position: 'absolute',
    top: 5,
    right: 5,
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: colors.white,
    backgroundColor: colors.brand.DEFAULT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  railFooter: {
    minHeight: 28,
    justifyContent: 'center',
    paddingHorizontal: 4,
    paddingVertical: 4,
    borderTopWidth: 1,
    borderTopColor: colors.brandPopup.border,
  },
  railFooterOn: { backgroundColor: colors.brandPopup.bg },
  railText: {
    fontFamily: font.uiSemibold,
    fontSize: 9.5,
    lineHeight: 12,
    color: colors.heading,
    textAlign: 'center',
  },
  railTextOn: { fontFamily: font.uiBold, color: colors.brand.DEFAULT },
  main: { flex: 1 },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingHorizontal: space.sm + 2,
    paddingTop: space.sm,
  },
  filterBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.brandPopup.border,
    borderRadius: radii.pill,
    paddingHorizontal: 11,
    paddingVertical: 6,
  },
  filterText: { fontFamily: font.uiSemibold, fontSize: 12, color: colors.brand.DEFAULT },
  brandWrap: { paddingTop: space.sm },
  brandLabel: {
    fontFamily: font.uiBold,
    fontSize: 12,
    color: colors.heading,
    paddingHorizontal: space.sm + 2,
    marginBottom: 6,
  },
  brandRow: { paddingHorizontal: space.sm, gap: 8, paddingTop: 6, paddingBottom: 4 },
  tile: {
    width: TILE_W,
    height: TILE_H,
    borderRadius: 12,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.brandPopup.border,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#0b2a5b',
    shadowOpacity: 0.06,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  tileOn: { borderColor: colors.brand.DEFAULT, borderWidth: 1.5, backgroundColor: '#f4f8ff' },
  tilePressed: { transform: [{ scale: 0.96 }] },
  allTile: { alignItems: 'center', gap: 2 },
  allText: { fontFamily: font.uiSemibold, fontSize: 11, color: colors.text.body },
  allTextOn: { fontFamily: font.uiBold, color: colors.brand.DEFAULT },
  tick: {
    position: 'absolute',
    top: -5,
    right: -5,
    width: 17,
    height: 17,
    borderRadius: 9,
    borderWidth: 1.5,
    borderColor: colors.white,
    backgroundColor: colors.brand.DEFAULT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  grid: { padding: space.sm, paddingBottom: space.xxxl },
  col: { gap: space.sm, marginBottom: space.sm },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.sm,
    paddingHorizontal: space.lg,
  },
  emptyIcon: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: colors.brandPopup.bg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTitle: {
    fontFamily: font.uiBold,
    fontSize: 14.5,
    color: colors.heading,
    textAlign: 'center',
  },
  emptyText: {
    fontFamily: font.body,
    fontSize: 12.5,
    color: colors.text.body,
    textAlign: 'center',
  },
  emptyBtn: {
    marginTop: space.sm,
    backgroundColor: colors.brand.DEFAULT,
    borderRadius: radii.pill,
    paddingHorizontal: 18,
    paddingVertical: 9,
  },
  emptyBtnText: { fontFamily: font.uiSemibold, fontSize: 13, color: colors.white },
});
