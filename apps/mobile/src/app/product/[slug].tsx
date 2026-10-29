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
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type {
  CartProduct,
  ProductCardData,
  ProductDetailData,
  WishlistProduct,
} from '@youmart/shared-client';
import { categoryLineage, emptyListingQuery, getProduct, listMoreProducts } from '@/lib/catalog';
import { recordView } from '@/stores/recently-viewed';
import { useCart } from '@/stores/cart';
import { useWishlist } from '@/stores/wishlist';
import { SaveButton } from '@/components/SaveButton';
import { useSession } from '@/stores/session';
import { ProductGallery } from '@/components/ProductGallery';
import { ProductAbout, ProductHeading, ProductPricing } from '@/components/ProductDetails';
import { ProductCard } from '@/components/ProductCard';
import { InfiniteRail } from '@/components/InfiniteRail';
import { ProductReviews } from '@/components/ProductReviews';
import { shareProduct } from '@/lib/share';
import * as Haptics from 'expo-haptics';
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
  const session = useSession();
  const [adding, setAdding] = useState(false);
  const wishlist = useWishlist();
  const [product, setProduct] = useState<ProductDetailData | null | 'error'>(null);
  const [more, setMore] = useState<MoreState | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [showBar, setShowBar] = useState(false);
  const [activeTab, setActiveTab] = useState<TabKey>('info');
  // Chosen pack size / option (null = the product's default SKU).
  const [pickedSku, setPickedSku] = useState<string | null>(null);

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
    setPickedSku(null);
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

  // The category's parent chain: the rails move on to related categories when one runs out.
  const [lineage, setLineage] = useState<string[]>([]);
  useEffect(() => {
    if (!categorySlug) return;
    let active = true;
    categoryLineage(categorySlug).then((l) => active && setLineage(l));
    return () => {
      active = false;
    };
  }, [categorySlug]);
  const railExclude = useMemo(() => new Set(prod ? [prod.id] : []), [prod]);
  const pairSources = useMemo(() => (lineage.length > 1 ? lineage.slice(1) : lineage), [lineage]);

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

  // The selected option drives the price and what Add / Buy / Save act on.
  const variant = prod.variants.find((v) => v.skuId === (pickedSku ?? prod.skuId));
  const skuId = variant?.skuId ?? prod.skuId;
  const price = variant?.sellingPrice ?? prod.sellingPrice;
  const mrp = variant?.mrp ?? prod.mrp;
  const canBuy = Boolean(skuId);
  // Once it's in the cart the button says so (Flipkart-style "Go to Cart") instead of resetting.
  const inCart = skuId ? cart.cart.items.find((i) => i.skuId === skuId) : undefined;
  const addToCart = async () => {
    if (adding) return;
    setAdding(true);
    try {
      await cart.addItem(cartProduct());
    } finally {
      setAdding(false);
    }
    // "Added to cart" + the free-delivery progress pop up from components/FreeDeliveryNudge.tsx.
  };
  const saved = skuId ? wishlist.has(skuId) : false;
  // A picked variant with its own photo / title leads with them (the product's otherwise).
  const picked = pickedSku ? variant : undefined;
  const shownTitle = picked?.title ?? null;
  const baseImages = prod.images.length > 0 ? [...prod.images] : [''];
  const images = picked?.image
    ? [picked.image, ...baseImages.filter((u) => u && u !== picked.image)]
    : baseImages;
  const lineTitle = variant
    ? (variant.title ?? `${prod.title}${variant.label ? ` (${variant.label})` : ''}`)
    : prod.title;
  const gridData = more ? more.products : [];
  const hasExplore = Boolean(categorySlug) || gridData.length > 0;

  const cartProduct = (): CartProduct => ({
    skuId: skuId!,
    productId: prod.id,
    productSlug: prod.slug,
    title: lineTitle,
    price,
    image: images[0],
  });
  const wishProduct = (): WishlistProduct => ({
    skuId: skuId!,
    productId: prod.id,
    productSlug: prod.slug,
    title: lineTitle,
    price,
    mrp,
  });

  const header = (
    <View>
      <ProductGallery key={images[0] ?? ''} images={images} width={width}>
        {canBuy ? (
          <SaveButton
            saved={saved}
            onToggle={() => wishlist.toggle(wishProduct())}
            size={22}
            diameter={40}
            style={styles.heart}
          />
        ) : null}
        {/* v1.17 Share: the phone's share sheet (WhatsApp, Instagram, Facebook, Copy...). */}
        <Pressable
          onPress={() => {
            void Haptics.selectionAsync().catch(() => undefined);
            void shareProduct({ title: prod.title, slug: prod.slug, price });
          }}
          style={({ pressed }) => [
            styles.shareBtn,
            canBuy ? null : styles.shareBtnTop,
            pressed && { opacity: 0.8, transform: [{ scale: 0.94 }] },
          ]}
          hitSlop={6}
          accessibilityLabel={`Share ${prod.title}`}
        >
          <Ionicons name="share-social" size={20} color={colors.brand.DEFAULT} />
        </Pressable>
      </ProductGallery>

      <View style={styles.info}>
        <ProductHeading prod={prod} title={shownTitle} />
        <ProductPricing
          prod={prod}
          price={price}
          mrp={mrp}
          selectedSkuId={skuId}
          onSelect={setPickedSku}
        />
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
        <ProductAbout prod={prod} />
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
          {/* Pairs well: the neighbouring categories (Compost next to Vermicompost...). */}
          <InfiniteRail
            title="Complete your choice"
            sources={pairSources}
            skipCategory={lineage.length > 1 ? categorySlug : undefined}
            exclude={railExclude}
            sort="rating"
          />
          {/* Same category first, then its parent / related categories. */}
          <InfiniteRail title="Similar products" sources={lineage} exclude={railExclude} />
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
          ) : undefined
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
        {inCart ? (
          <Pressable
            style={({ pressed }) => [styles.addBtn, styles.addedBtn, pressed && { opacity: 0.85 }]}
            onPress={() => router.push('/my-cart')}
          >
            <Ionicons name="checkmark-circle" size={18} color={colors.white} />
            <Text style={styles.addedText}>Go to Cart</Text>
          </Pressable>
        ) : (
          <Pressable
            style={[styles.addBtn, !canBuy && styles.disabled]}
            disabled={!canBuy || adding}
            onPress={() => void addToCart()}
          >
            {adding ? (
              <ActivityIndicator color={colors.white} />
            ) : (
              <>
                <MaterialCommunityIcons name="cart-plus" size={19} color={colors.white} />
                <Text style={styles.addText}>Add to Cart</Text>
              </>
            )}
          </Pressable>
        )}
        <Pressable
          style={[styles.buyBtn, !canBuy && styles.disabled]}
          disabled={!canBuy}
          onPress={async () => {
            // Signed in: straight to checkout with just this product (Flipkart-style).
            if (session.status === 'authenticated') {
              // `temp`: taken back out of the cart if they leave checkout without ordering.
              const product = cartProduct();
              const inCart = cart.cart.items.some((l) => l.skuId === product.skuId);
              const id = await cart.buyNow(product);
              if (id) router.push(`/checkout?buy=${id}${inCart ? '' : '&temp=1'}`);
              return;
            }
            await cart.addItem(cartProduct());
            router.push('/my-cart');
          }}
        >
          <Ionicons name="bag-check" size={18} color={BUY_INK} />
          <Text style={styles.buyText}>Buy Now</Text>
        </Pressable>
      </View>
    </View>
  );
}

// The cards' Buy button colours (components/BuyNowButton.tsx).
const BUY_YELLOW = '#ffd60a';
const BUY_INK = '#1f1300';

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
  heart: { position: 'absolute', top: space.md, right: space.md },
  shareBtn: {
    position: 'absolute',
    top: space.md + 48,
    right: space.md,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  shareBtnTop: { top: space.md },
  info: {
    paddingBottom: space.lg,
    backgroundColor: colors.page,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    marginTop: -16,
  },
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
    backgroundColor: colors.brand.DEFAULT,
    borderRadius: radii.button,
    paddingVertical: 14,
  },
  // Same colours as the product cards' Add (blue) and Buy (yellow) - components/ProductCard.tsx.
  addText: { fontFamily: font.uiSemibold, fontSize: 15, color: colors.white },
  addedBtn: { backgroundColor: colors.brand.DEFAULT },
  addedText: { fontFamily: font.uiSemibold, fontSize: 15, color: colors.white },
  buyBtn: {
    flex: 1,
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: BUY_YELLOW,
    borderRadius: radii.button,
    paddingVertical: 14,
  },
  buyText: { fontFamily: font.uiBold, fontSize: 15, color: BUY_INK },
  disabled: { opacity: 0.4 },
});
