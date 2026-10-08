import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type {
  CartProduct,
  ProductCardData,
  ProductDetailData,
  WishlistProduct,
} from '@youmart/shared-client';
import { emptyListingQuery, getProduct, listMoreProducts } from '@/lib/catalog';
import { recordView } from '@/stores/recently-viewed';
import { useCart } from '@/stores/cart';
import { useWishlist } from '@/stores/wishlist';
import { Price, ProductImage, Stars } from '@/components/ui';
import { ProductCard } from '@/components/ProductCard';
import { ProductReviews } from '@/components/ProductReviews';
import { colors, font, radii, space } from '@/theme';

const TABBAR_H = 46;
type TabKey = 'info' | 'reviews' | 'explore';
const TABS: { key: TabKey; label: string }[] = [
  { key: 'info', label: 'Product Info' },
  { key: 'reviews', label: 'Reviews' },
  { key: 'explore', label: 'More to Explore' },
];

const ASSURANCE: { icon: keyof typeof Ionicons.glyphMap; title: string; text: string }[] = [
  {
    icon: 'rocket-outline',
    title: 'On-time delivery',
    text: 'Delivered within the promised date.',
  },
  {
    icon: 'shield-checkmark-outline',
    title: 'Quality assured',
    text: '100% genuine, quality-checked products.',
  },
  { icon: 'sync-outline', title: 'Easy returns', text: 'Hassle-free returns & secure payments.' },
];

type MoreState = { products: ProductCardData[]; total: number; page: number; rawFetched: number };

export default function ProductScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const cart = useCart();
  const wishlist = useWishlist();
  const [product, setProduct] = useState<ProductDetailData | null | 'error'>(null);
  const [gallery, setGallery] = useState(0);
  const [more, setMore] = useState<MoreState | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [showBar, setShowBar] = useState(false);
  const [activeTab, setActiveTab] = useState<TabKey>('info');

  const listRef = useRef<FlatList<ProductCardData>>(null);
  const sections = useRef({ info: 0, reviews: 0, explore: 0 });
  const showBarRef = useRef(false);
  const activeRef = useRef<TabKey>('info');

  const prod = product && product !== 'error' ? product : null;
  const categorySlug = useMemo(() => {
    const href = prod?.categories[prod.categories.length - 1]?.href;
    return href ? (href.split('?')[0]?.split('/').filter(Boolean).pop() ?? '') : '';
  }, [prod]);

  useEffect(() => {
    let active = true;
    setProduct(null);
    setMore(null);
    getProduct(String(slug ?? ''))
      .then((p) => {
        if (!active) return;
        setProduct(p ?? 'error');
        if (p) recordView(p.id);
      })
      .catch(() => active && setProduct('error'));
    return () => {
      active = false;
    };
  }, [slug]);

  // Category feed powering the "Similar products" rail + the infinite "More to Explore" grid.
  useEffect(() => {
    if (!prod || !categorySlug) return;
    let active = true;
    const exclude = new Set([prod.id, ...prod.related.map((r) => r.id)]);
    listMoreProducts(categorySlug, { ...emptyListingQuery(), page: 1 })
      .then((res) => {
        if (!active) return;
        setMore({
          products: res.products.filter((p) => !exclude.has(p.id)),
          total: res.total,
          page: 1,
          rawFetched: res.products.length,
        });
      })
      .catch(() => active && setMore({ products: [], total: 0, page: 1, rawFetched: 0 }));
    return () => {
      active = false;
    };
  }, [prod, categorySlug]);

  const loadMoreExplore = useCallback(async () => {
    if (!more || loadingMore || !categorySlug || !prod || more.rawFetched >= more.total) return;
    setLoadingMore(true);
    const exclude = new Set([prod.id, ...prod.related.map((r) => r.id)]);
    try {
      const res = await listMoreProducts(categorySlug, {
        ...emptyListingQuery(),
        page: more.page + 1,
      });
      const items = res.products.filter((p) => !exclude.has(p.id));
      setMore((prev) =>
        prev
          ? {
              products: [...prev.products, ...items],
              total: res.total,
              page: prev.page + 1,
              rawFetched: prev.rawFetched + res.products.length,
            }
          : prev,
      );
    } catch {
      /* keep what we have */
    } finally {
      setLoadingMore(false);
    }
  }, [more, loadingMore, categorySlug, prod]);

  const onScroll = useCallback((e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const y = e.nativeEvent.contentOffset.y;
    const s = sections.current;
    const show = y > Math.max(220, s.info - TABBAR_H - 12);
    if (show !== showBarRef.current) {
      showBarRef.current = show;
      setShowBar(show);
    }
    let active: TabKey = 'info';
    if (s.explore && y >= s.explore - TABBAR_H - 24) active = 'explore';
    else if (s.reviews && y >= s.reviews - TABBAR_H - 24) active = 'reviews';
    if (active !== activeRef.current) {
      activeRef.current = active;
      setActiveTab(active);
    }
  }, []);

  const goTo = useCallback((key: TabKey) => {
    const y = sections.current[key];
    listRef.current?.scrollToOffset({ offset: Math.max(0, y - TABBAR_H), animated: true });
  }, []);

  if (product === null) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.brand.DEFAULT} />
      </View>
    );
  }
  if (product === 'error' || !prod) {
    return (
      <View style={styles.center}>
        <Ionicons name="alert-circle-outline" size={48} color={colors.card.border} />
        <Text style={styles.err}>Product not found.</Text>
      </View>
    );
  }

  const canBuy = Boolean(prod.skuId);
  const saved = prod.skuId ? wishlist.has(prod.skuId) : false;
  const images = prod.images.length > 0 ? [...prod.images] : [''];
  const similar = more ? more.products.slice(0, 12) : [];
  const gridData = more ? more.products.slice(12) : [];
  const hasExplore = prod.related.length > 0 || similar.length > 0 || gridData.length > 0;

  const cartProduct = (): CartProduct => ({
    skuId: prod.skuId!,
    productId: prod.id,
    productSlug: prod.slug,
    title: prod.title,
    price: prod.sellingPrice,
    image: images[0],
  });
  const wishProduct = (): WishlistProduct => ({
    skuId: prod.skuId!,
    productId: prod.id,
    productSlug: prod.slug,
    title: prod.title,
    price: prod.sellingPrice,
    mrp: prod.mrp,
  });

  const renderRail = (title: string, items: readonly ProductCardData[]) =>
    items.length > 0 ? (
      <View style={styles.rail}>
        <Text style={styles.sectionHeading}>{title}</Text>
        <FlatList
          horizontal
          data={items as ProductCardData[]}
          keyExtractor={(p) => p.id}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: space.lg }}
          ItemSeparatorComponent={() => <View style={{ width: space.md }} />}
          renderItem={({ item }) => <ProductCard product={item} width={160} />}
        />
      </View>
    ) : null;

  const header = (
    <View>
      <View style={styles.galleryWrap}>
        <FlatList
          horizontal
          pagingEnabled
          data={images}
          keyExtractor={(_, i) => String(i)}
          showsHorizontalScrollIndicator={false}
          onMomentumScrollEnd={(e) => setGallery(Math.round(e.nativeEvent.contentOffset.x / width))}
          renderItem={({ item }) => (
            <ProductImage src={item || undefined} style={{ width, height: width }} icon={56} />
          )}
        />
        {images.length > 1 ? (
          <View style={styles.dots}>
            {images.map((_, i) => (
              <View key={i} style={[styles.dot, i === gallery && styles.dotActive]} />
            ))}
          </View>
        ) : null}
        {canBuy ? (
          <Pressable
            style={styles.heart}
            onPress={() => wishlist.toggle(wishProduct())}
            hitSlop={8}
          >
            <Ionicons
              name={saved ? 'heart' : 'heart-outline'}
              size={22}
              color={saved ? colors.price.discount : colors.brand.DEFAULT}
            />
          </Pressable>
        ) : null}
      </View>

      <View style={styles.info}>
        <Text style={styles.title}>{prod.title}</Text>
        <View style={styles.ratingRow}>
          <Stars rating={prod.rating} size={16} />
          <Text style={styles.ratingCount}>({prod.ratingCount} reviews)</Text>
        </View>
        <Price mrp={prod.mrp} price={prod.sellingPrice} size="lg" />
        {prod.shortDescription ? <Text style={styles.short}>{prod.shortDescription}</Text> : null}
      </View>

      <View style={styles.assurance}>
        <Text style={styles.assuranceTitle}>Shop with Assurance</Text>
        {ASSURANCE.map((a) => (
          <View key={a.title} style={styles.assureRow}>
            <View style={styles.assureIcon}>
              <Ionicons name={a.icon} size={18} color={colors.brand.DEFAULT} />
            </View>
            <View style={styles.assureBody}>
              <Text style={styles.assureHead}>{a.title}</Text>
              <Text style={styles.assureText}>{a.text}</Text>
            </View>
          </View>
        ))}
      </View>

      <View
        style={styles.section}
        onLayout={(e) => {
          sections.current.info = e.nativeEvent.layout.y;
        }}
      >
        {prod.specifications.length > 0 ? (
          <View style={styles.specs}>
            <Text style={styles.specsTitle}>Specifications</Text>
            {prod.specifications.map((s) => (
              <View key={s.label} style={styles.specRow}>
                <Text style={styles.specLabel}>{s.label}</Text>
                <Text style={styles.specValue}>{s.value}</Text>
              </View>
            ))}
          </View>
        ) : null}
        {prod.description ? (
          <Text style={[styles.desc, { paddingHorizontal: space.lg }]}>{prod.description}</Text>
        ) : null}
      </View>

      <View
        onLayout={(e) => {
          sections.current.reviews = e.nativeEvent.layout.y;
        }}
      >
        <ProductReviews slug={prod.slug} />
      </View>

      {hasExplore ? (
        <View
          onLayout={(e) => {
            sections.current.explore = e.nativeEvent.layout.y;
          }}
        >
          {renderRail('Complete your choice', prod.related)}
          {renderRail('Similar products', similar)}
          {gridData.length > 0 ? (
            <Text style={[styles.sectionHeading, styles.exploreHeading]}>More to Explore</Text>
          ) : null}
        </View>
      ) : null}
    </View>
  );

  return (
    <View style={styles.screen}>
      <FlatList
        ref={listRef}
        data={gridData}
        keyExtractor={(p) => p.id}
        numColumns={2}
        columnWrapperStyle={styles.gridRow}
        ListHeaderComponent={header}
        renderItem={({ item }) => (
          <View style={styles.gridCell}>
            <ProductCard product={item} />
          </View>
        )}
        onScroll={onScroll}
        scrollEventThrottle={16}
        onEndReached={loadMoreExplore}
        onEndReachedThreshold={1.2}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 110 }}
        ListFooterComponent={
          loadingMore ? (
            <ActivityIndicator color={colors.brand.DEFAULT} style={{ margin: space.lg }} />
          ) : null
        }
      />

      {showBar ? (
        <View style={styles.tabBar}>
          {TABS.map((t) => {
            const on = activeTab === t.key;
            return (
              <Pressable key={t.key} style={styles.tabItem} onPress={() => goTo(t.key)}>
                <Text style={[styles.tabText, on && styles.tabTextActive]}>{t.label}</Text>
                {on ? <View style={styles.tabUnderline} /> : null}
              </Pressable>
            );
          })}
        </View>
      ) : null}

      <View style={[styles.buyBar, { paddingBottom: insets.bottom + space.sm }]}>
        <Pressable
          style={[styles.addBtn, !canBuy && styles.disabled]}
          disabled={!canBuy}
          onPress={() => cart.addItem(cartProduct())}
        >
          <Ionicons name="cart-outline" size={18} color={colors.brand.DEFAULT} />
          <Text style={styles.addText}>Add to Cart</Text>
        </Pressable>
        <Pressable
          style={[styles.buyBtn, !canBuy && styles.disabled]}
          disabled={!canBuy}
          onPress={() => {
            cart.addItem(cartProduct());
            router.push('/cart');
          }}
        >
          <Text style={styles.buyText}>Buy Now</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.white },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.md,
    backgroundColor: colors.page,
  },
  err: { fontFamily: font.uiSemibold, fontSize: 16, color: colors.text.strong },
  galleryWrap: { backgroundColor: colors.white },
  dots: {
    position: 'absolute',
    bottom: space.md,
    alignSelf: 'center',
    flexDirection: 'row',
    gap: 6,
  },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: colors.card.border },
  dotActive: { backgroundColor: colors.brand.DEFAULT, width: 18 },
  heart: {
    position: 'absolute',
    top: space.md,
    right: space.md,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  info: {
    padding: space.lg,
    gap: space.md,
    backgroundColor: colors.page,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    marginTop: -16,
  },
  title: { fontFamily: font.uiBold, fontSize: 20, lineHeight: 27, color: colors.text.strong },
  ratingRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  ratingCount: { fontFamily: font.body, fontSize: 13, color: colors.brand.accent },
  short: { fontFamily: font.body, fontSize: 14, lineHeight: 21, color: colors.text.body },
  assurance: {
    backgroundColor: colors.white,
    marginHorizontal: space.lg,
    marginTop: space.md,
    borderRadius: radii.tile,
    borderWidth: 1,
    borderColor: colors.brandPopup.border,
    padding: space.lg,
    gap: space.md,
  },
  assuranceTitle: { fontFamily: font.uiBold, fontSize: 16, color: colors.heading },
  assureRow: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  assureIcon: {
    width: 38,
    height: 38,
    borderRadius: 11,
    backgroundColor: colors.brandPopup.bg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  assureBody: { flex: 1, gap: 1 },
  assureHead: { fontFamily: font.uiSemibold, fontSize: 14, color: colors.text.strong },
  assureText: { fontFamily: font.body, fontSize: 12.5, lineHeight: 17, color: colors.text.body },
  section: { paddingTop: space.lg, gap: space.md },
  specs: {
    backgroundColor: colors.white,
    marginHorizontal: space.lg,
    borderRadius: radii.tile,
    borderWidth: 1,
    borderColor: colors.card.border,
    padding: space.lg,
    gap: space.sm,
  },
  specsTitle: {
    fontFamily: font.uiSemibold,
    fontSize: 15,
    color: colors.text.strong,
    marginBottom: 2,
  },
  specRow: { flexDirection: 'row', justifyContent: 'space-between', gap: space.lg },
  specLabel: { fontFamily: font.body, fontSize: 13, color: colors.text.body, flex: 1 },
  specValue: {
    fontFamily: font.uiMedium,
    fontSize: 13,
    color: colors.text.strong,
    flex: 1,
    textAlign: 'right',
  },
  desc: { fontFamily: font.body, fontSize: 14, lineHeight: 22, color: colors.text.body },
  rail: { marginTop: space.lg },
  sectionHeading: {
    fontFamily: font.uiBold,
    fontSize: 17,
    color: colors.heading,
    paddingHorizontal: space.lg,
    marginBottom: space.md,
  },
  exploreHeading: { marginTop: space.xl },
  gridRow: { gap: space.md, paddingHorizontal: space.lg },
  gridCell: { flex: 1, marginBottom: space.md },
  tabBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: TABBAR_H,
    flexDirection: 'row',
    backgroundColor: colors.white,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.menu,
    zIndex: 10,
    elevation: 4,
  },
  tabItem: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 4 },
  tabText: { fontFamily: font.uiMedium, fontSize: 13, color: colors.text.body },
  tabTextActive: { fontFamily: font.uiBold, color: colors.brand.DEFAULT },
  tabUnderline: {
    position: 'absolute',
    bottom: 0,
    height: 2.5,
    width: '55%',
    borderRadius: 2,
    backgroundColor: colors.brand.DEFAULT,
  },
  buyBar: {
    flexDirection: 'row',
    gap: space.md,
    paddingHorizontal: space.lg,
    paddingTop: space.md,
    backgroundColor: colors.white,
    borderTopWidth: 1,
    borderTopColor: colors.border.menu,
  },
  addBtn: {
    flex: 1,
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: colors.brand.DEFAULT,
    borderRadius: radii.button,
    paddingVertical: 14,
  },
  addText: { fontFamily: font.uiSemibold, fontSize: 15, color: colors.brand.DEFAULT },
  buyBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.brand.DEFAULT,
    borderRadius: radii.button,
    paddingVertical: 14,
  },
  buyText: { fontFamily: font.uiSemibold, fontSize: 15, color: colors.white },
  disabled: { opacity: 0.4 },
});
