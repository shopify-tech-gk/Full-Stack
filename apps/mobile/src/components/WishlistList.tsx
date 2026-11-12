import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from '@/lib/router';
import {
  discountPercent,
  formatMoney,
  type CartProduct,
  type Money,
  type WishlistItem,
} from '@youmart/shared-client';
import { api } from '@/lib/api';
import { getJSON, setJSON } from '@/lib/storage';
import { useWishlist } from '@/stores/wishlist';
import { useCart } from '@/stores/cart';
import { useSession } from '@/stores/session';
import { CartStepper } from '@/components/CartStepper';
import { ProductImage } from '@/components/ui';
import { colors, font, radii, space } from '@/theme';

const GAP = 8;
const COLUMNS = 3;
// Same Buy colours as the product page's "Buy Now" (yellow, dark ink).
const BUY_YELLOW = '#ffd60a';
const BUY_INK = '#1f1300';

/** Set once the shopper ticks "Don't ask again" - removing then happens straight away. */
const SKIP_CONFIRM_KEY = 'ym.wishlist.skipRemoveConfirm';

const rupees = (m: Money) => formatMoney(m).replace(/\.00$/, '');

/** "Saved today" / "Saved 3 days ago" / "Saved 12 Oct". */
function savedWhen(iso: string): string {
  const then = new Date(iso);
  const days = Math.floor((Date.now() - then.getTime()) / 86_400_000);
  if (Number.isNaN(days)) return 'Saved';
  if (days <= 0) return 'Saved today';
  if (days === 1) return 'Saved yesterday';
  if (days < 7) return `Saved ${days} days ago`;
  return `Saved ${then.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}`;
}

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
 * The saved items, shared by the Favourites tab and the /wishlist stack screen: a 3-column grid of
 * its own "saved" cards (not the home product card) - photo on a soft panel with the discount and
 * a remove button, name, price, when it was saved, and Add | Buy now joined along the bottom edge.
 */
export function WishlistList() {
  const router = useRouter();
  const session = useSession();
  const cart = useCart();
  const { width } = useWindowDimensions();
  const { wishlist, remove } = useWishlist();
  const [buying, setBuying] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<WishlistItem | null>(null);
  const [skipConfirm, setSkipConfirm] = useState(false);
  useEffect(() => {
    void getJSON<boolean>(SKIP_CONFIRM_KEY).then((v) => setSkipConfirm(v === true));
  }, []);

  // ✕ / Remove: ask first, unless they've chosen "Don't ask again".
  const askRemove = (item: WishlistItem) => {
    if (skipConfirm) remove(item.wishlistItemId);
    else setConfirming(item);
  };
  const confirmRemove = (dontAsk: boolean) => {
    if (confirming) remove(confirming.wishlistItemId);
    if (dontAsk) {
      setSkipConfirm(true);
      void setJSON(SKIP_CONFIRM_KEY, true);
    }
    setConfirming(null);
  };
  const cardWidth = (width - space.md * 2 - GAP * (COLUMNS - 1)) / COLUMNS;

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

  const buyNow = async (item: WishlistItem, product: CartProduct) => {
    if (session.status !== 'authenticated') {
      router.push('/auth/login');
      return;
    }
    setBuying(item.wishlistItemId);
    try {
      // `temp`: taken back out of the cart if they leave checkout without ordering.
      const inCart = cart.cart.items.some((l) => l.skuId === product.skuId);
      const id = await cart.buyNow(product);
      if (id) router.push(`/checkout?buy=${id}${inCart ? '' : '&temp=1'}`);
    } finally {
      setBuying(null);
    }
  };

  if (wishlist.items.length === 0) {
    return (
      <View style={[styles.screen, styles.empty]}>
        <View style={styles.emptyIcon}>
          <Ionicons name="bookmark-outline" size={34} color={colors.brand.DEFAULT} />
        </View>
        <Text style={styles.emptyTitle}>No saved items yet</Text>
        <Text style={styles.emptySub}>Tap the bookmark on any product to save it here.</Text>
        <Pressable style={styles.shopBtn} onPress={() => router.push('/')}>
          <Text style={styles.shopText}>Explore products</Text>
        </Pressable>
      </View>
    );
  }

  const count = wishlist.items.length;
  return (
    <>
      <RemoveConfirm
        item={confirming}
        image={confirming ? images[confirming.productId] || undefined : undefined}
        onCancel={() => setConfirming(null)}
        onConfirm={confirmRemove}
      />
      <FlatList
        key={`cols-${COLUMNS}`}
        style={styles.screen}
        data={wishlist.items}
        keyExtractor={(i) => i.wishlistItemId}
        numColumns={COLUMNS}
        columnWrapperStyle={styles.row}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <View style={styles.header}>
            <View style={styles.headerIcon}>
              <Ionicons name="bookmark" size={13} color={colors.white} />
            </View>
            <Text style={styles.headerText}>
              {count} saved item{count === 1 ? '' : 's'}
            </Text>
          </View>
        }
        renderItem={({ item }) => {
          const image = images[item.productId] || undefined;
          const product = cartProductOf(item, image);
          const off =
            item.mrp && item.sellingPrice ? discountPercent(item.mrp, item.sellingPrice) : 0;
          return (
            <Pressable
              style={({ pressed }) => [
                styles.card,
                { width: cardWidth },
                pressed && item.productSlug && styles.pressed,
              ]}
              onPress={() => item.productSlug && router.push(`/product/${item.productSlug}`)}
            >
              <View style={styles.panel}>
                <ProductImage
                  src={image}
                  style={[styles.photo, !product && styles.photoOff]}
                  icon={26}
                />
                {off > 0 && product ? (
                  <View style={styles.offPill}>
                    <Text style={styles.offText}>{off}% OFF</Text>
                  </View>
                ) : null}
                <Pressable
                  style={({ pressed }) => [styles.remove, pressed && styles.pressed]}
                  onPress={() => askRemove(item)}
                  hitSlop={8}
                  accessibilityLabel="Remove from saved items"
                >
                  <Ionicons name="close" size={13} color={colors.text.strong} />
                </Pressable>
              </View>

              <View style={styles.body}>
                <Text numberOfLines={2} style={styles.title}>
                  {item.title ?? 'Product'}
                </Text>
                {product && item.sellingPrice ? (
                  <View style={styles.priceRow}>
                    <Text style={styles.price}>{rupees(item.sellingPrice)}</Text>
                    {off > 0 && item.mrp ? (
                      <Text style={styles.mrp}>{rupees(item.mrp)}</Text>
                    ) : null}
                  </View>
                ) : (
                  <Text style={styles.goneText}>No longer available</Text>
                )}
                <View style={styles.savedRow}>
                  <Ionicons name="time-outline" size={10} color={colors.text.muted} />
                  <Text style={styles.savedText}>{savedWhen(item.addedAt)}</Text>
                </View>
              </View>

              {product ? (
                <View style={styles.actions}>
                  <CartStepper product={product} compact dense style={styles.addSeg} />
                  <Pressable
                    style={({ pressed }) => [styles.buySeg, pressed && styles.pressed]}
                    disabled={buying !== null}
                    onPress={() => void buyNow(item, product)}
                  >
                    {buying === item.wishlistItemId ? (
                      <ActivityIndicator size="small" color={BUY_INK} />
                    ) : (
                      <>
                        <Ionicons name="bag-check" size={12} color={BUY_INK} />
                        <Text style={styles.buyText}>Buy now</Text>
                      </>
                    )}
                  </Pressable>
                </View>
              ) : (
                <Pressable
                  style={({ pressed }) => [styles.removeSeg, pressed && styles.pressed]}
                  onPress={() => askRemove(item)}
                >
                  <Ionicons name="trash-outline" size={13} color={colors.cart.danger} />
                  <Text style={styles.removeText}>Remove</Text>
                </Pressable>
              )}
            </Pressable>
          );
        }}
      />
    </>
  );
}

/** "Remove from favourites?" with a "Don't ask again" tick. */
function RemoveConfirm({
  item,
  image,
  onCancel,
  onConfirm,
}: {
  item: WishlistItem | null;
  image?: string;
  onCancel: () => void;
  onConfirm: (dontAsk: boolean) => void;
}) {
  const [dontAsk, setDontAsk] = useState(false);
  useEffect(() => {
    if (item) setDontAsk(false);
  }, [item]);
  return (
    <Modal visible={item !== null} transparent animationType="fade" onRequestClose={onCancel}>
      <Pressable style={styles.backdrop} onPress={onCancel}>
        <Pressable style={styles.dialog} onPress={() => {}}>
          <View style={styles.dialogTop}>
            <ProductImage src={image} style={styles.dialogThumb} icon={20} />
            <View style={{ flex: 1, gap: 3 }}>
              <Text style={styles.dialogTitle}>Remove from favourites?</Text>
              <Text numberOfLines={2} style={styles.dialogSub}>
                {item?.title ?? 'This product'}
              </Text>
            </View>
          </View>
          <Pressable
            style={styles.tickRow}
            onPress={() => setDontAsk((v) => !v)}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: dontAsk }}
          >
            <Ionicons
              name={dontAsk ? 'checkbox' : 'square-outline'}
              size={20}
              color={dontAsk ? colors.brand.DEFAULT : colors.text.muted}
            />
            <Text style={styles.tickText}>Don't ask me again</Text>
          </Pressable>
          <View style={styles.dialogBtns}>
            <Pressable
              style={({ pressed }) => [
                styles.dialogBtn,
                styles.cancelBtn,
                pressed && styles.pressed,
              ]}
              onPress={onCancel}
            >
              <Text style={styles.cancelText}>Cancel</Text>
            </Pressable>
            <Pressable
              style={({ pressed }) => [
                styles.dialogBtn,
                styles.removeBtn,
                pressed && styles.pressed,
              ]}
              onPress={() => onConfirm(dontAsk)}
            >
              <Ionicons name="trash-outline" size={15} color={colors.white} />
              <Text style={styles.removeBtnText}>Remove</Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.page },
  empty: { alignItems: 'center', justifyContent: 'center', gap: space.md, padding: space.xl },
  emptyIcon: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: colors.brandPopup.bg,
    alignItems: 'center',
    justifyContent: 'center',
  },
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
    borderRadius: radii.tile,
    paddingHorizontal: 24,
    paddingVertical: 11,
  },
  shopText: { fontFamily: font.uiSemibold, fontSize: 15, color: colors.white },
  list: { paddingHorizontal: space.md, paddingTop: space.sm, paddingBottom: space.lg, gap: GAP },
  row: { gap: GAP },
  header: { flexDirection: 'row', alignItems: 'center', gap: 7, paddingHorizontal: 2 },
  headerIcon: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: colors.brand.DEFAULT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerText: { fontFamily: font.uiBold, fontSize: 14, color: colors.heading },
  pressed: { opacity: 0.85 },
  card: {
    backgroundColor: colors.white,
    borderRadius: 12,
    overflow: 'hidden',
    shadowColor: '#0f2a5c',
    shadowOpacity: 0.08,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  // The photo covers the card's top, edge to edge.
  panel: { backgroundColor: colors.white },
  photo: { width: '100%', aspectRatio: 1, borderRadius: 0 },
  photoOff: { opacity: 0.4 },
  offPill: {
    position: 'absolute',
    left: 5,
    top: 5,
    backgroundColor: colors.price.discount,
    borderRadius: 5,
    paddingHorizontal: 4,
    paddingVertical: 1,
  },
  offText: { fontFamily: font.uiBold, fontSize: 9, color: colors.white },
  remove: {
    position: 'absolute',
    right: 5,
    top: 5,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'rgba(255,255,255,0.95)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
    elevation: 2,
  },
  body: { paddingHorizontal: 7, paddingTop: 6, paddingBottom: 7, gap: 2, flex: 1 },
  title: { fontFamily: font.uiMedium, fontSize: 11, lineHeight: 14.5, color: colors.text.strong },
  priceRow: { flexDirection: 'row', alignItems: 'baseline', flexWrap: 'wrap', columnGap: 4 },
  price: { fontFamily: font.uiBold, fontSize: 13, color: colors.text.strong },
  mrp: {
    fontFamily: font.body,
    fontSize: 10,
    color: colors.price.discount,
    textDecorationLine: 'line-through',
  },
  goneText: { fontFamily: font.uiSemibold, fontSize: 10.5, color: colors.cart.danger },
  savedRow: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  savedText: { fontFamily: font.body, fontSize: 9.5, color: colors.text.muted },
  // Add on top of Buy now, full width (three across leaves no room side by side).
  actions: { gap: 0 },
  addSeg: { minHeight: 28, borderRadius: 0 },
  buySeg: {
    height: 28,
    flexDirection: 'row',
    gap: 4,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: BUY_YELLOW,
  },
  buyText: { fontFamily: font.uiBold, fontSize: 11.5, color: BUY_INK },
  removeSeg: {
    height: 28,
    flexDirection: 'row',
    gap: 4,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff1f1',
  },
  removeText: { fontFamily: font.uiSemibold, fontSize: 11.5, color: colors.cart.danger },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(10,20,40,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: space.xl,
  },
  dialog: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: colors.white,
    borderRadius: 18,
    padding: space.lg,
    gap: space.md,
  },
  dialogTop: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  dialogThumb: { width: 56, height: 56, borderRadius: 10 },
  dialogTitle: { fontFamily: font.uiBold, fontSize: 16, color: colors.text.strong },
  dialogSub: { fontFamily: font.body, fontSize: 12.5, lineHeight: 17, color: colors.text.body },
  tickRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 2 },
  tickText: { fontFamily: font.uiMedium, fontSize: 13.5, color: colors.text.strong },
  dialogBtns: { flexDirection: 'row', gap: space.sm },
  dialogBtn: {
    flex: 1,
    flexDirection: 'row',
    gap: 6,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 42,
    borderRadius: radii.button,
  },
  cancelBtn: { borderWidth: 1.2, borderColor: colors.card.border },
  cancelText: { fontFamily: font.uiSemibold, fontSize: 14, color: colors.text.strong },
  removeBtn: { backgroundColor: colors.cart.danger },
  removeBtnText: { fontFamily: font.uiSemibold, fontSize: 14, color: colors.white },
});
