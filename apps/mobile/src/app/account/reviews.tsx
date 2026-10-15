import { useCallback, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import type { MyReviewListItem } from '@youmart/shared-client';
import { api } from '@/lib/api';
import { ProductImage } from '@/components/ui';
import { colors, font, radii, space } from '@/theme';

const STATUS: Record<MyReviewListItem['status'], { label: string; color: string } | null> = {
  PUBLISHED: null,
  PENDING: { label: 'Under review', color: '#c47f00' },
  REJECTED: { label: 'Not published', color: colors.price.discount },
};

/** My Reviews: every review the customer has written; tap one to edit it. */
export default function MyReviewsScreen() {
  const router = useRouter();
  const [items, setItems] = useState<MyReviewListItem[] | null>(null);
  const [error, setError] = useState(false);

  useFocusEffect(
    useCallback(() => {
      api.catalog
        .myReviews()
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
          <Text style={styles.empty}>Could not load your reviews.</Text>
        ) : (
          <ActivityIndicator size="large" color={colors.brand.DEFAULT} />
        )}
      </View>
    );
  }

  if (items.length === 0) {
    return (
      <View style={[styles.center, { padding: space.xl, gap: space.md }]}>
        <Ionicons name="star-outline" size={56} color={colors.card.border} />
        <Text style={styles.emptyTitle}>No reviews yet</Text>
        <Text style={styles.empty}>
          Once an order is delivered, rate it from My Orders - it helps other shoppers.
        </Text>
        <Pressable style={styles.btn} onPress={() => router.push('/orders')}>
          <Text style={styles.btnText}>Go to My Orders</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <FlatList
      style={styles.screen}
      contentContainerStyle={styles.list}
      data={items}
      keyExtractor={(r) => r.id}
      renderItem={({ item }) => {
        const status = STATUS[item.status];
        return (
          <View style={styles.card}>
            <Pressable
              style={styles.productRow}
              onPress={() => item.product && router.push(`/product/${item.product.slug}`)}
            >
              <ProductImage
                src={item.product?.imageUrl ?? undefined}
                style={styles.thumb}
                icon={18}
              />
              <Text numberOfLines={2} style={styles.productTitle}>
                {item.product?.title ?? 'Product no longer available'}
              </Text>
            </Pressable>
            <View style={styles.ratingRow}>
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{item.rating}</Text>
                <Ionicons name="star" size={11} color={colors.white} />
              </View>
              {item.title ? <Text style={styles.reviewTitle}>{item.title}</Text> : null}
            </View>
            <Text style={styles.body} numberOfLines={4}>
              {item.body}
            </Text>
            <View style={styles.footer}>
              <Text style={styles.date}>
                {new Date(item.updatedAt).toLocaleDateString('en-IN', {
                  day: 'numeric',
                  month: 'short',
                  year: 'numeric',
                })}
                {status ? (
                  <Text style={{ color: status.color }}>{`  ·  ${status.label}`}</Text>
                ) : null}
              </Text>
              {item.product ? (
                <Pressable
                  onPress={() => router.push(`/review/${item.product!.slug}`)}
                  hitSlop={8}
                  style={styles.edit}
                >
                  <Ionicons name="create-outline" size={15} color={colors.brand.DEFAULT} />
                  <Text style={styles.editText}>Edit</Text>
                </Pressable>
              ) : null}
            </View>
          </View>
        );
      }}
    />
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.page },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.page },
  list: { padding: space.lg, gap: space.md },
  card: { backgroundColor: colors.white, borderRadius: radii.tile, padding: space.md, gap: 8 },
  productRow: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  thumb: { width: 48, height: 48, borderRadius: 8 },
  productTitle: { flex: 1, fontFamily: font.uiSemibold, fontSize: 13.5, color: colors.text.strong },
  ratingRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#26a541',
    borderRadius: 5,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  badgeText: { fontFamily: font.uiBold, fontSize: 12, color: colors.white },
  reviewTitle: { flex: 1, fontFamily: font.uiSemibold, fontSize: 14, color: colors.text.strong },
  body: { fontFamily: font.body, fontSize: 13.5, lineHeight: 20, color: colors.text.body },
  footer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  date: { fontFamily: font.body, fontSize: 12, color: colors.text.muted },
  edit: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  editText: { fontFamily: font.uiSemibold, fontSize: 13, color: colors.brand.DEFAULT },
  emptyTitle: { fontFamily: font.uiBold, fontSize: 18, color: colors.heading },
  empty: { fontFamily: font.body, fontSize: 14, color: colors.text.body, textAlign: 'center' },
  btn: {
    backgroundColor: colors.brand.DEFAULT,
    borderRadius: radii.pill,
    paddingHorizontal: 24,
    paddingVertical: 11,
  },
  btnText: { fontFamily: font.uiSemibold, fontSize: 15, color: colors.white },
});
