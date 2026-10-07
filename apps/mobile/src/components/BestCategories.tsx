import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import type { StoreSubcategory } from '@youmart/shared-client';
import { colors, font, radii, space } from '@/theme';

type BestCat = { title: string; items: readonly (StoreSubcategory & { href: string })[] };

/** "Best Categories Today" — a horizontal carousel of sub-category cards (live homepage section). */
export function BestCategories({ best }: { best: BestCat }) {
  const router = useRouter();
  return (
    <View style={styles.wrap}>
      <View style={styles.head}>
        <View style={styles.accent} />
        <Text style={styles.heading}>{best.title}</Text>
      </View>
      <FlatList
        horizontal
        data={best.items}
        keyExtractor={(s) => s.slug}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.list}
        ItemSeparatorComponent={() => <View style={{ width: space.md }} />}
        renderItem={({ item }) => (
          <Pressable style={styles.card} onPress={() => router.push(`/category/${item.slug}`)}>
            <View style={styles.thumb}>
              <Ionicons name="pricetags-outline" size={26} color={colors.brand.DEFAULT} />
            </View>
            <Text numberOfLines={2} style={styles.label}>
              {item.name}
            </Text>
          </Pressable>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginTop: space.xxl },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: space.md,
    paddingHorizontal: space.lg,
  },
  accent: { width: 4, height: 18, borderRadius: 2, backgroundColor: colors.brand.DEFAULT },
  heading: { fontFamily: font.uiBold, fontSize: 17, color: colors.heading, flexShrink: 1 },
  list: { paddingHorizontal: space.lg },
  card: { width: 104, alignItems: 'center', gap: 8 },
  thumb: {
    width: 104,
    height: 104,
    borderRadius: radii.categoryCard,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.card.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: { fontFamily: font.ui, fontSize: 12, color: colors.text.body, textAlign: 'center' },
});
