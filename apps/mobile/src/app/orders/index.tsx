import { useCallback, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { formatMoney, orderStatusLabel, type OrderListItem } from '@youmart/shared-client';
import { api } from '@/lib/api';
import { colors, font, radii, space } from '@/theme';

function formatDate(iso: string): string {
  return new Intl.DateTimeFormat('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(new Date(iso));
}

export default function OrdersScreen() {
  const router = useRouter();
  const [orders, setOrders] = useState<OrderListItem[] | null>(null);

  useFocusEffect(
    useCallback(() => {
      api.orders
        .list()
        .then((p) => setOrders(p.items))
        .catch(() => setOrders([]));
    }, []),
  );

  if (!orders) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.brand.DEFAULT} />
      </View>
    );
  }

  return (
    <FlatList
      style={styles.screen}
      data={orders}
      keyExtractor={(o) => o.orderId}
      contentContainerStyle={styles.list}
      ListEmptyComponent={
        <View style={styles.empty}>
          <Ionicons name="bag-handle-outline" size={52} color={colors.card.border} />
          <Text style={styles.emptyText}>You have no orders yet.</Text>
          <Pressable style={styles.shopBtn} onPress={() => router.push('/')}>
            <Text style={styles.shopText}>Start shopping</Text>
          </Pressable>
        </View>
      }
      renderItem={({ item }) => (
        <Pressable style={styles.card} onPress={() => router.push(`/orders/${item.orderId}`)}>
          <View style={styles.cardTop}>
            <Text style={styles.orderNo}>#{item.orderNumber}</Text>
            <View style={[styles.statusPill, item.status === 'CANCELLED' && styles.cancelled]}>
              <Text style={styles.statusText}>
                {orderStatusLabel({ status: item.status, items: [] })}
              </Text>
            </View>
          </View>
          <View style={styles.cardBottom}>
            <Text style={styles.date}>{formatDate(item.createdAt)}</Text>
            <Text style={styles.total}>{formatMoney(item.grandTotal)}</Text>
          </View>
        </Pressable>
      )}
    />
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.page },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.page },
  list: { padding: space.lg, gap: space.md },
  empty: { alignItems: 'center', gap: space.md, paddingVertical: space.xxxl },
  emptyText: { fontFamily: font.body, fontSize: 14, color: colors.text.body },
  shopBtn: {
    backgroundColor: colors.brand.DEFAULT,
    borderRadius: radii.pill,
    paddingHorizontal: 24,
    paddingVertical: 11,
  },
  shopText: { fontFamily: font.uiSemibold, fontSize: 15, color: colors.white },
  card: {
    backgroundColor: colors.white,
    borderRadius: radii.tile,
    borderWidth: 1,
    borderColor: colors.card.border,
    padding: space.lg,
    gap: space.sm,
  },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  orderNo: { fontFamily: font.uiBold, fontSize: 15, color: colors.text.strong },
  statusPill: {
    backgroundColor: colors.brandPopup.bg,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  cancelled: { backgroundColor: '#fdecec' },
  statusText: { fontFamily: font.uiSemibold, fontSize: 11.5, color: colors.brand.DEFAULT },
  cardBottom: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  date: { fontFamily: font.body, fontSize: 13, color: colors.text.muted },
  total: { fontFamily: font.uiBold, fontSize: 15, color: colors.brand.DEFAULT },
});
