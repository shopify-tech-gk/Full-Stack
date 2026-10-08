import { useLayoutEffect, useMemo } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useNavigation, useRouter } from 'expo-router';
import { CategoryCard } from '@/components/CategoryCard';
import { browseNode, type CatNode } from '@/lib/home-categories';
import { colors, font, space } from '@/theme';

export default function BrowseScreen() {
  const params = useLocalSearchParams<{ path?: string | string[] }>();
  const router = useRouter();
  const navigation = useNavigation();

  const path = useMemo(
    () => (Array.isArray(params.path) ? params.path : params.path ? [params.path] : []),
    [params.path],
  );
  const node = useMemo(() => browseNode(path), [path]);

  const gridData = useMemo<(CatNode | { slug: string; spacer: true })[]>(() => {
    if (!node) return [];
    const items: (CatNode | { slug: string; spacer: true })[] = [...node.children];
    const rem = items.length % 3;
    if (rem !== 0) {
      for (let i = 0; i < 3 - rem; i += 1) items.push({ slug: `__spacer_${i}`, spacer: true });
    }
    return items;
  }, [node]);

  useLayoutEffect(() => {
    navigation.setOptions({ title: node?.name ?? 'Categories' });
  }, [navigation, node]);

  const openListing = (href: string, name: string, slug: string) => {
    if (href.startsWith('/search')) {
      router.push({ pathname: '/search', params: { q: name } });
    } else {
      const last = href.split('?')[0]?.split('/').filter(Boolean).pop() ?? slug;
      router.push(`/category/${last}`);
    }
  };

  const onPressChild = (child: CatNode) => {
    if (child.hasChildren) {
      router.push(`/browse/${[...path, child.slug].join('/')}`);
    } else {
      openListing(child.href, child.name, child.slug);
    }
  };

  if (!node) {
    return (
      <View style={styles.center}>
        <Ionicons name="cube-outline" size={48} color={colors.card.border} />
        <Text style={styles.emptyText}>Category not found.</Text>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <FlatList
        data={gridData}
        keyExtractor={(c) => c.slug}
        numColumns={3}
        columnWrapperStyle={styles.col}
        contentContainerStyle={styles.grid}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <View style={styles.head}>
            <Text style={styles.eyebrow}>Browse</Text>
            <Text style={styles.title}>{node.name}</Text>
            <Text style={styles.count}>
              {node.children.length} {node.children.length === 1 ? 'category' : 'categories'}
            </Text>
            <Pressable
              style={styles.shopBtn}
              onPress={() => openListing(node.href, node.name, path[path.length - 1] ?? '')}
            >
              <Text style={styles.shopText}>Shop all {node.name}</Text>
              <Ionicons name="arrow-forward" size={15} color={colors.white} />
            </Pressable>
          </View>
        }
        renderItem={({ item }) =>
          'spacer' in item ? (
            <View style={styles.slot} />
          ) : (
            <View style={styles.slot}>
              <CategoryCard
                name={item.name}
                hasChildren={item.hasChildren}
                onPress={() => onPressChild(item)}
              />
            </View>
          )
        }
        ListEmptyComponent={
          <View style={styles.center}>
            <Text style={styles.emptyText}>No sub-categories here.</Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.page },
  grid: { padding: space.lg, gap: space.md },
  col: { gap: space.md },
  slot: { flex: 1 },
  head: { marginBottom: space.lg },
  eyebrow: {
    fontFamily: font.uiSemibold,
    fontSize: 11.5,
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: colors.brand.DEFAULT,
  },
  title: { fontFamily: font.uiBold, fontSize: 22, color: colors.heading, marginTop: 2 },
  count: { fontFamily: font.uiMedium, fontSize: 13, color: colors.text.body, marginTop: 2 },
  shopBtn: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.brand.DEFAULT,
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 9,
    marginTop: space.md,
  },
  shopText: { fontFamily: font.uiSemibold, fontSize: 13.5, color: colors.white },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.md,
    paddingVertical: 60,
  },
  emptyText: { fontFamily: font.body, fontSize: 14, color: colors.text.body },
});
