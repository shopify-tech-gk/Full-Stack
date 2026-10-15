import { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import type { CartProduct, WishlistItem } from '@youmart/shared-client';
import { api } from '@/lib/api';
import { useWishlist } from '@/stores/wishlist';
import { useCart } from '@/stores/cart';
import { useSession } from '@/stores/session';
import { CartStepper } from '@/components/CartStepper';
import { ProductImage, Price } from '@/components/ui';
import { colors, font, radii, space } from '@/theme';

function cartProductOf(item: WishlistItem, image?: string): CartProduct | null {
  if (!item.available || !item.productSlug || !item.sellingPrice) return null;
  return {
    skuId: item.skuId,
    productId: item.productId,
    productSlug: item.productSlug,
    title: item.title ?? 'Product',
    price: item.sellingPrice,
    ...(image ? { image } : {}),
  };
}

/**
 * The saved-items list, shared by the "Buy Again" tab and the /wishlist stack screen. Tap an item to
 * open it; "Add" turns into a quantity stepper; "Buy now" checks out just that item.
 */
export function WishlistList() {
  const router = useRouter();
  const session = useSession();
  const { wishlist, remove } = useWishlist();
  const cart = useCart();
  const [buying, setBuying] = useState<string | null>(null);

  // Wishlist lines carry no image - look the products up (one request, cached per product id).
  const [images, setImages] = useState<Record<string, string>>({});
  const idsKey = [...new Set(wishlist.items.map((i) => i.productId))].sort().join(',');
  useEffect(() => {
    const missing = idsKey.split(',').filter((id) => id && !(id in images));
    if (missing.length === 0) return;
    api.catalog
      .productCards(missing)
      .then(({ items }) =>
        setImages((prev) => {
          const next = { ...prev };
          for (const id of missing) next[id] = '';
          for (const item of items) next[item.id] = item.imageUrl ?? '';
          return next;
        }),
      )
      .catch(() => undefined);
  }, [idsKey]); // `images` is a cache, not an input

  const open = (item: WishlistItem) => {
    if (item.productSlug) router.push(`/product/${item.productSlug}`);
  };

  const buyNow = async (item: WishlistItem, product: CartProduct) => {
    if (session.status !== 'authenticated') {
      router.push('/auth/login');
      return;
    }
    setBuying(item.wishlistItemId);
    try {
      const id = await cart.buyNow(product);
      if (id) router.push(`/checkout?buy=${id}`);
    } finally {
      setBuying(null);
    }
  };

  if (wishlist.items.length === 0) {
    return (
      <View style={[styles.screen, styles.empty]}>
        <Ionicons name="heart-outline" size={60} color={colors.card.border} />
        <Text style={styles.emptyTitle}>No saved items yet</Text>
        <Text style={styles.emptySub}>Tap the heart on any product to save it here.</Text>
        <Pressable style={styles.shopBtn} onPress={() => router.push('/')}>
          <Text style={styles.shopText}>Explore products</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <FlatList
      style={styles.screen}
      data={wishlist.items}
      keyExtractor={(i) => i.wishlistItemId}
      contentContainerStyle={styles.list}
      showsVerticalScrollIndicator={false}
      renderItem={({ item }) => {
        const image = images[item.productId] || undefined;
        const product = cartProductOf(item, image);
        return (
          <Pressable
            style={({ pressed }) => [styles.card, pressed && item.productSlug && styles.pressed]}
            onPress={() => open(item)}
          >
            <View style={styles.top}>
              <ProductImage src={image} style={styles.thumb} icon={22} />
              <View style={styles.info}>
                <Text numberOfLines={2} style={styles.title}>
                  {item.title ?? 'Product'}
                </Text>
                {item.sellingPrice && item.mrp ? (
                  <Price mrp={item.mrp} price={item.sellingPrice} size="sm" />
                ) : null}
                {!item.available ? (
                  <Text style={styles.unavailable}>No longer available</Text>
                ) : null}
              </View>
              <Pressable
                onPress={() => remove(item.wishlistItemId)}
                hitSlop={10}
                accessibilityLabel="Remove from wishlist"
              >
                <Ionicons name="trash-outline" size={19} color={colors.cart.danger} />
              </Pressable>
            </View>
            {product ? (
              <View style={styles.actions}>
                <CartStepper product={product} style={styles.action} />
                <Pressable
                  style={({ pressed }) => [
                    styles.action,
                    styles.buyBtn,
                    pressed && styles.buyPressed,
                  ]}
                  disabled={buying !== null}
                  onPress={() => void buyNow(item, product)}
                >
                  {buying === item.wishlistItemId ? (
                    <ActivityIndicator size="small" color={colors.brand.DEFAULT} />
                  ) : (
                    <>
                      <Ionicons name="flash" size={15} color={colors.brand.DEFAULT} />
                      <Text style={styles.buyText}>Buy now</Text>
                    </>
                  )}
                </Pressable>
              </View>
            ) : null}
          </Pressable>
        );
      }}
    />
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.page },
  empty: { alignItems: 'center', justifyContent: 'center', gap: space.md, padding: space.xl },
  emptyTitle: { fontFamily: font.uiBold, fontSize: 18, color: colors.text.strong },
  emptySub: {
    fontFamily: font.body,
    fontSize: 13.5,
    color: colors.text.body,
    textAlign: 'center',
    maxWidth: 280,
  },
  shopBtn: {
    marginTop: space.sm,
    backgroundColor: colors.brand.DEFAULT,
    borderRadius: radii.pill,
    paddingHorizontal: 24,
    paddingVertical: 11,
  },
  shopText: { fontFamily: font.uiSemibold, fontSize: 15, color: colors.white },
  list: { padding: space.lg, gap: space.md },
  card: {
    backgroundColor: colors.white,
    borderRadius: radii.tile,
    borderWidth: 1,
    borderColor: colors.card.border,
    padding: space.md,
    gap: space.md,
  },
  pressed: { opacity: 0.85 },
  top: { flexDirection: 'row', gap: space.md },
  thumb: { width: 76, height: 76, borderRadius: 8 },
  info: { flex: 1, gap: 4 },
  title: { fontFamily: font.uiMedium, fontSize: 14, color: colors.text.strong },
  unavailable: { fontFamily: font.body, fontSize: 12, color: colors.cart.danger },
  actions: { flexDirection: 'row', gap: space.sm },
  action: { flex: 1, minHeight: 40 },
  buyBtn: {
    flexDirection: 'row',
    gap: 6,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.white,
    borderWidth: 1.5,
    borderColor: colors.brand.DEFAULT,
    borderRadius: radii.button,
  },
  buyPressed: { opacity: 0.85 },
  buyText: { fontFamily: font.uiSemibold, fontSize: 14, color: colors.brand.DEFAULT },
});
