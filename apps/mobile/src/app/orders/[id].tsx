import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams } from 'expo-router';
import {
  TRACKING_STEPS,
  addressLines,
  formatMoney,
  orderStatusLabel,
  trackingProgress,
  type OrderView,
} from '@youmart/shared-client';
import { api } from '@/lib/api';
import { colors, font, radii, space } from '@/theme';

export default function OrderDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [order, setOrder] = useState<OrderView | null | 'error'>(null);

  useEffect(() => {
    api.orders
      .get(String(id ?? ''))
      .then(setOrder)
      .catch(() => setOrder('error'));
  }, [id]);

  if (order === null) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.brand.DEFAULT} />
      </View>
    );
  }
  if (order === 'error') {
    return (
      <View style={styles.center}>
        <Text style={styles.err}>Order not found.</Text>
      </View>
    );
  }

  const { step, cancelled } = trackingProgress(order);

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.body}>
      <View style={styles.head}>
        <Text style={styles.orderNo}>#{order.orderNumber}</Text>
        <Text style={styles.status}>{orderStatusLabel(order)}</Text>
      </View>

      {!cancelled ? (
        <View style={styles.tracker}>
          {TRACKING_STEPS.map((label, i) => (
            <View key={label} style={styles.step}>
              <View style={[styles.dot, i <= step && styles.dotDone]}>
                {i <= step ? <Ionicons name="checkmark" size={12} color={colors.white} /> : null}
              </View>
              <Text style={[styles.stepLabel, i <= step && styles.stepLabelDone]}>{label}</Text>
            </View>
          ))}
        </View>
      ) : null}

      <Text style={styles.section}>Items</Text>
      <View style={styles.card}>
        {order.items.map((item) => (
          <View key={item.orderItemId} style={styles.item}>
            <Text numberOfLines={2} style={styles.itemTitle}>
              {item.quantity} × {item.title}
            </Text>
            <Text style={styles.itemPrice}>{formatMoney(item.lineTotal)}</Text>
          </View>
        ))}
        <View style={styles.divider} />
        <View style={styles.item}>
          <Text style={styles.totalLabel}>Total paid</Text>
          <Text style={styles.totalValue}>{formatMoney(order.grandTotal)}</Text>
        </View>
      </View>

      <Text style={styles.section}>Delivery address</Text>
      <View style={styles.card}>
        {addressLines(order.shippingAddress).map((line, i) => (
          <Text key={i} style={i === 0 ? styles.addrName : styles.addrLine}>
            {line}
          </Text>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.page },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.page },
  err: { fontFamily: font.uiSemibold, fontSize: 16, color: colors.text.strong },
  body: { padding: space.lg, gap: space.md },
  head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  orderNo: { fontFamily: font.uiBold, fontSize: 18, color: colors.heading },
  status: { fontFamily: font.uiSemibold, fontSize: 13, color: colors.brand.DEFAULT },
  tracker: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: colors.white,
    borderRadius: radii.tile,
    borderWidth: 1,
    borderColor: colors.card.border,
    padding: space.lg,
  },
  step: { alignItems: 'center', gap: 6, flex: 1 },
  dot: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.steps.idle,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dotDone: { backgroundColor: colors.feature.guarantee },
  stepLabel: { fontFamily: font.ui, fontSize: 11, color: colors.text.muted, textAlign: 'center' },
  stepLabelDone: { color: colors.text.strong, fontFamily: font.uiSemibold },
  section: { fontFamily: font.uiBold, fontSize: 15, color: colors.heading, marginTop: space.sm },
  card: {
    backgroundColor: colors.white,
    borderRadius: radii.tile,
    borderWidth: 1,
    borderColor: colors.card.border,
    padding: space.lg,
    gap: space.sm,
  },
  item: { flexDirection: 'row', justifyContent: 'space-between', gap: space.md },
  itemTitle: { flex: 1, fontFamily: font.body, fontSize: 13.5, color: colors.text.body },
  itemPrice: { fontFamily: font.uiSemibold, fontSize: 13.5, color: colors.text.strong },
  divider: { height: 1, backgroundColor: colors.cart.line },
  totalLabel: { fontFamily: font.uiBold, fontSize: 14, color: colors.text.strong },
  totalValue: { fontFamily: font.uiBold, fontSize: 15, color: colors.brand.DEFAULT },
  addrName: { fontFamily: font.uiSemibold, fontSize: 14, color: colors.text.strong },
  addrLine: { fontFamily: font.body, fontSize: 13, color: colors.text.body },
});
