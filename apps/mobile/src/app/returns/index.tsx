import { useCallback, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { formatMoney, type ReturnStatus, type ReturnView } from '@youmart/shared-client';
import { api } from '@/lib/api';
import { colors, font, radii, space } from '@/theme';

const STEPS: { status: ReturnStatus; label: string }[] = [
  { status: 'REQUESTED', label: 'Requested' },
  { status: 'APPROVED', label: 'Approved' },
  { status: 'PICKED_UP', label: 'Picked up' },
  { status: 'REFUNDED', label: 'Refunded' },
];

function day(iso: string): string {
  return new Intl.DateTimeFormat('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(new Date(iso));
}

/** W9: My Returns & Refunds - every return with where it stands; refunds go to the wallet. */
export default function ReturnsScreen() {
  const router = useRouter();
  const [items, setItems] = useState<ReturnView[] | null>(null);

  useFocusEffect(
    useCallback(() => {
      api.returns
        .list({ limit: 50 })
        .then((p) => setItems(p.items))
        .catch(() => setItems([]));
    }, []),
  );

  if (!items) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.brand.DEFAULT} />
      </View>
    );
  }

  return (
    <FlatList
      style={styles.screen}
      contentContainerStyle={styles.list}
      data={items}
      keyExtractor={(r) => r.id}
      ListHeaderComponent={
        <Pressable style={styles.walletNote} onPress={() => router.push('/wallet')}>
          <Ionicons name="wallet-outline" size={18} color={colors.brand.DEFAULT} />
          <Text style={styles.walletNoteText}>
            Refunds are added to your YouMart Wallet as soon as they&apos;re processed.
          </Text>
          <Ionicons name="chevron-forward" size={16} color={colors.brand.DEFAULT} />
        </Pressable>
      }
      ListEmptyComponent={
        <View style={styles.empty}>
          <Ionicons name="return-down-back-outline" size={52} color={colors.card.border} />
          <Text style={styles.emptyTitle}>No returns yet</Text>
          <Text style={styles.emptyText}>
            To return a delivered item, open the order in My Orders and tap “Return item”.
          </Text>
          <Pressable style={styles.btn} onPress={() => router.push('/orders')}>
            <Text style={styles.btnText}>Go to My Orders</Text>
          </Pressable>
        </View>
      }
      renderItem={({ item }) => {
        const rejected = item.status === 'REJECTED';
        const reached = STEPS.findIndex((s) => s.status === item.status);
        return (
          <Pressable
            style={styles.card}
            disabled={!item.orderId}
            onPress={() => item.orderId && router.push(`/orders/${item.orderId}`)}
          >
            <View style={styles.top}>
              <Text style={styles.title} numberOfLines={2}>
                {item.quantity ? `${item.quantity} × ` : ''}
                {item.title ?? 'Returned item'}
              </Text>
              {item.refundAmount ? (
                <Text style={styles.amount}>{formatMoney(item.refundAmount)}</Text>
              ) : null}
            </View>
            <Text style={styles.meta}>
              {item.orderNumber ? `Order #${item.orderNumber} · ` : ''}Requested{' '}
              {day(item.createdAt)}
            </Text>
            <Text style={styles.reason} numberOfLines={2}>
              “{item.reason}”
            </Text>

            {rejected ? (
              <View style={styles.rejected}>
                <Ionicons name="close-circle" size={16} color={colors.price.discount} />
                <Text style={styles.rejectedText}>
                  This return wasn&apos;t approved. Use “Need help” on the order if you have
                  questions.
                </Text>
              </View>
            ) : (
              <View style={styles.steps}>
                {STEPS.map((s, i) => {
                  const done = i <= reached;
                  return (
                    <View key={s.status} style={styles.step}>
                      <View style={[styles.dot, done && styles.dotDone]}>
                        {done ? <Ionicons name="checkmark" size={11} color={colors.white} /> : null}
                      </View>
                      <Text style={[styles.stepLabel, done && styles.stepLabelDone]}>
                        {s.label}
                      </Text>
                    </View>
                  );
                })}
              </View>
            )}
            {item.status === 'REFUNDED' && item.refundAmount ? (
              <Text style={styles.refunded}>
                {formatMoney(item.refundAmount)} added to your YouMart Wallet
              </Text>
            ) : null}
          </Pressable>
        );
      }}
    />
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.page },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.page },
  list: { padding: space.lg, gap: space.md },
  walletNote: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.brandPopup.bg,
    borderRadius: radii.tile,
    padding: space.md,
  },
  walletNoteText: { flex: 1, fontFamily: font.uiMedium, fontSize: 13, color: colors.text.strong },
  empty: {
    alignItems: 'center',
    gap: space.sm,
    paddingVertical: space.xxl,
    paddingHorizontal: space.lg,
  },
  emptyTitle: { fontFamily: font.uiBold, fontSize: 17, color: colors.text.strong },
  emptyText: {
    fontFamily: font.body,
    fontSize: 13.5,
    color: colors.text.body,
    textAlign: 'center',
  },
  btn: {
    marginTop: space.sm,
    backgroundColor: colors.brand.DEFAULT,
    borderRadius: radii.pill,
    paddingHorizontal: 22,
    paddingVertical: 10,
  },
  btnText: { fontFamily: font.uiSemibold, fontSize: 14, color: colors.white },
  card: {
    backgroundColor: colors.white,
    borderRadius: radii.tile,
    borderWidth: 1,
    borderColor: colors.card.border,
    padding: space.lg,
    gap: 6,
  },
  top: { flexDirection: 'row', justifyContent: 'space-between', gap: space.md },
  title: { flex: 1, fontFamily: font.uiSemibold, fontSize: 14, color: colors.text.strong },
  amount: { fontFamily: font.uiBold, fontSize: 14, color: colors.brand.DEFAULT },
  meta: { fontFamily: font.body, fontSize: 12, color: colors.text.muted },
  reason: { fontFamily: font.body, fontSize: 12.5, color: colors.text.body, fontStyle: 'italic' },
  steps: { flexDirection: 'row', marginTop: space.sm },
  step: { flex: 1, alignItems: 'center', gap: 4 },
  dot: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: colors.steps.idle,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dotDone: { backgroundColor: colors.feature.guarantee },
  stepLabel: { fontFamily: font.ui, fontSize: 10.5, color: colors.text.muted },
  stepLabelDone: { fontFamily: font.uiSemibold, color: colors.text.strong },
  rejected: { flexDirection: 'row', gap: 6, marginTop: space.xs },
  rejectedText: { flex: 1, fontFamily: font.body, fontSize: 12.5, color: colors.price.discount },
  refunded: {
    fontFamily: font.uiSemibold,
    fontSize: 12.5,
    color: colors.feature.guarantee,
    marginTop: 4,
  },
});
