import { ScrollView, StyleSheet, Text, View, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { authUserLabel } from '@youmart/shared-client';
import { logout, useSession } from '@/stores/session';
import { useWishlist } from '@/stores/wishlist';
import { useCart } from '@/stores/cart';
import { useAvatar } from '@/stores/profile';
import { Avatar } from '@/components/Avatar';
import { SwipeTabs } from '@/components/SwipeTabs';
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
  const { uri, setAvatar, removeAvatar } = useAvatar();

  const loggedIn = session.status === 'authenticated';
  const label = loggedIn ? authUserLabel(session.user) : 'Guest';
  const avatarName = loggedIn ? label : '';

  const pickPhoto = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return;
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
    });
    if (!res.canceled && res.assets[0]) await setAvatar(res.assets[0].uri);
  };

  return (
    <SwipeTabs index={3}>
      <ScrollView
        style={styles.screen}
        contentContainerStyle={[styles.body, { paddingTop: insets.top + space.lg }]}
      >
        <View style={styles.hero}>
          <Pressable style={styles.avatarWrap} onPress={pickPhoto}>
            <Avatar name={avatarName} uri={uri} size={88} />
            <View style={styles.avatarEdit}>
              <Ionicons name="camera" size={14} color={colors.white} />
            </View>
          </Pressable>
          <Text style={styles.name}>{label}</Text>
          <Text style={styles.sub}>
            {loggedIn
              ? 'Welcome back to YouMart.'
              : 'Browse as a guest — your cart & wishlist are saved on this device.'}
          </Text>
          <View style={styles.photoActions}>
            <Pressable onPress={pickPhoto} hitSlop={6}>
              <Text style={styles.photoLink}>{uri ? 'Change photo' : 'Add photo'}</Text>
            </Pressable>
            {uri ? (
              <>
                <Text style={styles.photoDot}>·</Text>
                <Pressable onPress={removeAvatar} hitSlop={6}>
                  <Text style={styles.photoRemove}>Remove</Text>
                </Pressable>
              </>
            ) : null}
          </View>
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
    </SwipeTabs>
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
  avatarWrap: {
    width: 88,
    height: 88,
    borderRadius: 44,
    borderWidth: 3,
    borderColor: colors.white,
    shadowColor: colors.brand.DEFAULT,
    shadowOpacity: 0.18,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 5 },
    elevation: 4,
  },
  avatarEdit: {
    position: 'absolute',
    right: -2,
    bottom: -2,
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: colors.brand.DEFAULT,
    borderWidth: 2.5,
    borderColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoActions: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 2 },
  photoLink: { fontFamily: font.uiSemibold, fontSize: 13, color: colors.brand.DEFAULT },
  photoDot: { fontFamily: font.uiBold, fontSize: 13, color: colors.text.muted },
  photoRemove: { fontFamily: font.uiSemibold, fontSize: 13, color: colors.price.discount },
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
