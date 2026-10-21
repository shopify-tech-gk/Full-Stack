import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Constants from 'expo-constants';
import * as ImagePicker from 'expo-image-picker';
import { authUserLabel, formatMoney, formatPhone } from '@youmart/shared-client';
import { api } from '@/lib/api';
import { logout, useSession } from '@/stores/session';
import { useAvatar } from '@/stores/profile';
import { Avatar } from '@/components/Avatar';
import { SwipeTabs } from '@/components/SwipeTabs';
import { colors, font, radii, space } from '@/theme';

type IconName = keyof typeof Ionicons.glyphMap;

/** Soft tinted chip colours for row icons (calm, on-brand). */
const TINT = {
  blue: { bg: '#e8f0fe', fg: colors.brand.DEFAULT },
  green: { bg: '#e7f6ee', fg: '#1e8e4f' },
  amber: { bg: '#fff4e0', fg: '#c77700' },
  rose: { bg: '#fdecef', fg: '#d6335b' },
  violet: { bg: '#f1ebfd', fg: '#6d3fd0' },
  teal: { bg: '#e3f6f6', fg: '#13878a' },
  slate: { bg: '#eef1f5', fg: '#4a5568' },
} as const;
type Tint = keyof typeof TINT;

interface Item {
  icon: IconName;
  label: string;
  tint: Tint;
  to: string;
  auth?: boolean;
}

const ACTIVITY: Item[] = [
  { icon: 'navigate', label: 'Track an order', tint: 'blue', to: '/track-order' },
  { icon: 'location', label: 'Saved addresses', tint: 'teal', to: '/addresses', auth: true },
  { icon: 'cart', label: 'My cart', tint: 'amber', to: '/cart' },
  // v1.15: the inbox (also the bell in the header).
  { icon: 'notifications', label: 'Notifications', tint: 'blue', to: '/inbox', auth: true },
  {
    icon: 'return-down-back',
    label: 'Returns & refunds',
    tint: 'green',
    to: '/returns',
    auth: true,
  },
  { icon: 'time', label: 'Recently viewed', tint: 'violet', to: '/account/recently-viewed' },
  { icon: 'star', label: 'My reviews', tint: 'amber', to: '/account/reviews', auth: true },
];

const SETTINGS: Item[] = [
  { icon: 'person', label: 'Account details', tint: 'violet', to: '/account/details', auth: true },
  {
    icon: 'notifications',
    label: 'Notification settings',
    tint: 'amber',
    to: '/account/notifications',
    auth: true,
  },
  {
    icon: 'shield-checkmark',
    label: 'Privacy & account',
    tint: 'green',
    to: '/account/privacy',
    auth: true,
  },
];

const INFO: Item[] = [
  { icon: 'information-circle', label: 'About YouMart', tint: 'blue', to: '/info/about' },
  { icon: 'call', label: 'Contact us', tint: 'teal', to: '/info/contact' },
  { icon: 'headset', label: 'Customer care', tint: 'violet', to: '/info/customer-care' },
  { icon: 'help-circle', label: 'FAQ', tint: 'amber', to: '/info/faq' },
  { icon: 'cube', label: 'Shipping details', tint: 'slate', to: '/info/shipping' },
  { icon: 'refresh', label: 'Refund policy', tint: 'green', to: '/info/refund-policy' },
  { icon: 'document-text', label: 'Terms & conditions', tint: 'slate', to: '/info/terms' },
  { icon: 'lock-closed', label: 'Privacy policy', tint: 'rose', to: '/info/privacy-policy' },
];

const QUICK: (Item & { sub: string })[] = [
  {
    icon: 'bag-handle',
    label: 'Orders',
    sub: 'Track & manage',
    tint: 'blue',
    to: '/orders',
    auth: true,
  },
  { icon: 'bookmark', label: 'Favourites', sub: 'Saved items', tint: 'rose', to: '/wishlist' },
  // v1.13: Orders · Wishlist · Coupons · Help (Returns moved to the list below).
  { icon: 'pricetags', label: 'Coupons', sub: 'Offers for you', tint: 'green', to: '/coupons' },
  { icon: 'help-buoy', label: 'Help', sub: '24×7 support', tint: 'violet', to: '/help' },
];

export default function AccountScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const session = useSession();
  const { uri, saving, setAvatar, removeAvatar } = useAvatar();

  const loggedIn = session.status === 'authenticated';
  const user = loggedIn ? session.user : null;
  const label = user ? authUserLabel(user) : 'Hello, Guest';
  const [walletBalance, setWalletBalance] = useState<string | null>(null);

  // W9: the wallet balance on the wallet card, refreshed whenever the tab is shown.
  useFocusEffect(
    useCallback(() => {
      if (!loggedIn) {
        setWalletBalance(null);
        return;
      }
      api.wallet
        .get()
        .then((w) => setWalletBalance(w.balance))
        .catch(() => setWalletBalance(null));
    }, [loggedIn]),
  );

  const go = (item: { to: string; auth?: boolean }) =>
    router.push(item.auth && !loggedIn ? '/auth/login' : item.to);

  const pickPhoto = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return;
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.9,
    });
    if (!res.canceled && res.assets[0]) await setAvatar(res.assets[0].uri);
  };

  const onAvatar = () => {
    if (!loggedIn) {
      router.push('/auth/login');
      return;
    }
    if (!uri) {
      void pickPhoto();
      return;
    }
    Alert.alert('Profile photo', undefined, [
      { text: 'Change photo', onPress: () => void pickPhoto() },
      { text: 'Remove photo', style: 'destructive', onPress: () => void removeAvatar() },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const confirmLogout = () =>
    Alert.alert('Log out?', 'You can sign in again anytime with your mobile number or email.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Log out', style: 'destructive', onPress: () => void logout() },
    ]);

  const contact = user?.phone ? formatPhone(user.phone) : (user?.email ?? null);
  const version = Constants.expoConfig?.version ?? '1.0.0';

  return (
    <SwipeTabs index={3}>
      <ScrollView
        style={styles.screen}
        contentContainerStyle={{ paddingBottom: insets.bottom + space.xxl }}
        showsVerticalScrollIndicator={false}
      >
        {/* Brand header */}
        <View style={[styles.header, { paddingTop: insets.top + space.lg }]}>
          <View style={styles.headerBlobA} />
          <View style={styles.headerBlobB} />
          <View style={styles.profileRow}>
            <Pressable onPress={onAvatar} disabled={saving} style={styles.avatarWrap}>
              {loggedIn ? (
                <Avatar name={label} uri={uri} size={68} />
              ) : (
                <View style={styles.guestAvatar}>
                  <Ionicons name="person" size={34} color={colors.brand.DEFAULT} />
                </View>
              )}
              {saving ? (
                <View style={styles.avatarBusy}>
                  <ActivityIndicator color={colors.white} />
                </View>
              ) : null}
              {loggedIn ? (
                <View style={styles.avatarEdit}>
                  <Ionicons name="camera" size={12} color={colors.brand.DEFAULT} />
                </View>
              ) : null}
            </Pressable>
            <View style={styles.profileText}>
              <Text style={styles.name} numberOfLines={1}>
                {label}
              </Text>
              <Text style={styles.contact} numberOfLines={1}>
                {loggedIn ? contact : 'Sign in to see orders, wallet & more'}
              </Text>
            </View>
            {loggedIn ? (
              <Pressable style={styles.editPill} onPress={() => router.push('/account/details')}>
                <Ionicons name="create-outline" size={14} color={colors.white} />
                <Text style={styles.editText}>Edit</Text>
              </Pressable>
            ) : null}
          </View>
        </View>

        {/* Wallet / sign-in card (floats over the header) */}
        <View style={styles.floatWrap}>
          {loggedIn ? (
            <Pressable style={styles.walletCard} onPress={() => router.push('/wallet')}>
              <View style={styles.walletIcon}>
                <Ionicons name="wallet" size={22} color={colors.white} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.walletLabel}>YouMart Wallet</Text>
                <Text style={styles.walletBalance}>
                  {walletBalance ? formatMoney(walletBalance) : '—'}
                </Text>
              </View>
              <Pressable
                style={styles.addMoney}
                onPress={() => router.push('/wallet/add')}
                hitSlop={6}
              >
                <Ionicons name="add" size={16} color={colors.brand.DEFAULT} />
                <Text style={styles.addMoneyText}>Add money</Text>
              </Pressable>
            </Pressable>
          ) : (
            <View style={styles.signInCard}>
              <Text style={styles.signInTitle}>Welcome to YouMart</Text>
              <Text style={styles.signInSub}>
                Sign in for order tracking, instant wallet refunds and faster checkout.
              </Text>
              <Pressable style={styles.signInBtn} onPress={() => router.push('/auth/login')}>
                <Text style={styles.signInBtnText}>Sign in / Sign up</Text>
                <Ionicons name="arrow-forward" size={16} color={colors.white} />
              </Pressable>
            </View>
          )}
        </View>

        {/* Quick tiles */}
        <View style={styles.quickGrid}>
          {QUICK.map((q) => (
            <Pressable
              key={q.label}
              style={({ pressed }) => [styles.quick, pressed && styles.pressedCard]}
              onPress={() => go(q)}
            >
              <View style={[styles.quickIcon, { backgroundColor: TINT[q.tint].bg }]}>
                <Ionicons name={q.icon} size={22} color={TINT[q.tint].fg} />
              </View>
              <Text style={styles.quickLabel}>{q.label}</Text>
              <Text style={styles.quickSub} numberOfLines={1}>
                {q.sub}
              </Text>
            </Pressable>
          ))}
        </View>

        <Section title="My activity" items={ACTIVITY} onPress={go} />
        {loggedIn ? <Section title="Settings" items={SETTINGS} onPress={go} /> : null}
        <Section title="Help & information" items={INFO} onPress={go} />

        {loggedIn ? (
          <Pressable
            style={({ pressed }) => [styles.logout, pressed && styles.pressedCard]}
            onPress={confirmLogout}
          >
            <Ionicons name="log-out-outline" size={20} color={colors.price.discount} />
            <Text style={styles.logoutText}>Log out</Text>
          </Pressable>
        ) : null}

        <Text style={styles.footer}>YouMart · Shop Easy, Live Better · v{version}</Text>
      </ScrollView>
    </SwipeTabs>
  );
}

function Section({
  title,
  items,
  onPress,
}: {
  title: string;
  items: Item[];
  onPress: (item: Item) => void;
}) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.card}>
        {items.map((item, i) => (
          <Pressable
            key={item.label}
            style={({ pressed }) => [
              styles.row,
              i < items.length - 1 && styles.rowBorder,
              pressed && styles.pressedRow,
            ]}
            onPress={() => onPress(item)}
          >
            <View style={[styles.rowIcon, { backgroundColor: TINT[item.tint].bg }]}>
              <Ionicons name={item.icon} size={18} color={TINT[item.tint].fg} />
            </View>
            <Text style={styles.rowLabel}>{item.label}</Text>
            <Ionicons name="chevron-forward" size={18} color={colors.text.chevron} />
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.page },
  header: {
    backgroundColor: colors.brand.DEFAULT,
    paddingHorizontal: space.lg,
    paddingBottom: 64,
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
    overflow: 'hidden',
  },
  headerBlobA: {
    position: 'absolute',
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: 'rgba(255,255,255,0.07)',
    top: -90,
    right: -60,
  },
  headerBlobB: {
    position: 'absolute',
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: 'rgba(255,255,255,0.06)',
    bottom: -50,
    left: -40,
  },
  profileRow: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  avatarWrap: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.85)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  guestAvatar: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarBusy: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 36,
    backgroundColor: 'rgba(1,66,170,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarEdit: {
    position: 'absolute',
    right: -2,
    bottom: -2,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileText: { flex: 1, gap: 3 },
  name: { fontFamily: font.uiBold, fontSize: 20, color: colors.white },
  contact: { fontFamily: font.body, fontSize: 13, color: '#d6e3ff' },
  editPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.6)',
    borderRadius: radii.pill,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  editText: { fontFamily: font.uiSemibold, fontSize: 12.5, color: colors.white },
  floatWrap: { paddingHorizontal: space.lg, marginTop: -44 },
  walletCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    backgroundColor: colors.white,
    borderRadius: 20,
    padding: space.lg,
    shadowColor: colors.brand.DEFAULT,
    shadowOpacity: 0.16,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
  },
  walletIcon: {
    width: 46,
    height: 46,
    borderRadius: 14,
    backgroundColor: colors.brand.DEFAULT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  walletLabel: { fontFamily: font.uiMedium, fontSize: 12.5, color: colors.text.muted },
  walletBalance: { fontFamily: font.uiBold, fontSize: 22, color: colors.text.strong, marginTop: 1 },
  addMoney: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: colors.brandPopup.bg,
    borderRadius: radii.pill,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  addMoneyText: { fontFamily: font.uiSemibold, fontSize: 12.5, color: colors.brand.DEFAULT },
  signInCard: {
    backgroundColor: colors.white,
    borderRadius: 20,
    padding: space.lg,
    gap: 6,
    shadowColor: colors.brand.DEFAULT,
    shadowOpacity: 0.16,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
  },
  signInTitle: { fontFamily: font.uiBold, fontSize: 17, color: colors.text.strong },
  signInSub: { fontFamily: font.body, fontSize: 13, lineHeight: 19, color: colors.text.body },
  signInBtn: {
    marginTop: space.sm,
    flexDirection: 'row',
    gap: 6,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.brand.DEFAULT,
    borderRadius: radii.pill,
    paddingVertical: 12,
  },
  signInBtnText: { fontFamily: font.uiSemibold, fontSize: 15, color: colors.white },
  quickGrid: {
    flexDirection: 'row',
    gap: space.sm,
    paddingHorizontal: space.lg,
    marginTop: space.lg,
  },
  quick: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: colors.white,
    borderRadius: 18,
    paddingVertical: space.md,
    paddingHorizontal: 4,
    gap: 4,
    shadowColor: colors.brand.DEFAULT,
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  quickIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
  },
  quickLabel: { fontFamily: font.uiSemibold, fontSize: 13, color: colors.text.strong },
  quickSub: { fontFamily: font.body, fontSize: 10.5, color: colors.text.muted },
  pressedCard: { opacity: 0.85, transform: [{ scale: 0.98 }] },
  section: { paddingHorizontal: space.lg, marginTop: space.xl, gap: space.sm },
  sectionTitle: {
    fontFamily: font.uiBold,
    fontSize: 13,
    color: colors.text.muted,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginLeft: 4,
  },
  card: {
    backgroundColor: colors.white,
    borderRadius: 18,
    overflow: 'hidden',
    shadowColor: colors.brand.DEFAULT,
    shadowOpacity: 0.05,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 1,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingHorizontal: space.lg,
    paddingVertical: 13,
  },
  rowBorder: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border.menu },
  pressedRow: { backgroundColor: colors.page },
  rowIcon: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowLabel: { flex: 1, fontFamily: font.uiMedium, fontSize: 14.5, color: colors.text.strong },
  logout: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: space.lg,
    marginTop: space.xl,
    borderWidth: 1.5,
    borderColor: '#f3c4cf',
    backgroundColor: colors.white,
    borderRadius: 18,
    paddingVertical: 14,
  },
  logoutText: { fontFamily: font.uiSemibold, fontSize: 15, color: colors.price.discount },
  footer: {
    fontFamily: font.body,
    fontSize: 12,
    color: colors.text.muted,
    textAlign: 'center',
    marginTop: space.xl,
  },
});
