import { useCallback, useLayoutEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useNavigation, useRouter } from 'expo-router';
import type { ProductCardData } from '@youmart/shared-client';
import { clearRecentlyViewed, getRecentlyViewed } from '@/lib/catalog';
import { ProductCard } from '@/components/ProductCard';
import { colors, font, radii, space } from '@/theme';

/** Account > Recently viewed: the full browsing history as product cards, with Clear. */
export default function RecentlyViewedScreen() {
  const router = useRouter();
  const navigation = useNavigation();
  const [items, setItems] = useState<ProductCardData[] | null>(null);
  const [error, setError] = useState(false);

  useFocusEffect(
    useCallback(() => {
      getRecentlyViewed()
        .then((list) => {
          setItems(list);
          setError(false);
        })
        .catch(() => setError(true));
    }, []),
  );

  const clear = useCallback(() => {
    Alert.alert('Clear recently viewed?', 'Your browsing history will be removed.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Clear',
        style: 'destructive',
        onPress: () => {
          void clearRecentlyViewed()
            .then(() => setItems([]))
            .catch(() => undefined);
        },
      },
    ]);
  }, []);

  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () =>
        items && items.length > 0 ? (
          <Pressable onPress={clear} hitSlop={10}>
            <Text style={styles.clear}>Clear</Text>
          </Pressable>
        ) : null,
    });
  }, [navigation, items, clear]);

  if (!items) {
    return (
      <View style={styles.center}>
        {error ? (
          <Text style={styles.empty}>Could not load your history.</Text>
        ) : (
          <ActivityIndicator size="large" color={colors.brand.DEFAULT} />
        )}
      </View>
    );
  }

  if (items.length === 0) {
    return (
      <View style={[styles.center, { padding: space.xl, gap: space.md }]}>
        <Ionicons name="time-outline" size={56} color={colors.card.border} />
        <Text style={styles.emptyTitle}>Nothing here yet</Text>
        <Text style={styles.empty}>Products you look at will show up here.</Text>
        <Pressable style={styles.btn} onPress={() => router.push('/')}>
          <Text style={styles.btnText}>Start shopping</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <FlatList
      style={styles.screen}
      data={items}
      keyExtractor={(p) => p.id}
      numColumns={2}
      columnWrapperStyle={{ gap: space.md }}
      contentContainerStyle={styles.grid}
      renderItem={({ item }) => <ProductCard product={item} />}
    />
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.page },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.page },
  grid: { padding: space.lg, gap: space.md },
  clear: { fontFamily: font.uiSemibold, fontSize: 15, color: colors.brand.DEFAULT },
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
