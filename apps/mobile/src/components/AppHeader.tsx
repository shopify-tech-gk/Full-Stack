import { Image } from 'expo-image';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SEARCH_PLACEHOLDER } from '@youmart/shared-client';
import { colors, font, radii, space } from '@/theme';
import { useCart } from '@/stores/cart';
import { DeliveryBar } from '@/components/DeliveryBar';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const LOGO = require('../../assets/images/logo.png');

/** App header for the tab screens: the real YouMart logo, Track Order + Customer Care quick tiles
 * (like youmartshop.com), a search entry, and a cart icon. */
export function AppHeader() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { itemCount } = useCart();

  return (
    <View style={[styles.wrap, { paddingTop: insets.top + 6 }]}>
      <View style={styles.row}>
        <Image source={LOGO} style={styles.logo} contentFit="contain" />
        <View style={styles.actions}>
          <Pressable style={styles.tile} onPress={() => router.push('/track-order')} hitSlop={6}>
            <Ionicons name="cube-outline" size={22} color={colors.brand.DEFAULT} />
            <Text style={styles.tileLabel}>Track{'\n'}Order</Text>
          </Pressable>
          <Pressable
            style={styles.tile}
            onPress={() => router.push('/info/customer-care')}
            hitSlop={6}
          >
            <Ionicons name="headset-outline" size={22} color={colors.brand.DEFAULT} />
            <Text style={styles.tileLabel}>Customer{'\n'}Care</Text>
          </Pressable>
          <Pressable style={styles.tile} onPress={() => router.push('/cart')} hitSlop={6}>
            <View style={styles.cartIconWrap}>
              <Ionicons name="cart-outline" size={22} color={colors.brand.DEFAULT} />
              {itemCount > 0 ? (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>{itemCount > 99 ? '99+' : itemCount}</Text>
                </View>
              ) : null}
            </View>
            <Text style={styles.tileLabel}>My{'\n'}Cart</Text>
          </Pressable>
        </View>
      </View>
      <DeliveryBar />
      <Pressable style={styles.search} onPress={() => router.push('/search')}>
        <Ionicons name="search" size={18} color={colors.text.placeholder} />
        <Text style={styles.searchText} numberOfLines={1}>
          {SEARCH_PLACEHOLDER}
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: colors.white,
    paddingHorizontal: space.lg,
    paddingBottom: space.md,
  },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  logo: { width: 112, height: 42 },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  tile: { alignItems: 'center', gap: 2, width: 52 },
  tileLabel: {
    fontFamily: font.uiSemibold,
    fontSize: 9.5,
    lineHeight: 11,
    color: colors.brand.DEFAULT,
    textAlign: 'center',
  },
  cartIconWrap: { width: 24, height: 24, alignItems: 'center', justifyContent: 'center' },
  badge: {
    position: 'absolute',
    top: -2,
    right: -4,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    paddingHorizontal: 4,
    backgroundColor: colors.price.discount,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: { fontFamily: font.uiBold, fontSize: 10, color: colors.white },
  search: {
    marginTop: space.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 2,
    borderColor: colors.brand.accent,
    borderRadius: radii.pill,
    paddingHorizontal: space.lg,
    height: 42,
  },
  searchText: {
    fontFamily: font.body,
    fontSize: 15,
    color: colors.text.placeholder,
    flexShrink: 1,
  },
});
