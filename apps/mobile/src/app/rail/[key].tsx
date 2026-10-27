import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useNavigation } from 'expo-router';
import {
  PRODUCT_RAIL_DEFINITIONS,
  type ProductCardData,
  type ProductRailKey,
} from '@youmart/shared-client';
import { getRailPage } from '@/lib/catalog';
import { ProductCard } from '@/components/ProductCard';
import { FALLBACK_RAIL_THEME, RAIL_THEME } from '@/components/RailPanels';
import { colors, font, radii, space } from '@/theme';

/**
 * v1.17 "View all" for a home rail (Top Deals, Trending Products...): a themed banner, then every
 * product of that kind in a 2-column grid that loads more as you scroll.
 */
export default function RailScreen() {
  const { key } = useLocalSearchParams<{ key: string }>();
  const navigation = useNavigation();
  const definition = PRODUCT_RAIL_DEFINITIONS.find((d) => d.key === key);
  const railKey = (definition?.key ?? 'explore') as ProductRailKey;
  const theme = RAIL_THEME[railKey] ?? FALLBACK_RAIL_THEME;
  const heading = definition?.heading ?? 'Products';

  const [items, setItems] = useState<ProductCardData[]>([]);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const busy = useRef(false);

  useLayoutEffect(() => {
    navigation.setOptions({ title: heading });
  }, [navigation, heading]);

  const loadMore = useCallback(async () => {
    if (busy.current || !hasMore) return;
    busy.current = true;
    setLoading(true);
    try {
      const next = page + 1;
      const res = await getRailPage(railKey, next);
      setItems((prev) => {
        const seen = new Set(prev.map((p) => p.id));
        return [...prev, ...res.products.filter((p) => !seen.has(p.id))];
      });
      setPage(next);
      setHasMore(res.hasMore);
      setError(false);
    } catch {
      setError(true);
    } finally {
      busy.current = false;
      setLoading(false);
    }
  }, [page, hasMore, railKey]);

  useEffect(() => {
    void loadMore();
    // First page only; later pages come from scrolling.
  }, []);

  const banner = (
    <View style={[styles.banner, { experimental_backgroundImage: theme.gradient }]}>
      <View style={[styles.glow, styles.glowTop]} pointerEvents="none" />
      <View style={[styles.glow, styles.glowBottom]} pointerEvents="none" />
      <View style={styles.bannerIcon}>
        <Ionicons name={theme.icon} size={22} color={colors.white} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.bannerTitle}>{heading}</Text>
        <Text style={styles.bannerSub}>{theme.tagline}</Text>
      </View>
    </View>
  );

  if (items.length === 0) {
    return (
      <View style={styles.screen}>
        <View style={styles.pad}>{banner}</View>
        <View style={styles.center}>
          {error ? (
            <>
              <Text style={styles.empty}>Could not load these products.</Text>
              <Pressable style={styles.retry} onPress={() => void loadMore()}>
                <Text style={styles.retryText}>Try again</Text>
              </Pressable>
            </>
          ) : loading || hasMore ? (
            <ActivityIndicator size="large" color={colors.brand.DEFAULT} />
          ) : (
            <Text style={styles.empty}>Nothing here right now.</Text>
          )}
        </View>
      </View>
    );
  }

  return (
    <FlatList
      style={styles.screen}
      data={items}
      keyExtractor={(p) => p.id}
      numColumns={2}
      columnWrapperStyle={{ gap: space.md }}
      contentContainerStyle={styles.grid}
      ListHeaderComponent={banner}
      renderItem={({ item }) => <ProductCard product={item} />}
      onEndReached={() => void loadMore()}
      onEndReachedThreshold={0.6}
      ListFooterComponent={
        loading ? (
          <ActivityIndicator style={{ marginVertical: space.lg }} color={colors.brand.DEFAULT} />
        ) : undefined
      }
    />
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.page },
  pad: { padding: space.lg, paddingBottom: 0 },
  grid: { padding: space.lg, gap: space.md },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: space.md },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 20,
    padding: 16,
    overflow: 'hidden',
    marginBottom: space.xs,
  },
  glow: { position: 'absolute', borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.09)' },
  glowTop: { width: 160, height: 160, top: -70, right: -40 },
  glowBottom: { width: 110, height: 110, bottom: -60, left: -30 },
  bannerIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.28)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bannerTitle: { fontFamily: font.uiBold, fontSize: 19, color: colors.white },
  bannerSub: { fontFamily: font.uiMedium, fontSize: 12.5, color: 'rgba(255,255,255,0.8)' },
  empty: { fontFamily: font.body, fontSize: 14, color: colors.text.body },
  retry: {
    backgroundColor: colors.brand.DEFAULT,
    borderRadius: radii.pill,
    paddingHorizontal: 22,
    paddingVertical: 10,
  },
  retryText: { fontFamily: font.uiSemibold, fontSize: 14, color: colors.white },
});
