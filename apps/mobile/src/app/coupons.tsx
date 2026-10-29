import { useCallback, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import type { AvailableCoupon } from '@youmart/shared-client';
import { api } from '@/lib/api';
import { colors, font, radii, space } from '@/theme';

function until(iso: string | null): string | null {
  if (!iso) return null;
  return `Valid till ${new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}`;
}

/** Account > Coupons: every offer running now (codes to use at checkout). */
export default function CouponsScreen() {
  const router = useRouter();
  const [items, setItems] = useState<AvailableCoupon[] | null>(null);
  const [error, setError] = useState(false);

  useFocusEffect(
    useCallback(() => {
      api.orders
        .coupons()
        .then((r) => {
          setItems(r.items);
          setError(false);
        })
        .catch(() => setError(true));
    }, []),
  );

  if (!items) {
    return (
      <View style={styles.center}>
        {error ? (
          <Text style={styles.muted}>Could not load offers.</Text>
        ) : (
          <ActivityIndicator size="large" color={colors.brand.DEFAULT} />
        )}
      </View>
    );
  }

  return (
    <FlatList
      style={styles.screen}
      contentContainerStyle={styles.list}
      data={items}
      keyExtractor={(c) => c.code}
      ListHeaderComponent={
        <View style={styles.hint}>
          <Ionicons name="information-circle" size={18} color={colors.brand.DEFAULT} />
          <Text style={styles.hintText}>
            Pick any of these at checkout under &quot;Apply coupon&quot; - the best one for your
            cart shows first.
          </Text>
        </View>
      }
      ListEmptyComponent={
        <View style={[styles.center, { paddingTop: space.xxl, gap: space.md }]}>
          <Ionicons name="pricetags-outline" size={56} color={colors.card.border} />
          <Text style={styles.emptyTitle}>No offers right now</Text>
          <Text style={styles.muted}>Check back soon - new coupons drop regularly.</Text>
        </View>
      }
      renderItem={({ item }) => (
        <View style={styles.card}>
          <View style={styles.left}>
            <Text style={styles.leftText}>
              {item.discountType === 'PERCENT'
                ? `${Number(item.discountValue)}%`
                : `₹${Number(item.discountValue)}`}
            </Text>
            <Text style={styles.leftSub}>OFF</Text>
          </View>
          <View style={styles.body}>
            <Text style={styles.title}>{item.title}</Text>
            {item.description ? <Text style={styles.desc}>{item.description}</Text> : null}
            <View style={styles.codeRow}>
              <View style={styles.codeChip}>
                <Text style={styles.code}>{item.code}</Text>
              </View>
              {until(item.endsAt) ? <Text style={styles.until}>{until(item.endsAt)}</Text> : null}
            </View>
          </View>
        </View>
      )}
      ListFooterComponent={
        items.length > 0 ? (
          <Pressable style={styles.shop} onPress={() => router.push('/')}>
            <Text style={styles.shopText}>Start shopping</Text>
          </Pressable>
        ) : undefined
      }
    />
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.page },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.page },
  list: { padding: space.lg, gap: space.md },
  muted: { fontFamily: font.body, fontSize: 14, color: colors.text.body, textAlign: 'center' },
  emptyTitle: { fontFamily: font.uiBold, fontSize: 18, color: colors.heading },
  hint: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
    backgroundColor: colors.brandPopup.bg,
    borderRadius: radii.tile,
    padding: space.md,
  },
  hintText: { flex: 1, fontFamily: font.body, fontSize: 13, color: colors.text.strong },
  card: {
    flexDirection: 'row',
    backgroundColor: colors.white,
    borderRadius: radii.tile,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.card.border,
  },
  left: {
    width: 86,
    backgroundColor: colors.brand.DEFAULT,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: space.md,
  },
  leftText: { fontFamily: font.uiBold, fontSize: 20, color: colors.white },
  leftSub: { fontFamily: font.uiSemibold, fontSize: 12, letterSpacing: 1, color: '#cfe3ff' },
  body: { flex: 1, padding: space.md, gap: 4 },
  title: { fontFamily: font.uiBold, fontSize: 15, color: colors.text.strong },
  desc: { fontFamily: font.body, fontSize: 12.5, color: colors.text.body },
  codeRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm, marginTop: 4 },
  codeChip: {
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: colors.brand.DEFAULT,
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  code: { fontFamily: font.uiBold, fontSize: 13.5, letterSpacing: 1, color: colors.brand.DEFAULT },
  until: { fontFamily: font.body, fontSize: 11.5, color: colors.text.muted },
  shop: {
    alignSelf: 'center',
    marginTop: space.md,
    backgroundColor: colors.brand.DEFAULT,
    borderRadius: radii.tile,
    paddingHorizontal: 24,
    paddingVertical: 11,
  },
  shopText: { fontFamily: font.uiSemibold, fontSize: 15, color: colors.white },
});
