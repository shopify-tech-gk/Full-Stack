import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { BUSINESS } from '@youmart/shared-client';
import { colors, font, space } from '@/theme';

// v1.17 Home footer, kept compact: the YouMart wordmark on a navy-to-blue panel, our promises in
// one row, quick links as small chips, tappable contact rows (mail, call, WhatsApp, map) and the
// copyright line.

type IconName = keyof typeof Ionicons.glyphMap;

const PROMISES: { icon: IconName; label: string }[] = [
  { icon: 'shield-checkmark', label: 'Genuine\nproducts' },
  { icon: 'rocket', label: 'Fast\ndelivery' },
  { icon: 'sync', label: 'Easy\nreturns' },
  { icon: 'lock-closed', label: 'Secure\npayments' },
];

const QUICK_LINKS: { label: string; to: string; icon: IconName }[] = [
  { label: 'Home', to: '/', icon: 'home-outline' },
  { label: 'My Orders', to: '/orders', icon: 'bag-handle-outline' },
  { label: 'Track Order', to: '/track-order', icon: 'navigate-outline' },
  { label: 'Refer & Earn', to: '/refer', icon: 'gift-outline' },
  { label: 'About Us', to: '/info/about', icon: 'information-circle-outline' },
  { label: 'Contact Us', to: '/info/contact', icon: 'call-outline' },
  { label: 'FAQs', to: '/info/faq', icon: 'help-circle-outline' },
];

export function Footer() {
  const router = useRouter();
  const contacts: { icon: IconName; value: string; href: string }[] = [
    { icon: 'mail', value: BUSINESS.email, href: `mailto:${BUSINESS.email}` },
    { icon: 'call', value: BUSINESS.phone, href: BUSINESS.phoneHref },
    { icon: 'logo-whatsapp', value: BUSINESS.whatsapp, href: BUSINESS.whatsappHref },
    { icon: 'location', value: BUSINESS.address, href: BUSINESS.mapsHref },
  ];

  return (
    <View style={styles.wrap}>
      <View pointerEvents="none" style={styles.glow} />

      <Text style={styles.brand}>
        You<Text style={styles.brandAccent}>Mart</Text>
      </Text>
      <Text style={styles.about}>
        Shop easy, live better - everything you need, delivered to your door.
      </Text>

      <View style={styles.promises}>
        {PROMISES.map((p) => (
          <View key={p.label} style={styles.promise}>
            <Ionicons name={p.icon} size={15} color={YELLOW} />
            <Text style={styles.promiseText}>{p.label}</Text>
          </View>
        ))}
      </View>

      <Text style={styles.heading}>Quick links</Text>
      <View style={styles.links}>
        {QUICK_LINKS.map((l) => (
          <Pressable
            key={l.label}
            onPress={() => router.push(l.to)}
            style={({ pressed }) => [styles.link, pressed && styles.pressed]}
          >
            <Ionicons name={l.icon} size={14} color={colors.white} />
            <Text style={styles.linkText}>{l.label}</Text>
          </Pressable>
        ))}
      </View>

      <Text style={styles.heading}>Get in touch</Text>
      <View style={styles.contacts}>
        {contacts.map((c) => (
          <Pressable
            key={c.icon}
            onPress={() => void Linking.openURL(c.href)}
            style={({ pressed }) => [styles.contact, pressed && styles.pressed]}
          >
            <View style={styles.contactIcon}>
              <Ionicons name={c.icon} size={13} color={NAVY} />
            </View>
            <Text style={styles.contactValue} numberOfLines={2}>
              {c.value}
            </Text>
          </Pressable>
        ))}
      </View>

      <Text style={styles.copy}>© 2026 YouMart · youmart.in · Made in India 🇮🇳</Text>
    </View>
  );
}

const NAVY = '#0b1f4d';
const YELLOW = '#ffd23f';

const styles = StyleSheet.create({
  wrap: {
    marginTop: space.xl,
    paddingHorizontal: space.lg,
    paddingTop: space.lg,
    paddingBottom: space.md,
    gap: 6,
    overflow: 'hidden',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    backgroundColor: NAVY,
    experimental_backgroundImage: 'linear-gradient(170deg, #0b1f4d 0%, #0a2a6e 55%, #0142aa 100%)',
  },
  glow: {
    position: 'absolute',
    width: 200,
    height: 200,
    top: -100,
    right: -70,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  brand: { fontFamily: font.uiBold, fontSize: 24, color: colors.white },
  brandAccent: { color: YELLOW },
  about: { fontFamily: font.body, fontSize: 12.5, lineHeight: 18, color: 'rgba(255,255,255,0.78)' },
  promises: { flexDirection: 'row', gap: 6, marginTop: space.sm },
  promise: {
    flex: 1,
    alignItems: 'center',
    gap: 3,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  promiseText: {
    fontFamily: font.uiSemibold,
    fontSize: 10,
    lineHeight: 12,
    color: colors.white,
    textAlign: 'center',
  },
  heading: {
    fontFamily: font.uiBold,
    fontSize: 11,
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: 'rgba(255,255,255,0.6)',
    marginTop: space.md,
  },
  links: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  link: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  linkText: { fontFamily: font.uiSemibold, fontSize: 12.5, color: colors.white },
  pressed: { opacity: 0.7 },
  contacts: { gap: 8 },
  contact: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  contactIcon: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: YELLOW,
    alignItems: 'center',
    justifyContent: 'center',
  },
  contactValue: {
    flex: 1,
    fontFamily: font.uiMedium,
    fontSize: 12.5,
    lineHeight: 17,
    color: colors.white,
  },
  copy: {
    marginTop: space.md,
    paddingTop: space.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(255,255,255,0.18)',
    textAlign: 'center',
    fontFamily: font.uiMedium,
    fontSize: 11,
    color: 'rgba(255,255,255,0.6)',
  },
});
