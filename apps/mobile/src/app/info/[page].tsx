import { Fragment } from 'react';
import { Linking, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Stack, useLocalSearchParams } from 'expo-router';
import {
  ABOUT_PAGE,
  BUSINESS,
  CONTACT_PAGE,
  CUSTOMER_CARE_PAGE,
  FAQ_PAGE,
  OFFERS_AND_COUPONS,
  PRIVACY_POLICY,
  REFUND_POLICY,
  SHIPPING_DETAILS,
  TERMS_AND_CONDITIONS,
  parseInline,
  type PolicyPage,
} from '@youmart/shared-client';
import { colors, font, radii, space } from '@/theme';

const POLICIES: Record<string, PolicyPage> = {
  'privacy-policy': PRIVACY_POLICY,
  terms: TERMS_AND_CONDITIONS,
  'refund-policy': REFUND_POLICY,
  shipping: SHIPPING_DETAILS,
  offers: OFFERS_AND_COUPONS,
};

const TITLES: Record<string, string> = {
  'privacy-policy': 'Privacy Policy',
  terms: 'Terms & Conditions',
  'refund-policy': 'Refund Policy',
  shipping: 'Shipping Details',
  offers: 'Offers & Coupons',
  about: 'About Us',
  contact: 'Contact Us',
  'customer-care': 'Customer Care',
  faq: 'FAQ',
};

/** Renders **bold** and [label](href) inline markers as native Text. */
function Inline({ source, style }: { source: string; style?: object }) {
  return (
    <Text style={style}>
      {parseInline(source).map((tok, i) => {
        if (tok.type === 'strong')
          return (
            <Text key={i} style={styles.bold}>
              {tok.text}
            </Text>
          );
        if (tok.type === 'link')
          return (
            <Text key={i} style={styles.link} onPress={() => Linking.openURL(tok.href)}>
              {tok.text}
            </Text>
          );
        return <Fragment key={i}>{tok.text}</Fragment>;
      })}
    </Text>
  );
}

function PolicyView({ page }: { page: PolicyPage }) {
  return (
    <View style={styles.body}>
      {page.sections.map((section, si) => (
        <View key={si} style={styles.section}>
          {section.heading ? <Text style={styles.h2}>{section.heading}</Text> : null}
          {section.blocks.map((block, bi) =>
            block.type === 'p' ? (
              <Inline key={bi} source={block.text} style={styles.p} />
            ) : (
              <View key={bi} style={styles.listBlock}>
                {block.items.map((item, ii) => (
                  <View key={ii} style={styles.li}>
                    <Text style={styles.bullet}>{block.type === 'ol' ? `${ii + 1}.` : '•'}</Text>
                    <Inline source={item} style={styles.liText} />
                  </View>
                ))}
              </View>
            ),
          )}
        </View>
      ))}
    </View>
  );
}

function AboutView() {
  return (
    <View style={styles.body}>
      <Text style={styles.eyebrow}>{ABOUT_PAGE.intro.eyebrow}</Text>
      <Text style={styles.h1}>{ABOUT_PAGE.intro.title}</Text>
      {ABOUT_PAGE.intro.paragraphs.map((para, i) => (
        <Inline key={i} source={para} style={styles.p} />
      ))}
      <Text style={styles.h2}>{ABOUT_PAGE.missionVision.title}</Text>
      {ABOUT_PAGE.missionVision.items.map((item) => (
        <View key={item.title} style={styles.card}>
          <Text style={styles.cardTitle}>{item.title}</Text>
          <Inline source={item.text} style={styles.p} />
        </View>
      ))}
    </View>
  );
}

function ContactView() {
  return (
    <View style={styles.body}>
      <Inline source={CONTACT_PAGE.hero.text} style={styles.p} />
      <View style={styles.card}>
        <Text style={styles.cardTitle}>{CONTACT_PAGE.card.title}</Text>
        {CONTACT_PAGE.card.items.map((item) => (
          <Text
            key={item.id}
            style={styles.contactRow}
            onPress={item.href ? () => Linking.openURL(item.href!) : undefined}
          >
            <Text style={styles.bold}>{item.title}: </Text>
            <Text style={item.href ? styles.link : undefined}>{item.text}</Text>
          </Text>
        ))}
      </View>
    </View>
  );
}

function CareView() {
  return (
    <View style={styles.body}>
      <Inline source={CUSTOMER_CARE_PAGE.text} style={styles.p} />
      {CUSTOMER_CARE_PAGE.cards.map((card) => (
        <View key={card.id} style={styles.card}>
          <Text style={styles.cardTitle}>{card.title}</Text>
          <Text style={styles.p}>{card.text}</Text>
          <Text style={styles.link} onPress={() => Linking.openURL(card.href)}>
            {card.id === 'whatsapp' ? 'Open WhatsApp' : `Call ${BUSINESS.phone}`}
          </Text>
        </View>
      ))}
    </View>
  );
}

function FaqView() {
  return (
    <View style={styles.body}>
      {FAQ_PAGE.items.map((item, i) => (
        <View key={i} style={styles.card}>
          <Text style={styles.cardTitle}>{item.question}</Text>
          {item.answer.map((ans, ai) =>
            Array.isArray(ans) ? (
              ans.map((line, li) => (
                <View key={`${ai}-${li}`} style={styles.li}>
                  <Text style={styles.bullet}>•</Text>
                  <Inline source={line} style={styles.liText} />
                </View>
              ))
            ) : (
              <Inline key={ai} source={ans as string} style={styles.p} />
            ),
          )}
        </View>
      ))}
    </View>
  );
}

export default function InfoScreen() {
  const { page } = useLocalSearchParams<{ page: string }>();
  const key = String(page ?? '');
  const title = TITLES[key] ?? 'Information';
  const policy = POLICIES[key];

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.scroll}>
      <Stack.Screen options={{ title }} />
      {policy ? (
        <PolicyView page={policy} />
      ) : key === 'about' ? (
        <AboutView />
      ) : key === 'contact' ? (
        <ContactView />
      ) : key === 'customer-care' ? (
        <CareView />
      ) : key === 'faq' ? (
        <FaqView />
      ) : (
        <View style={styles.body}>
          <Ionicons name="document-text-outline" size={48} color={colors.card.border} />
          <Text style={styles.p}>This page is not available.</Text>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.page },
  scroll: { padding: space.lg, paddingBottom: space.xxxl },
  body: { gap: space.md },
  eyebrow: {
    fontFamily: font.uiSemibold,
    fontSize: 12,
    color: colors.brand.DEFAULT,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  h1: { fontFamily: font.uiBold, fontSize: 22, color: colors.heading },
  h2: { fontFamily: font.uiBold, fontSize: 16, color: colors.heading, marginTop: space.sm },
  p: { fontFamily: font.body, fontSize: 14, lineHeight: 22, color: colors.text.body },
  bold: { fontFamily: font.uiSemibold, color: colors.text.strong },
  link: { color: colors.brand.DEFAULT, textDecorationLine: 'underline' },
  section: { gap: space.sm },
  listBlock: { gap: 4 },
  li: { flexDirection: 'row', gap: 8 },
  bullet: { fontFamily: font.body, fontSize: 14, color: colors.text.body, width: 16 },
  liText: { flex: 1, fontFamily: font.body, fontSize: 14, lineHeight: 21, color: colors.text.body },
  card: {
    backgroundColor: colors.white,
    borderRadius: radii.tile,
    borderWidth: 1,
    borderColor: colors.card.border,
    padding: space.lg,
    gap: 6,
  },
  cardTitle: { fontFamily: font.uiSemibold, fontSize: 15, color: colors.text.strong },
  contactRow: { fontFamily: font.body, fontSize: 14, lineHeight: 24, color: colors.text.body },
});
