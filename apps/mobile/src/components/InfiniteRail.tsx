import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, Text, View } from 'react-native';
import type { CatalogSort, ProductCardData } from '@youmart/shared-client';
import { railPage } from '@/lib/catalog';
import { ProductCard } from '@/components/ProductCard';
import { colors, font, space } from '@/theme';

const PAGE = 20;
const CARD_W = 160;

/**
 * v1.17 a product-page rail that keeps loading as it's swiped: page after page of the first
 * category, then the next one in `sources` (its parent, grandparent...), up to `max` products
 * so a long swipe never slows the page down.
 */
export function InfiniteRail({
  title,
  sources,
  exclude,
  skipCategory,
  sort,
  max = 100,
}: {
  title: string;
  /** Category slugs to page through, in order. */
  sources: readonly string[];
  /** Product ids never shown (the product itself, the other rail's first products...). */
  exclude: ReadonlySet<string>;
  /** Leave this category's own products out (show only neighbouring categories). */
  skipCategory?: string;
  sort?: CatalogSort;
  max?: number;
}) {
  const [items, setItems] = useState<ProductCardData[]>([]);
  const [loading, setLoading] = useState(false);
  const cursor = useRef({ source: 0, page: 1, done: false, busy: false });
  const seen = useRef(new Set<string>());
  const key = sources.join('|');

  const loadMore = useCallback(async () => {
    const c = cursor.current;
    if (c.done || c.busy) return;
    c.busy = true;
    setLoading(true);
    const fresh: ProductCardData[] = [];
    try {
      // Keep paging (and moving on to the next category) until this swipe has a few new cards.
      while (!c.done && fresh.length < 8 && seen.current.size < max) {
        const slug = sources[c.source];
        if (!slug) {
          c.done = true;
          break;
        }
        const res = await railPage(slug, c.page, { limit: PAGE, sort, skipCategory });
        for (const p of res.products) {
          if (exclude.has(p.id) || seen.current.has(p.id) || seen.current.size >= max) continue;
          seen.current.add(p.id);
          fresh.push(p);
        }
        if (res.exhausted) {
          c.source += 1;
          c.page = 1;
        } else c.page += 1;
      }
      if (seen.current.size >= max) c.done = true;
    } catch {
      c.done = true;
    } finally {
      c.busy = false;
      setLoading(false);
      if (fresh.length) setItems((prev) => [...prev, ...fresh]);
    }
  }, [sources, exclude, skipCategory, sort, max]);

  // A new product (or category chain) starts the rail over.
  useEffect(() => {
    cursor.current = { source: 0, page: 1, done: false, busy: false };
    seen.current = new Set();
    setItems([]);
    if (sources.length) void loadMore();
  }, [key]);

  if (items.length === 0) return null;
  return (
    <View style={styles.rail}>
      <Text style={styles.heading}>{title}</Text>
      <FlatList
        horizontal
        data={items}
        keyExtractor={(p) => p.id}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: space.lg }}
        ItemSeparatorComponent={Gap}
        renderItem={({ item }) => <ProductCard product={item} width={CARD_W} />}
        onEndReached={loadMore}
        onEndReachedThreshold={2}
        initialNumToRender={4}
        maxToRenderPerBatch={6}
        windowSize={5}
        removeClippedSubviews
        ListFooterComponent={
          loading ? (
            <View style={styles.more}>
              <ActivityIndicator color={colors.brand.DEFAULT} />
            </View>
          ) : undefined
        }
      />
    </View>
  );
}

const Gap = () => <View style={{ width: space.md }} />;

const styles = StyleSheet.create({
  rail: { marginTop: space.lg },
  heading: {
    fontFamily: font.uiBold,
    fontSize: 17,
    color: colors.heading,
    paddingHorizontal: space.lg,
    marginBottom: space.md,
  },
  more: { width: 60, alignSelf: 'stretch', alignItems: 'center', justifyContent: 'center' },
});
