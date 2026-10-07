import { Image } from 'expo-image';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SEARCH_PLACEHOLDER } from '@youmart/shared-client';
import { colors, font, radii, space } from '@/theme';
import { useCart } from '@/stores/cart';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const LOGO = require('../../assets/images/logo.png');

/** App header for the tab screens: the real YouMart logo, a search entry, and a cart icon. */
export function AppHeader() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { itemCount } = useCart();

  return (
    <View style={[styles.wrap, { paddingTop: insets.top + 6 }]}>
      <View style={styles.row}>
        <Image source={LOGO} style={styles.logo} contentFit="contain" />
        <Pressable style={styles.cart} onPress={() => router.push('/cart')} hitSlop={8}>
          <Ionicons name="cart-outline" size={25} color={colors.brand.DEFAULT} />
          {itemCount > 0 ? (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{itemCount > 99 ? '99+' : itemCount}</Text>
            </View>
          ) : null}
        </Pressable>
      </View>
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
  logo: { width: 122, height: 44 },
  cart: { padding: 4 },
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
