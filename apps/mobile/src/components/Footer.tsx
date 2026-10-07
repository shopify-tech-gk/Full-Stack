import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { BUSINESS } from '@youmart/shared-client';
import { colors, font, space } from '@/theme';

const QUICK_LINKS: { label: string; to: string }[] = [
  { label: 'Home', to: '/' },
  { label: 'About', to: '/info/about' },
  { label: 'Contact', to: '/info/contact' },
  { label: 'Track Order', to: '/track-order' },
  { label: 'FAQ', to: '/info/faq' },
];

/** Compact brand footer — mirrors the web mobile's blue footer (About + links + contact), as a
 * native block at the end of the home scroll. Navigation still uses the native tab bar. */
export function Footer() {
  const router = useRouter();
  return (
    <View style={styles.wrap}>
      <Text style={styles.brand}>
        You<Text style={styles.brandAccent}>Mart</Text>
      </Text>
      <Text style={styles.about}>
        Welcome to You Mart, your one-stop online shopping destination for everything you need.
      </Text>

      <Text style={styles.heading}>Quick Links</Text>
      <View style={styles.links}>
        {QUICK_LINKS.map((l) => (
          <Pressable key={l.label} onPress={() => router.push(l.to)}>
            <Text style={styles.link}>{l.label}</Text>
          </Pressable>
        ))}
      </View>

      <Text style={styles.heading}>Contact</Text>
      <Pressable onPress={() => Linking.openURL(`mailto:${BUSINESS.email}`)}>
        <Text style={styles.contact}>{BUSINESS.email}</Text>
      </Pressable>
      <Pressable onPress={() => Linking.openURL(BUSINESS.phoneHref)}>
        <Text style={styles.contact}>{BUSINESS.phone}</Text>
      </Pressable>
      <Text style={styles.address}>{BUSINESS.address}</Text>

      <Text style={styles.copy}>© 2026 · youmart.in</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: colors.brand.DEFAULT,
    paddingHorizontal: space.xl,
    paddingVertical: space.xxl,
    marginTop: space.xxl,
    gap: space.sm,
  },
  brand: { fontFamily: font.uiBold, fontSize: 26, color: colors.white },
  brandAccent: { color: colors.feature.expertise },
  about: { fontFamily: font.body, fontSize: 13, lineHeight: 20, color: '#e3eefc' },
  heading: {
    fontFamily: font.uiBold,
    fontSize: 13,
    color: colors.footer.heading,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: space.md,
  },
  links: { gap: 6 },
  link: { fontFamily: font.body, fontSize: 14, color: colors.white },
  contact: { fontFamily: font.body, fontSize: 14, color: colors.white },
  address: { fontFamily: font.body, fontSize: 13, lineHeight: 19, color: '#e3eefc' },
  copy: {
    fontFamily: font.body,
    fontSize: 12,
    color: colors.footer.icon,
    marginTop: space.lg,
    textAlign: 'center',
  },
});
