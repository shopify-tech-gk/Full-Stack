import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  ScrollView,
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
import type { CartProduct, ProductDetailData, WishlistProduct } from '@youmart/shared-client';
import { getProduct } from '@/lib/catalog';
import { recordView } from '@/stores/recently-viewed';
import { useCart } from '@/stores/cart';
import { useWishlist } from '@/stores/wishlist';
import { Price, ProductImage, Stars } from '@/components/ui';
import { ProductCard } from '@/components/ProductCard';
import { ProductReviews } from '@/components/ProductReviews';
import { colors, font, radii, space } from '@/theme';

export default function ProductScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const cart = useCart();
  const wishlist = useWishlist();
  const [product, setProduct] = useState<ProductDetailData | null | 'error'>(null);
  const [gallery, setGallery] = useState(0);

  useEffect(() => {
    let active = true;
    getProduct(String(slug ?? ''))
      .then((p) => {
        if (!active) return;
        setProduct(p ?? 'error');
        if (p) recordView(p.id); // non-blocking, fire-and-forget (never awaited)
      })
      .catch(() => active && setProduct('error'));
    return () => {
      active = false;
    };
  }, [slug]);

  if (product === null) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.brand.DEFAULT} />
      </View>
    );
  }
  if (product === 'error') {
    return (
      <View style={styles.center}>
        <Ionicons name="alert-circle-outline" size={48} color={colors.card.border} />
        <Text style={styles.err}>Product not found.</Text>
      </View>
    );
  }

  const canBuy = Boolean(product.skuId);
  const saved = product.skuId ? wishlist.has(product.skuId) : false;
  const images = product.images.length > 0 ? product.images : [''];

  const cartProduct = (): CartProduct => ({
    skuId: product.skuId!,
    productId: product.id,
    productSlug: product.slug,
    title: product.title,
    price: product.sellingPrice,
    image: images[0],
  });
  const wishProduct = (): WishlistProduct => ({
    skuId: product.skuId!,
    productId: product.id,
    productSlug: product.slug,
    title: product.title,
    price: product.sellingPrice,
    mrp: product.mrp,
  });
  const onGalleryScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) =>
    setGallery(Math.round(e.nativeEvent.contentOffset.x / width));

  return (
    <View style={styles.screen}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: space.xxxl }}
      >
        <View style={styles.galleryWrap}>
          <FlatList
            horizontal
            pagingEnabled
            data={images}
            keyExtractor={(_, i) => String(i)}
            showsHorizontalScrollIndicator={false}
            onMomentumScrollEnd={onGalleryScroll}
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
          <Text style={styles.title}>{product.title}</Text>
          <View style={styles.ratingRow}>
            <Stars rating={product.rating} size={16} />
            <Text style={styles.ratingCount}>({product.ratingCount} reviews)</Text>
          </View>
          <Price mrp={product.mrp} price={product.sellingPrice} size="lg" />
          {product.shortDescription ? (
            <Text style={styles.short}>{product.shortDescription}</Text>
          ) : null}

          {product.specifications.length > 0 ? (
            <View style={styles.specs}>
              <Text style={styles.specsTitle}>Specifications</Text>
              {product.specifications.map((s) => (
                <View key={s.label} style={styles.specRow}>
                  <Text style={styles.specLabel}>{s.label}</Text>
                  <Text style={styles.specValue}>{s.value}</Text>
                </View>
              ))}
            </View>
          ) : null}

          {product.description ? <Text style={styles.desc}>{product.description}</Text> : null}
        </View>

        <ProductReviews slug={product.slug} />

        {product.related.length > 0 ? (
          <View style={styles.related}>
            <Text style={styles.relatedTitle}>You may also like</Text>
            <FlatList
              horizontal
              data={product.related}
              keyExtractor={(p) => p.id}
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ paddingHorizontal: space.lg }}
              ItemSeparatorComponent={() => <View style={{ width: space.md }} />}
              renderItem={({ item }) => <ProductCard product={item} width={160} />}
            />
          </View>
        ) : null}
      </ScrollView>

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
  specs: {
    backgroundColor: colors.white,
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
  related: { marginTop: space.lg, paddingBottom: space.lg },
  relatedTitle: {
    fontFamily: font.uiBold,
    fontSize: 17,
    color: colors.heading,
    paddingHorizontal: space.lg,
    marginBottom: space.md,
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
