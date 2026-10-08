import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useWishlist } from '@/stores/wishlist';
import { useCart } from '@/stores/cart';
import { ProductImage, Price } from '@/components/ui';
import { colors, font, radii, space } from '@/theme';

/** The saved-items list, shared by the "Buy Again" tab and the /wishlist stack screen. */
export function WishlistList() {
  const router = useRouter();
  const { wishlist, remove } = useWishlist();
  const cart = useCart();

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
      renderItem={({ item }) => (
        <View style={styles.card}>
          <Pressable
            style={styles.left}
            onPress={() => item.productSlug && router.push(`/product/${item.productSlug}`)}
          >
            <ProductImage src={undefined} style={styles.thumb} icon={22} />
            <View style={styles.info}>
              <Text numberOfLines={2} style={styles.title}>
                {item.title ?? 'Product'}
              </Text>
              {item.sellingPrice && item.mrp ? (
                <Price mrp={item.mrp} price={item.sellingPrice} size="sm" />
              ) : null}
              {!item.available ? <Text style={styles.unavailable}>No longer available</Text> : null}
            </View>
          </Pressable>
          <View style={styles.actions}>
            <Pressable onPress={() => remove(item.wishlistItemId)} hitSlop={8}>
              <Ionicons name="trash-outline" size={18} color={colors.cart.danger} />
            </Pressable>
            {item.available && item.productSlug && item.sellingPrice ? (
              <Pressable
                style={styles.addBtn}
                onPress={() =>
                  cart.addItem({
                    skuId: item.skuId,
                    productId: item.productId,
                    productSlug: item.productSlug!,
                    title: item.title ?? 'Product',
                    price: item.sellingPrice!,
                  })
                }
              >
                <Ionicons name="cart-outline" size={14} color={colors.white} />
                <Text style={styles.addText}>Add</Text>
              </Pressable>
            ) : null}
          </View>
        </View>
      )}
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
    flexDirection: 'row',
    backgroundColor: colors.white,
    borderRadius: radii.tile,
    borderWidth: 1,
    borderColor: colors.card.border,
    padding: space.md,
    gap: space.md,
  },
  left: { flexDirection: 'row', gap: space.md, flex: 1 },
  thumb: { width: 64, height: 64, borderRadius: 8 },
  info: { flex: 1, gap: 4 },
  title: { fontFamily: font.uiMedium, fontSize: 13.5, color: colors.text.strong },
  unavailable: { fontFamily: font.body, fontSize: 12, color: colors.cart.danger },
  actions: { justifyContent: 'space-between', alignItems: 'flex-end' },
  addBtn: {
    flexDirection: 'row',
    gap: 5,
    alignItems: 'center',
    backgroundColor: colors.brand.DEFAULT,
    borderRadius: radii.button,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  addText: { fontFamily: font.uiSemibold, fontSize: 12.5, color: colors.white },
});
