import { ScrollView, StyleSheet, Text, View, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { authUserLabel } from '@youmart/shared-client';
import { logout, useSession } from '@/stores/session';
import { useWishlist } from '@/stores/wishlist';
import { useCart } from '@/stores/cart';
import { colors, font, radii, space } from '@/theme';

const INFO_LINKS: { page: string; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { page: 'about', label: 'About YouMart', icon: 'information-circle-outline' },
  { page: 'contact', label: 'Contact us', icon: 'call-outline' },
  { page: 'customer-care', label: 'Customer care', icon: 'headset-outline' },
  { page: 'faq', label: 'FAQ', icon: 'help-circle-outline' },
  { page: 'shipping', label: 'Shipping details', icon: 'cube-outline' },
  { page: 'refund-policy', label: 'Refund policy', icon: 'refresh-outline' },
  { page: 'terms', label: 'Terms & conditions', icon: 'document-text-outline' },
  { page: 'privacy-policy', label: 'Privacy policy', icon: 'lock-closed-outline' },
];

export default function AccountScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const session = useSession();
  const { count } = useWishlist();
  const { itemCount } = useCart();

  const loggedIn = session.status === 'authenticated';

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={[styles.body, { paddingTop: insets.top + space.lg }]}
    >
      <View style={styles.hero}>
        <View style={styles.avatar}>
          <Ionicons name="person" size={34} color={colors.white} />
        </View>
        <Text style={styles.name}>{loggedIn ? authUserLabel(session.user) : 'Guest'}</Text>
        <Text style={styles.sub}>
          {loggedIn
            ? 'Welcome back to YouMart.'
            : 'Browse as a guest — your cart & wishlist are saved on this device.'}
        </Text>
      </View>

      {!loggedIn ? (
        <Pressable style={styles.loginBtn} onPress={() => router.push('/auth/login')}>
          <Ionicons name="log-in-outline" size={20} color={colors.white} />
          <Text style={styles.loginText}>Sign in / Sign up</Text>
        </Pressable>
      ) : null}

      <View style={styles.rows}>
        <Row
          icon="bag-handle-outline"
          label="My Orders"
          onPress={() => router.push(loggedIn ? '/orders' : '/auth/login')}
        />
        <Row
          icon="location-outline"
          label="Addresses"
          onPress={() => router.push(loggedIn ? '/addresses' : '/auth/login')}
        />
        <Row
          icon="heart-outline"
          label="Wishlist"
          value={`${count}`}
          onPress={() => router.push('/wishlist')}
        />
        <Row
          icon="cart-outline"
          label="Cart"
          value={`${itemCount}`}
          onPress={() => router.push('/cart')}
        />
        <Row
          icon="navigate-outline"
          label="Track an order"
          onPress={() => router.push('/track-order')}
          last={!loggedIn}
        />
        {loggedIn ? (
          <Row
            icon="person-outline"
            label="Account details"
            onPress={() => router.push('/account/details')}
            last
          />
        ) : null}
      </View>

      <Text style={styles.sectionLabel}>Help &amp; information</Text>
      <View style={styles.rows}>
        {INFO_LINKS.map((link, i) => (
          <Row
            key={link.page}
            icon={link.icon}
            label={link.label}
            onPress={() => router.push(`/info/${link.page}`)}
            last={i === INFO_LINKS.length - 1}
          />
        ))}
      </View>

      {loggedIn ? (
        <Pressable style={styles.logout} onPress={() => void logout()}>
          <Ionicons name="log-out-outline" size={18} color={colors.price.discount} />
          <Text style={styles.logoutText}>Log out</Text>
        </Pressable>
      ) : null}
    </ScrollView>
  );
}

function Row({
  icon,
  label,
  value,
  onPress,
  last,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value?: string;
  onPress: () => void;
  last?: boolean;
}) {
  return (
    <Pressable
      style={({ pressed }) => [styles.row, !last && styles.rowBorder, pressed && styles.pressed]}
      onPress={onPress}
    >
      <Ionicons name={icon} size={20} color={colors.brand.DEFAULT} />
      <Text style={styles.rowLabel}>{label}</Text>
      {value ? <Text style={styles.rowValue}>{value}</Text> : null}
      <Ionicons name="chevron-forward" size={18} color={colors.text.chevron} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.page },
  body: { padding: space.lg, gap: space.lg },
  hero: { alignItems: 'center', gap: 8, paddingVertical: space.md },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.brand.DEFAULT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  name: { fontFamily: font.uiBold, fontSize: 20, color: colors.text.strong },
  sub: {
    fontFamily: font.body,
    fontSize: 13,
    color: colors.text.body,
    textAlign: 'center',
    maxWidth: 300,
  },
  loginBtn: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.brand.DEFAULT,
    borderRadius: radii.button,
    paddingVertical: 14,
  },
  loginText: { fontFamily: font.uiSemibold, fontSize: 16, color: colors.white },
  sectionLabel: {
    fontFamily: font.uiSemibold,
    fontSize: 13,
    color: colors.text.muted,
    marginTop: space.sm,
    marginLeft: 4,
  },
  rows: {
    backgroundColor: colors.white,
    borderRadius: radii.tile,
    borderWidth: 1,
    borderColor: colors.card.border,
    overflow: 'hidden',
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.lg },
  rowBorder: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border.menu },
  pressed: { backgroundColor: colors.page },
  rowLabel: { flex: 1, fontFamily: font.uiMedium, fontSize: 14.5, color: colors.text.strong },
  rowValue: { fontFamily: font.uiSemibold, fontSize: 13, color: colors.text.body },
  logout: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
  },
  logoutText: { fontFamily: font.uiSemibold, fontSize: 15, color: colors.price.discount },
});
