import { memo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import type { ProductCardData } from '@youmart/shared-client';
import { colors, font, radii, space } from '@/theme';
import { useCart } from '@/stores/cart';
import { useWishlist } from '@/stores/wishlist';
import { Price, ProductImage, Stars } from './ui';

interface Props {
  product: ProductCardData;
  /** Fixed width for horizontal rails; omit for grid (flex). */
  width?: number;
  /** Subtle per-rail accent (themes the border, a thin divider, and a soft lift shadow). */
  accent?: string;
  /** Tighter card for narrow grids (category screen beside the sub-category rail). */
  compact?: boolean;
}

function ProductCardBase({ product, width, accent, compact }: Props) {
  const router = useRouter();
  const cart = useCart();
  const wishlist = useWishlist();
  const slug = product.slug ?? '';
  const saved = product.skuId ? wishlist.has(product.skuId) : false;
  const pop = useSharedValue(1);
  const heartStyle = useAnimatedStyle(() => ({ transform: [{ scale: pop.value }] }));

  const open = () => {
    if (slug) router.push(`/product/${slug}`);
  };

  const add = () => {
    if (!product.skuId || !slug) return;
    cart.addItem({
      skuId: product.skuId,
      productId: product.id,
      productSlug: slug,
      title: product.title,
      price: product.sellingPrice,
      image: product.image,
    });
  };

  const heart = () => {
    if (!product.skuId || !slug) return;
    pop.value = withSequence(withTiming(1.3, { duration: 110 }), withSpring(1, { damping: 6 }));
    wishlist.toggle({
      skuId: product.skuId,
      productId: product.id,
      productSlug: slug,
      title: product.title,
      price: product.sellingPrice,
      mrp: product.mrp,
    });
  };

  return (
    <Pressable
      onPress={open}
      style={({ pressed }) => [
        styles.card,
        width ? { width } : styles.flex,
        accent
          ? {
              borderColor: accent,
              shadowColor: accent,
              shadowOpacity: 0.22,
              shadowRadius: 10,
              shadowOffset: { width: 0, height: 6 },
              elevation: 4,
            }
          : null,
        pressed && styles.pressed,
      ]}
    >
      <View>
        <ProductImage src={product.image} style={styles.image} />
        {accent ? <View style={[styles.accentStrip, { backgroundColor: accent }]} /> : null}
        {product.skuId ? (
          <Pressable
            onPress={heart}
            hitSlop={8}
            style={({ pressed }) => [
              styles.heart,
              compact && styles.heartCompact,
              saved && styles.heartSaved,
              pressed && styles.heartPressed,
            ]}
          >
            <Animated.View style={heartStyle}>
              <Ionicons
                name={saved ? 'heart' : 'heart-outline'}
                size={compact ? 14 : 18}
                color={saved ? colors.price.discount : colors.brand.DEFAULT}
              />
            </Animated.View>
          </Pressable>
        ) : null}
      </View>

      <View style={[styles.body, compact && styles.bodyCompact]}>
        <Text numberOfLines={2} style={[styles.title, compact && styles.titleCompact]}>
          {product.title}
        </Text>
        <Stars rating={product.rating} size={compact ? 10 : 13} />
        <Price mrp={product.mrp} price={product.sellingPrice} size={compact ? 'xs' : 'sm'} />
        {product.skuId ? (
          <Pressable
            onPress={add}
            style={({ pressed }) => [
              styles.add,
              compact && styles.addCompact,
              pressed && styles.addPressed,
            ]}
          >
            <Ionicons name="cart-outline" size={compact ? 13 : 15} color={colors.white} />
            <Text style={[styles.addText, compact && styles.addTextCompact]}>Add</Text>
          </Pressable>
        ) : null}
      </View>
    </Pressable>
  );
}

export const ProductCard = memo(ProductCardBase);

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.white,
    borderRadius: radii.productCard,
    borderWidth: 1,
    borderColor: colors.card.border,
    overflow: 'hidden',
  },
  flex: { flex: 1 },
  pressed: { opacity: 0.85 },
  image: { borderTopLeftRadius: radii.productCard, borderTopRightRadius: radii.productCard },
  accentStrip: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 3 },
  heart: {
    position: 'absolute',
    top: space.sm,
    right: space.sm,
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.card.border,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  heartSaved: { backgroundColor: '#fff0f0', borderColor: colors.price.discount },
  heartPressed: { opacity: 0.7 },
  body: { padding: space.md, gap: 6 },
  title: { fontFamily: font.body, fontSize: 13.5, lineHeight: 18, color: colors.text.strong },
  add: {
    marginTop: 4,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: colors.brand.DEFAULT,
    borderRadius: radii.button,
    paddingVertical: 8,
  },
  addPressed: { backgroundColor: colors.brand.accent },
  addText: { fontFamily: font.uiSemibold, fontSize: 13, color: colors.white },
  heartCompact: { width: 26, height: 26, borderRadius: 13, top: 6, right: 6 },
  bodyCompact: { padding: 8, gap: 3 },
  titleCompact: { fontSize: 11.5, lineHeight: 15 },
  addCompact: { paddingVertical: 6, marginTop: 2, gap: 4 },
  addTextCompact: { fontSize: 12 },
});
