import { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import type { ApiCategory } from '@youmart/shared-client';
import { api } from '@/lib/api';
import { AppHeader } from '@/components/AppHeader';
import { colors, font, radii, space } from '@/theme';

export default function CategoriesScreen() {
  const router = useRouter();
  const [cats, setCats] = useState<ApiCategory[] | null>(null);

  useEffect(() => {
    let active = true;
    api.catalog
      .listCategories()
      .then((r) => active && setCats(r.items))
      .catch(() => active && setCats([]));
    return () => {
      active = false;
    };
  }, []);

  return (
    <View style={styles.screen}>
      <AppHeader />
      {!cats ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.brand.DEFAULT} size="large" />
        </View>
      ) : (
        <FlatList
          data={cats}
          keyExtractor={(c) => c.id}
          contentContainerStyle={styles.list}
          ListHeaderComponent={<Text style={styles.title}>All Categories</Text>}
          renderItem={({ item }) => (
            <Pressable
              style={({ pressed }) => [styles.row, pressed && styles.pressed]}
              onPress={() => router.push(`/category/${item.slug}`)}
            >
              <View style={styles.rowIcon}>
                <Ionicons name="pricetag-outline" size={18} color={colors.brand.DEFAULT} />
              </View>
              <Text style={styles.rowText}>{item.name}</Text>
              <Ionicons name="chevron-forward" size={18} color={colors.text.chevron} />
            </Pressable>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.page },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  list: { padding: space.lg, gap: space.sm },
  title: { fontFamily: font.uiBold, fontSize: 20, color: colors.heading, marginBottom: space.sm },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    backgroundColor: colors.white,
    borderRadius: radii.tile,
    padding: space.md,
    borderWidth: 1,
    borderColor: colors.card.border,
  },
  pressed: { opacity: 0.8 },
  rowIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.page,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowText: { flex: 1, fontFamily: font.uiMedium, fontSize: 15, color: colors.text.strong },
});
