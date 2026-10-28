import { Image } from 'expo-image';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { BUSINESS } from '@youmart/shared-client';
import { colors, font, space } from '@/theme';

/* eslint-disable @typescript-eslint/no-require-imports */
const LOGO = require('../../assets/images/logo.png');
/* eslint-enable @typescript-eslint/no-require-imports */

// v1.17 Home footer: the YouMart logo on a white card (the logo is blue + yellow, so it needs a
// light ground) over a deep navy panel, our promises, quick links as icon tiles, tappable contact
// rows (mail, call, WhatsApp, map) and the copyright line.

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
  const contacts: { icon: IconName; label: string; value: string; href: string }[] = [
    { icon: 'mail', label: 'Email us', value: BUSINESS.email, href: `mailto:${BUSINESS.email}` },
    { icon: 'call', label: 'Call us', value: BUSINESS.phone, href: BUSINESS.phoneHref },
    {
      icon: 'logo-whatsapp',
      label: 'WhatsApp',
      value: BUSINESS.whatsapp,
      href: BUSINESS.whatsappHref,
    },
    { icon: 'location', label: 'Visit us', value: BUSINESS.address, href: BUSINESS.mapsHref },
  ];

  return (
    <View style={styles.wrap}>
      {/* Decorative glows */}
      <View style={[styles.glow, styles.glowA]} pointerEvents="none" />
      <View style={[styles.glow, styles.glowB]} pointerEvents="none" />

      <View style={styles.logoCard}>
        <Image
          source={LOGO}
          style={styles.logo}
          contentFit="contain"
          accessibilityLabel="YouMart"
        />
      </View>
      <Text style={styles.tagline}>Shop easy, live better</Text>
      <Text style={styles.about}>
        Your one-stop online shopping destination - everything you need, delivered to your door.
      </Text>

      <View style={styles.promises}>
        {PROMISES.map((p) => (
          <View key={p.label} style={styles.promise}>
            <View style={styles.promiseIcon}>
              <Ionicons name={p.icon} size={18} color={YELLOW} />
            </View>
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
            <Ionicons name={l.icon} size={17} color={colors.white} />
            <Text style={styles.linkText} numberOfLines={1}>
              {l.label}
            </Text>
          </Pressable>
        ))}
      </View>

      <Text style={styles.heading}>Get in touch</Text>
      <View style={styles.contacts}>
        {contacts.map((c, i) => (
          <Pressable
            key={c.label}
            onPress={() => void Linking.openURL(c.href)}
            style={({ pressed }) => [
              styles.contact,
              i < contacts.length - 1 && styles.contactRule,
              pressed && styles.pressed,
            ]}
          >
            <View style={styles.contactIcon}>
              <Ionicons name={c.icon} size={16} color={NAVY} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.contactLabel}>{c.label}</Text>
              <Text style={styles.contactValue}>{c.value}</Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color="rgba(255,255,255,0.5)" />
          </Pressable>
        ))}
      </View>

      <View style={styles.bottom}>
        <Text style={styles.copy}>© 2026 YouMart · youmart.in</Text>
        <Text style={styles.made}>Made in India 🇮🇳</Text>
      </View>
    </View>
  );
}

const NAVY = '#0b1f4d';
const YELLOW = '#ffd23f';

const styles = StyleSheet.create({
  wrap: {
    marginTop: space.xxl,
    paddingHorizontal: space.xl,
    paddingTop: space.xxl,
    paddingBottom: space.xl,
    gap: space.sm,
    overflow: 'hidden',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    backgroundColor: NAVY,
    experimental_backgroundImage: 'linear-gradient(170deg, #0b1f4d 0%, #0a2a6e 55%, #0142aa 100%)',
  },
  glow: { position: 'absolute', borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.06)' },
  glowA: { width: 260, height: 260, top: -120, right: -90 },
  glowB: { width: 200, height: 200, bottom: 120, left: -110 },
  logoCard: {
    alignSelf: 'flex-start',
    backgroundColor: colors.white,
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingVertical: 10,
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
  logo: { width: 168, height: 64 },
  tagline: {
    fontFamily: font.uiBold,
    fontSize: 17,
    color: YELLOW,
    marginTop: space.md,
  },
  about: { fontFamily: font.body, fontSize: 13, lineHeight: 20, color: 'rgba(255,255,255,0.78)' },
  promises: {
    flexDirection: 'row',
    gap: 8,
    marginTop: space.lg,
  },
  promise: {
    flex: 1,
    alignItems: 'center',
    gap: 6,
    paddingVertical: 12,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  promiseIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(255,210,63,0.14)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  promiseText: {
    fontFamily: font.uiSemibold,
    fontSize: 10.5,
    lineHeight: 13,
    color: colors.white,
    textAlign: 'center',
  },
  heading: {
    fontFamily: font.uiBold,
    fontSize: 12,
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: 'rgba(255,255,255,0.6)',
    marginTop: space.xl,
    marginBottom: 2,
  },
  links: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  link: {
    width: '48.5%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 11,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  linkText: { flex: 1, fontFamily: font.uiSemibold, fontSize: 13.5, color: colors.white },
  pressed: { opacity: 0.7 },
  contacts: {
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    paddingHorizontal: 12,
  },
  contact: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12 },
  contactRule: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.15)',
  },
  contactIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: YELLOW,
    alignItems: 'center',
    justifyContent: 'center',
  },
  contactLabel: { fontFamily: font.uiMedium, fontSize: 11, color: 'rgba(255,255,255,0.6)' },
  contactValue: {
    fontFamily: font.uiSemibold,
    fontSize: 13.5,
    lineHeight: 19,
    color: colors.white,
  },
  bottom: {
    marginTop: space.xl,
    paddingTop: space.lg,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    gap: 4,
  },
  copy: { fontFamily: font.uiMedium, fontSize: 12, color: 'rgba(255,255,255,0.7)' },
  made: { fontFamily: font.uiMedium, fontSize: 11.5, color: 'rgba(255,255,255,0.55)' },
});
