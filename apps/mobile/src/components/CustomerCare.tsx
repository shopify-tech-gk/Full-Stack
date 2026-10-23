import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, type Href } from 'expo-router';
import * as Haptics from 'expo-haptics';
import Animated, { FadeInDown, ReduceMotion } from 'react-native-reanimated';
import { BUSINESS, CUSTOMER_CARE_PAGE } from '@youmart/shared-client';
import { colors, font, space } from '@/theme';

// v1.17 Customer Care: YouMart AI for instant answers, then WhatsApp / call / email with the real
// number and address shown, quick self-help links and the store address. Same contact details as
// our WhatsApp updates (MSG91 number) and our emails (the Zoho sender address).

const BRAND = colors.brand.DEFAULT;
const HERO = 'linear-gradient(145deg, #0b1b3f 0%, #0142aa 60%, #3b6fe0 100%)';
const AI = 'linear-gradient(135deg, #3b0a6b 0%, #7c3aed 55%, #2f6ae8 100%)';

const CONTACT: Record<
  (typeof CUSTOMER_CARE_PAGE.cards)[number]['id'],
  { icon: keyof typeof Ionicons.glyphMap; tint: string; detail: string; action: string }
> = {
  whatsapp: {
    icon: 'logo-whatsapp',
    tint: '#25D366',
    detail: BUSINESS.whatsapp,
    action: 'Chat on WhatsApp',
  },
  call: { icon: 'call', tint: BRAND, detail: BUSINESS.phone, action: 'Call now' },
  email: { icon: 'mail', tint: '#7c3aed', detail: BUSINESS.email, action: 'Write an email' },
};

const QUICK: { icon: keyof typeof Ionicons.glyphMap; label: string; href: Href }[] = [
  { icon: 'navigate', label: 'Track an order', href: '/track-order' },
  { icon: 'receipt', label: 'My orders', href: '/orders' },
  { icon: 'chatbubbles', label: 'Help with an order', href: '/help' },
  { icon: 'return-down-back', label: 'Returns & refunds', href: '/info/refund-policy' },
  { icon: 'bicycle', label: 'Delivery charges', href: '/info/shipping' },
  { icon: 'help-circle', label: 'FAQs', href: '/info/faq' },
];

const enter = (i: number) =>
  FadeInDown.delay(60 + i * 60)
    .duration(320)
    .reduceMotion(ReduceMotion.Never);

export function CustomerCare() {
  const router = useRouter();
  const open = (url: string) => {
    void Haptics.selectionAsync().catch(() => undefined);
    void Linking.openURL(url).catch(() => undefined);
  };

  return (
    <View style={styles.wrap}>
      {/* Hero */}
      <Animated.View entering={enter(0)} style={styles.hero}>
        <View style={[styles.glow, styles.glowTop]} pointerEvents="none" />
        <View style={styles.heroIcon}>
          <Ionicons name="headset" size={26} color={colors.white} />
        </View>
        <Text style={styles.heroTitle}>{CUSTOMER_CARE_PAGE.title}</Text>
        <Text style={styles.heroText}>
          Your satisfaction is at the heart of everything we do. Pick how you&apos;d like to reach
          us.
        </Text>
        <View style={styles.heroChips}>
          <View style={styles.heroChip}>
            <Ionicons name="sparkles" size={12} color="#ffe500" />
            <Text style={styles.heroChipText}>AI help 24×7</Text>
          </View>
          <View style={styles.heroChip}>
            <Ionicons name="people" size={12} color="#ffe500" />
            <Text style={styles.heroChipText}>Real people on WhatsApp, call & email</Text>
          </View>
        </View>
      </Animated.View>

      {/* YouMart AI */}
      <Animated.View entering={enter(1)}>
        <Pressable
          onPress={() => {
            void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
            router.push('/help/assistant');
          }}
          style={({ pressed }) => [styles.ai, pressed && styles.pressed]}
          accessibilityLabel="Ask YouMart AI"
        >
          <View style={styles.aiOrb}>
            <Ionicons name="sparkles" size={20} color={colors.white} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.aiTitle}>Ask YouMart AI</Text>
            <Text style={styles.aiText}>
              Instant answers on orders, delivery, returns - and help finding what to buy.
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={colors.white} />
        </Pressable>
      </Animated.View>

      {/* Talk to us */}
      <Text style={styles.section}>Talk to our team</Text>
      {CUSTOMER_CARE_PAGE.cards.map((card, i) => {
        const c = CONTACT[card.id];
        return (
          <Animated.View key={card.id} entering={enter(2 + i)}>
            <Pressable
              onPress={() => open(card.href)}
              style={({ pressed }) => [styles.contact, pressed && styles.pressed]}
              accessibilityLabel={`${c.action}: ${c.detail}`}
            >
              <View style={[styles.contactIcon, { backgroundColor: c.tint }]}>
                <Ionicons name={c.icon} size={22} color={colors.white} />
              </View>
              <View style={{ flex: 1, gap: 3 }}>
                <Text style={styles.contactTitle}>{card.title}</Text>
                <Text style={[styles.contactDetail, { color: c.tint }]} selectable>
                  {c.detail}
                </Text>
                <Text style={styles.contactText}>{card.text}</Text>
                <View style={[styles.contactAction, { backgroundColor: `${c.tint}14` }]}>
                  <Text style={[styles.contactActionText, { color: c.tint }]}>{c.action}</Text>
                  <Ionicons name="arrow-forward" size={13} color={c.tint} />
                </View>
              </View>
            </Pressable>
          </Animated.View>
        );
      })}

      {/* Quick help */}
      <Text style={styles.section}>Quick help</Text>
      <View style={styles.quickGrid}>
        {QUICK.map((q, i) => (
          <Animated.View key={q.label} entering={enter(5 + i)} style={styles.quickCell}>
            <Pressable
              onPress={() => router.push(q.href)}
              style={({ pressed }) => [styles.quick, pressed && styles.pressed]}
            >
              <View style={styles.quickIcon}>
                <Ionicons name={q.icon} size={18} color={BRAND} />
              </View>
              <Text style={styles.quickText} numberOfLines={2}>
                {q.label}
              </Text>
            </Pressable>
          </Animated.View>
        ))}
      </View>

      {/* Visit us */}
      <Text style={styles.section}>Visit us</Text>
      <Animated.View entering={enter(11)} style={styles.visit}>
        <View style={styles.visitRow}>
          <View style={styles.visitIcon}>
            <Ionicons name="location" size={20} color="#e11d48" />
          </View>
          <Text style={styles.visitText} selectable>
            {BUSINESS.address}
          </Text>
        </View>
        <Pressable
          onPress={() => open(BUSINESS.mapsHref)}
          style={({ pressed }) => [styles.mapBtn, pressed && styles.pressed]}
        >
          <Ionicons name="map" size={15} color={BRAND} />
          <Text style={styles.mapBtnText}>Open in Maps</Text>
        </Pressable>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { padding: space.lg, gap: 12, paddingBottom: space.xxl },
  pressed: { opacity: 0.9, transform: [{ scale: 0.985 }] },
  hero: {
    borderRadius: 24,
    padding: 20,
    gap: 8,
    overflow: 'hidden',
    experimental_backgroundImage: HERO,
  },
  glow: { position: 'absolute', borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.08)' },
  glowTop: { width: 200, height: 200, top: -90, right: -60 },
  heroIcon: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.16)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.28)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  heroTitle: { fontFamily: font.uiBold, fontSize: 22, lineHeight: 28, color: colors.white },
  heroText: {
    fontFamily: font.body,
    fontSize: 13.5,
    lineHeight: 20,
    color: 'rgba(255,255,255,0.82)',
  },
  heroChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 6 },
  heroChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(255,255,255,0.14)',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  heroChipText: { fontFamily: font.uiSemibold, fontSize: 11.5, color: colors.white },
  ai: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 20,
    padding: 16,
    experimental_backgroundImage: AI,
    shadowColor: '#7c3aed',
    shadowOpacity: 0.3,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 5,
  },
  aiOrb: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  aiTitle: { fontFamily: font.uiBold, fontSize: 16, color: colors.white },
  aiText: {
    fontFamily: font.body,
    fontSize: 12.5,
    lineHeight: 17,
    color: 'rgba(255,255,255,0.85)',
    marginTop: 2,
  },
  section: {
    fontFamily: font.uiBold,
    fontSize: 12,
    letterSpacing: 1.1,
    textTransform: 'uppercase',
    color: '#8a95ab',
    marginTop: 10,
  },
  contact: {
    flexDirection: 'row',
    gap: 14,
    backgroundColor: colors.white,
    borderRadius: 20,
    padding: 16,
    shadowColor: '#0b1b3f',
    shadowOpacity: 0.07,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  contactIcon: {
    width: 46,
    height: 46,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  contactTitle: { fontFamily: font.uiBold, fontSize: 15.5, color: colors.heading },
  contactDetail: { fontFamily: font.uiBold, fontSize: 15, letterSpacing: 0.2 },
  contactText: { fontFamily: font.body, fontSize: 12.5, lineHeight: 18, color: colors.text.body },
  contactAction: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginTop: 6,
  },
  contactActionText: { fontFamily: font.uiBold, fontSize: 12.5 },
  quickGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  quickCell: { width: '31%', flexGrow: 1 },
  quick: {
    backgroundColor: colors.white,
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 8,
    alignItems: 'center',
    gap: 8,
    minHeight: 92,
    borderWidth: 1,
    borderColor: '#e2e9f6',
  },
  quickIcon: {
    width: 38,
    height: 38,
    borderRadius: 13,
    backgroundColor: '#eaf1ff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickText: {
    fontFamily: font.uiSemibold,
    fontSize: 12,
    lineHeight: 15,
    color: colors.heading,
    textAlign: 'center',
  },
  visit: {
    backgroundColor: colors.white,
    borderRadius: 20,
    padding: 16,
    gap: 12,
    borderWidth: 1,
    borderColor: '#e2e9f6',
  },
  visitRow: { flexDirection: 'row', gap: 12, alignItems: 'center' },
  visitIcon: {
    width: 40,
    height: 40,
    borderRadius: 13,
    backgroundColor: '#ffe4e6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  visitText: {
    flex: 1,
    fontFamily: font.uiMedium,
    fontSize: 13,
    lineHeight: 19,
    color: colors.text.strong,
  },
  mapBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderRadius: 12,
    paddingVertical: 10,
    backgroundColor: '#eaf1ff',
  },
  mapBtnText: { fontFamily: font.uiBold, fontSize: 13.5, color: BRAND },
});
