import { memo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import type { ProductCardData } from '@youmart/shared-client';
import { colors, font, radii, space } from '@/theme';
import { useWishlist } from '@/stores/wishlist';
import { BuyNowButton } from './BuyNowButton';
import { CartStepper } from './CartStepper';
import { SaveButton } from './SaveButton';
import { Price, ProductImage, Stars } from './ui';

interface Props {
  product: ProductCardData;
  /** Fixed width for horizontal rails; omit for grid (flex). */
  width?: number;
  /** Subtle per-rail accent (themes the border, a thin divider, and a soft lift shadow). */
  accent?: string;
  /** Tighter card for narrow grids (category screen beside the sub-category rail). */
  compact?: boolean;
  /** v1.17 very narrow card (3 across): Add / the − qty + stepper and Buy stacked full-width,
   * so the stepper's "+" is never squeezed out. */
  stacked?: boolean;
}

function ProductCardBase({ product, width, accent, compact, stacked }: Props) {
  const router = useRouter();
  const wishlist = useWishlist();
  const slug = product.slug ?? '';
  const saved = product.skuId ? wishlist.has(product.skuId) : false;

  const open = () => {
    if (slug) router.push(`/product/${slug}`);
  };

  const cartProduct =
    product.skuId && slug
      ? {
          skuId: product.skuId,
          productId: product.id,
          productSlug: slug,
          title: product.title,
          price: product.sellingPrice,
          image: product.image,
        }
      : null;

  const toggleSaved = () => {
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
          <SaveButton
            saved={saved}
            onToggle={toggleSaved}
            size={compact ? 14 : 18}
            diameter={compact ? 28 : 34}
            style={styles.save}
          />
        ) : null}
      </View>

      <View style={[styles.body, compact && styles.bodyCompact]}>
        <Text numberOfLines={2} style={[styles.title, compact && styles.titleCompact]}>
          {product.title}
        </Text>
        <Stars rating={product.rating} size={compact ? 12 : 15} bold />
        <Price mrp={product.mrp} price={product.sellingPrice} size={compact ? 'xs' : 'sm'} />
        {/* v1.17: Add + Buy side by side (Buy = straight to checkout with just this product);
            stacked on very narrow cards. */}
        <View
          style={[
            styles.actions,
            stacked && styles.actionsStacked,
            compact ? styles.addCompact : styles.add,
          ]}
        >
          <CartStepper
            product={cartProduct}
            compact={compact}
            dense
            style={stacked ? undefined : styles.addBtn}
          />
          <BuyNowButton
            product={cartProduct}
            compact={compact}
            style={stacked ? undefined : styles.buyBtn}
          />
        </View>
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
  save: { position: 'absolute', top: space.sm, right: space.sm },
  body: { padding: space.md, gap: 6 },
  title: { fontFamily: font.body, fontSize: 13.5, lineHeight: 18, color: colors.text.strong },
  add: { marginTop: 4 },
  actions: { flexDirection: 'row', gap: 5 },
  actionsStacked: { flexDirection: 'column', gap: 5 },
  addBtn: { flex: 1.3 },
  buyBtn: { flex: 1 },
  bodyCompact: { padding: 8, gap: 3 },
  titleCompact: { fontSize: 11.5, lineHeight: 15 },
  addCompact: { marginTop: 2 },
});
