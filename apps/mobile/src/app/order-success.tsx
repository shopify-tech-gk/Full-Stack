import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { orderOverview, type OrderView } from '@youmart/shared-client';
import { api } from '@/lib/api';
import { colors, font, radii, space } from '@/theme';

export default function OrderSuccessScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { orderId } = useLocalSearchParams<{ orderId: string }>();
  const [order, setOrder] = useState<OrderView | null>(null);

  useEffect(() => {
    api.orders
      .get(String(orderId ?? ''))
      .then(setOrder)
      .catch(() => undefined);
  }, [orderId]);

  return (
    <View style={[styles.screen, { paddingTop: insets.top + space.xxl }]}>
      <ScrollView contentContainerStyle={styles.body}>
        <View style={styles.tick}>
          <Ionicons name="checkmark" size={46} color={colors.white} />
        </View>
        <Text style={styles.title}>Order confirmed!</Text>
        <Text style={styles.subtitle}>Thank you for shopping with YouMart.</Text>

        {!order ? (
          <ActivityIndicator color={colors.brand.DEFAULT} style={{ marginTop: space.xl }} />
        ) : (
          <View style={styles.card}>
            {orderOverview(order, order.createdAt).map((row) => (
              <View key={row.label} style={styles.row}>
                <Text style={styles.rowLabel}>{row.label}</Text>
                <Text style={styles.rowValue}>{row.value}</Text>
              </View>
            ))}
          </View>
        )}
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + space.md }]}>
        <Pressable style={styles.secondary} onPress={() => router.replace(`/orders/${orderId}`)}>
          <Text style={styles.secondaryText}>View order</Text>
        </Pressable>
        <Pressable style={styles.primary} onPress={() => router.replace('/')}>
          <Text style={styles.primaryText}>Continue shopping</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.page },
  body: { alignItems: 'center', padding: space.xl, gap: space.sm },
  tick: {
    width: 84,
    height: 84,
    borderRadius: 42,
    backgroundColor: colors.feature.guarantee,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { fontFamily: font.uiBold, fontSize: 23, color: colors.heading, marginTop: space.md },
  subtitle: { fontFamily: font.body, fontSize: 14, color: colors.text.body },
  card: {
    alignSelf: 'stretch',
    backgroundColor: colors.white,
    borderRadius: radii.tile,
    borderWidth: 1,
    borderColor: colors.card.border,
    padding: space.lg,
    gap: space.sm,
    marginTop: space.xl,
  },
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: space.md },
  rowLabel: { fontFamily: font.body, fontSize: 13.5, color: colors.text.body },
  rowValue: {
    fontFamily: font.uiSemibold,
    fontSize: 13.5,
    color: colors.text.strong,
    flexShrink: 1,
    textAlign: 'right',
  },
  footer: { flexDirection: 'row', gap: space.md, padding: space.lg },
  secondary: {
    flex: 1,
    alignItems: 'center',
    borderRadius: radii.button,
    borderWidth: 1.5,
    borderColor: colors.brand.DEFAULT,
    paddingVertical: 14,
  },
  secondaryText: { fontFamily: font.uiSemibold, fontSize: 15, color: colors.brand.DEFAULT },
  primary: {
    flex: 1,
    alignItems: 'center',
    borderRadius: radii.button,
    backgroundColor: colors.brand.DEFAULT,
    paddingVertical: 14,
  },
  primaryText: { fontFamily: font.uiSemibold, fontSize: 15, color: colors.white },
});
