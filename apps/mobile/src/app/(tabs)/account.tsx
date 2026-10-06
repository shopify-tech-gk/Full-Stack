import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useWishlist } from '@/stores/wishlist';
import { useCart } from '@/stores/cart';
import { colors, font, radii, space } from '@/theme';

export default function AccountScreen() {
  const insets = useSafeAreaInsets();
  const { count } = useWishlist();
  const { itemCount } = useCart();

  return (
    <View style={[styles.screen, { paddingTop: insets.top + space.lg }]}>
      <View style={styles.hero}>
        <View style={styles.avatar}>
          <Ionicons name="person" size={34} color={colors.white} />
        </View>
        <Text style={styles.name}>Guest</Text>
        <Text style={styles.sub}>
          Browse as a guest — your cart & wishlist are saved on this device.
        </Text>
      </View>

      <View style={styles.rows}>
        <Row icon="heart-outline" label="Wishlist" value={`${count} saved`} />
        <Row icon="cart-outline" label="Cart" value={`${itemCount} items`} />
        <Row icon="time-outline" label="Recently viewed" value="Synced on this device" />
      </View>

      <View style={styles.banner}>
        <Ionicons name="log-in-outline" size={22} color={colors.brand.DEFAULT} />
        <Text style={styles.bannerTitle}>Sign in — coming soon</Text>
        <Text style={styles.bannerText}>
          OTP login, real cart & checkout, orders, and syncing your guest data to your account
          arrive in the next update.
        </Text>
      </View>
    </View>
  );
}

function Row({
  icon,
  label,
  value,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
}) {
  return (
    <View style={styles.row}>
      <Ionicons name={icon} size={20} color={colors.brand.DEFAULT} />
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.page, padding: space.lg, gap: space.lg },
  hero: { alignItems: 'center', gap: 8, paddingVertical: space.lg },
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
  rows: {
    backgroundColor: colors.white,
    borderRadius: radii.tile,
    borderWidth: 1,
    borderColor: colors.card.border,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    padding: space.lg,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border.menu,
  },
  rowLabel: { flex: 1, fontFamily: font.uiMedium, fontSize: 14.5, color: colors.text.strong },
  rowValue: { fontFamily: font.body, fontSize: 13, color: colors.text.body },
  banner: {
    backgroundColor: colors.brandPopup.bg,
    borderRadius: radii.tile,
    borderWidth: 1,
    borderColor: colors.brandPopup.border,
    padding: space.lg,
    gap: 6,
  },
  bannerTitle: { fontFamily: font.uiSemibold, fontSize: 15, color: colors.brandPopup.title },
  bannerText: { fontFamily: font.body, fontSize: 13, color: colors.text.body, lineHeight: 19 },
});
