import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { BUSINESS, type HelpTicket } from '@youmart/shared-client';
import { api } from '@/lib/api';
import { useSession } from '@/stores/session';
import { colors, font, radii, space } from '@/theme';

const STATUS_LABEL: Record<HelpTicket['status'], string> = {
  OPEN: 'Open',
  IN_PROGRESS: 'In progress',
  RESOLVED: 'Resolved',
};

const POLICIES: { page: string; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { page: 'faq', label: 'Frequently asked questions', icon: 'help-circle-outline' },
  { page: 'refund-policy', label: 'Returns & refund policy', icon: 'refresh-outline' },
  { page: 'shipping', label: 'Shipping & delivery', icon: 'cube-outline' },
  { page: 'terms', label: 'Terms & conditions', icon: 'document-text-outline' },
];

/** W9: Help Center - get help with an order (tickets), follow your requests, policies, contact. */
export default function HelpCenterScreen() {
  const router = useRouter();
  const session = useSession();
  const authed = session.status === 'authenticated';
  const [tickets, setTickets] = useState<HelpTicket[] | null>(null);

  useFocusEffect(
    useCallback(() => {
      if (!authed) {
        setTickets([]);
        return;
      }
      api.support
        .listTickets({ limit: 20 })
        .then((p) => setTickets(p.items))
        .catch(() => setTickets([]));
    }, [authed]),
  );

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.body}>
      <View style={styles.hero}>
        <Text style={styles.heroTitle}>How can we help?</Text>
        <Text style={styles.heroSub}>
          Pick an order to get help with it - tracking, cancellations, returns, refunds or payment.
        </Text>
        <Pressable
          style={styles.heroBtn}
          onPress={() => router.push(authed ? '/help/new' : '/auth/login')}
        >
          <Ionicons name="chatbubbles-outline" size={18} color={colors.brand.DEFAULT} />
          <Text style={styles.heroBtnText}>
            {authed ? 'Get help with an order' : 'Sign in to get help'}
          </Text>
        </Pressable>
      </View>

      {authed ? (
        <>
          <Text style={styles.section}>My help requests</Text>
          {!tickets ? (
            <ActivityIndicator color={colors.brand.DEFAULT} />
          ) : tickets.length === 0 ? (
            <Text style={styles.muted}>You haven&apos;t asked for help yet.</Text>
          ) : (
            tickets.map((t) => (
              <View key={t.ticketId} style={styles.ticket}>
                <View style={styles.ticketTop}>
                  <Text style={styles.ticketTopic}>{t.topicLabel}</Text>
                  <View style={[styles.pill, t.status === 'RESOLVED' && styles.pillDone]}>
                    <Text style={[styles.pillText, t.status === 'RESOLVED' && styles.pillTextDone]}>
                      {STATUS_LABEL[t.status]}
                    </Text>
                  </View>
                </View>
                <Text style={styles.ticketMeta}>
                  {t.reference}
                  {t.orderNumber ? ` · Order #${t.orderNumber}` : ''} ·{' '}
                  {new Date(t.createdAt).toLocaleDateString('en-IN')}
                </Text>
                <Text style={styles.ticketMsg} numberOfLines={3}>
                  {t.message}
                </Text>
              </View>
            ))
          )}
        </>
      ) : null}

      <Text style={styles.section}>Policies & answers</Text>
      <View style={styles.rows}>
        {POLICIES.map((p, i) => (
          <Pressable
            key={p.page}
            style={[styles.row, i === POLICIES.length - 1 && styles.rowLast]}
            onPress={() => router.push(`/info/${p.page}`)}
          >
            <Ionicons name={p.icon} size={20} color={colors.brand.DEFAULT} />
            <Text style={styles.rowText}>{p.label}</Text>
            <Ionicons name="chevron-forward" size={18} color={colors.text.muted} />
          </Pressable>
        ))}
      </View>

      <Text style={styles.section}>Contact us</Text>
      <View style={styles.rows}>
        <Pressable style={styles.row} onPress={() => Linking.openURL(BUSINESS.phoneHref)}>
          <Ionicons name="call-outline" size={20} color={colors.brand.DEFAULT} />
          <Text style={styles.rowText}>{BUSINESS.phone}</Text>
        </Pressable>
        <Pressable
          style={[styles.row, styles.rowLast]}
          onPress={() => Linking.openURL(`mailto:${BUSINESS.email}`)}
        >
          <Ionicons name="mail-outline" size={20} color={colors.brand.DEFAULT} />
          <Text style={styles.rowText}>{BUSINESS.email}</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.page },
  body: { padding: space.lg, gap: space.md, paddingBottom: space.xxl },
  hero: {
    backgroundColor: colors.brand.DEFAULT,
    borderRadius: radii.tile + 6,
    padding: space.lg,
    gap: 6,
  },
  heroTitle: { fontFamily: font.uiBold, fontSize: 20, color: colors.white },
  heroSub: { fontFamily: font.body, fontSize: 13, lineHeight: 19, color: '#dbe7ff' },
  heroBtn: {
    marginTop: space.sm,
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.white,
    borderRadius: radii.pill,
    paddingHorizontal: 16,
    paddingVertical: 9,
  },
  heroBtnText: { fontFamily: font.uiSemibold, fontSize: 14, color: colors.brand.DEFAULT },
  section: { fontFamily: font.uiBold, fontSize: 15, color: colors.heading, marginTop: space.sm },
  muted: { fontFamily: font.body, fontSize: 13.5, color: colors.text.muted },
  ticket: {
    backgroundColor: colors.white,
    borderRadius: radii.tile,
    borderWidth: 1,
    borderColor: colors.card.border,
    padding: space.md,
    gap: 4,
  },
  ticketTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  ticketTopic: { flex: 1, fontFamily: font.uiSemibold, fontSize: 14, color: colors.text.strong },
  ticketMeta: { fontFamily: font.body, fontSize: 12, color: colors.text.muted },
  ticketMsg: { fontFamily: font.body, fontSize: 13, color: colors.text.body },
  pill: {
    backgroundColor: colors.brandPopup.bg,
    borderRadius: radii.pill,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  pillDone: { backgroundColor: '#e7f6ee' },
  pillText: { fontFamily: font.uiSemibold, fontSize: 11.5, color: colors.brand.DEFAULT },
  pillTextDone: { color: colors.feature.guarantee },
  rows: {
    backgroundColor: colors.white,
    borderRadius: radii.tile,
    borderWidth: 1,
    borderColor: colors.card.border,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingHorizontal: space.lg,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.cart.line,
  },
  rowLast: { borderBottomWidth: 0 },
  rowText: { flex: 1, fontFamily: font.uiMedium, fontSize: 14.5, color: colors.text.strong },
});
