import { memo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import type { ProductCardData } from '@youmart/shared-client';
import { colors, font, radii, space } from '@/theme';
import { useCart } from '@/stores/cart';
import { useWishlist } from '@/stores/wishlist';
import { Price, ProductImage, Stars } from './ui';

interface Props {
  product: ProductCardData;
  /** Fixed width for horizontal rails; omit for grid (flex). */
  width?: number;
}

function ProductCardBase({ product, width }: Props) {
  const router = useRouter();
  const cart = useCart();
  const wishlist = useWishlist();
  const slug = product.slug ?? '';
  const saved = product.skuId ? wishlist.has(product.skuId) : false;

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
        pressed && styles.pressed,
      ]}
    >
      <View>
        <ProductImage src={product.image} style={styles.image} />
        {product.skuId ? (
          <Pressable onPress={heart} hitSlop={8} style={styles.heart}>
            <Ionicons
              name={saved ? 'heart' : 'heart-outline'}
              size={18}
              color={saved ? colors.price.discount : colors.brand.DEFAULT}
            />
          </Pressable>
        ) : null}
      </View>

      <View style={styles.body}>
        <Text numberOfLines={2} style={styles.title}>
          {product.title}
        </Text>
        <Stars rating={product.rating} />
        <Price mrp={product.mrp} price={product.sellingPrice} size="sm" />
        {product.skuId ? (
          <Pressable
            onPress={add}
            style={({ pressed }) => [styles.add, pressed && styles.addPressed]}
          >
            <Ionicons name="cart-outline" size={15} color={colors.white} />
            <Text style={styles.addText}>Add</Text>
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
  heart: {
    position: 'absolute',
    top: space.sm,
    right: space.sm,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
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
});
