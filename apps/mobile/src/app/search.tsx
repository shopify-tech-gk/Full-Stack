import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SEARCH_PLACEHOLDER, type ProductCardData } from '@youmart/shared-client';
import { searchProductsPage } from '@/lib/catalog';
import { ProductCard } from '@/components/ProductCard';
import { VoiceSearchSheet } from '@/components/VoiceSearchSheet';
import { CategoryCard } from '@/components/CategoryCard';
import { searchCategories, type CategoryMatch } from '@/lib/home-categories';
import { colors, font, radii, space } from '@/theme';

const PER_PAGE = 50;

type Results = { term: string; products: ProductCardData[]; total: number; page: number };
type State = { status: 'idle' } | { status: 'loading' } | { status: 'done'; results: Results };

export default function SearchScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { q } = useLocalSearchParams<{ q?: string }>();
  const [query, setQuery] = useState(String(q ?? ''));
  const [state, setState] = useState<State>({ status: 'idle' });
  const [loadingMore, setLoadingMore] = useState(false);
  const [voice, setVoice] = useState(false);
  const inputRef = useRef<TextInput>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Guards against stale responses when the user keeps typing.
  const reqId = useRef(0);

  useEffect(() => {
    const t = setTimeout(() => inputRef.current?.focus(), 300);
    return () => clearTimeout(t);
  }, []);

  // Debounced first-page search as the user types.
  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    const term = query.trim();
    if (term.length < 2) {
      reqId.current += 1;
      setState({ status: 'idle' });
      return;
    }
    setState({ status: 'loading' });
    const id = (reqId.current += 1);
    timer.current = setTimeout(() => {
      searchProductsPage(term, 1, PER_PAGE)
        .then((res) => {
          if (reqId.current !== id) return;
          setState({
            status: 'done',
            results: { term, products: res.products, total: res.total, page: 1 },
          });
        })
        .catch(() => {
          if (reqId.current !== id) return;
          setState({ status: 'done', results: { term, products: [], total: 0, page: 1 } });
        });
    }, 350);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [query]);

  const loadMore = useCallback(async () => {
    if (state.status !== 'done' || loadingMore) return;
    const { term, products, total, page } = state.results;
    if (products.length >= total) return;
    setLoadingMore(true);
    const id = reqId.current;
    try {
      const res = await searchProductsPage(term, page + 1, PER_PAGE);
      if (reqId.current !== id) return;
      setState((prev) =>
        prev.status === 'done'
          ? {
              status: 'done',
              results: {
                ...prev.results,
                products: [...prev.results.products, ...res.products],
                total: res.total,
                page: page + 1,
              },
            }
          : prev,
      );
    } catch {
      /* keep what we have */
    } finally {
      setLoadingMore(false);
    }
  }, [state, loadingMore]);

  // Categories whose name matches - searching "religion" or "clothing" offers the category itself
  // (its sub-categories + brands), even when no product matches yet.
  const categories = useMemo(() => searchCategories(query), [query]);
  const openCategory = useCallback(
    (c: CategoryMatch) =>
      router.push(`/category/${c.path[c.path.length - 1]}?taxo=${c.path.join('~')}`),
    [router],
  );
  const onSubmit = () => {
    const exact = categories.find((c) => c.exact);
    if (exact) openCategory(exact);
  };

  const categoryStrip =
    categories.length > 0 ? (
      <View style={styles.catBlock}>
        <Text style={styles.catTitle}>Categories</Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.catRow}
        >
          {categories.map((c) => (
            <View key={c.path.join('/')} style={styles.catItem}>
              <CategoryCard
                name={c.name}
                imageKey={c.imageKey}
                compact
                style={styles.catCard}
                onPress={() => openCategory(c)}
              />
              {c.trail ? (
                <Text style={styles.catTrail} numberOfLines={1}>
                  in {c.trail}
                </Text>
              ) : null}
            </View>
          ))}
        </ScrollView>
      </View>
    ) : null;

  return (
    <View style={[styles.screen, { paddingTop: insets.top + 6 }]}>
      <View style={styles.bar}>
        <Pressable onPress={() => router.back()} hitSlop={8}>
          <Ionicons name="arrow-back" size={24} color={colors.text.strong} />
        </Pressable>
        <View style={styles.field}>
          <Ionicons name="search" size={18} color={colors.text.placeholder} />
          <TextInput
            ref={inputRef}
            value={query}
            onChangeText={setQuery}
            placeholder={SEARCH_PLACEHOLDER}
            placeholderTextColor={colors.text.placeholder}
            style={styles.input}
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="search"
            onSubmitEditing={onSubmit}
          />
          {query.length > 0 ? (
            <Pressable onPress={() => setQuery('')} hitSlop={8}>
              <Ionicons name="close-circle" size={18} color={colors.text.placeholder} />
            </Pressable>
          ) : null}
          <Pressable
            style={styles.scan}
            onPress={() => router.push('/lens')}
            hitSlop={8}
            accessibilityLabel="Search with a photo"
          >
            <Ionicons name="camera-outline" size={20} color={colors.brand.DEFAULT} />
          </Pressable>
          <Pressable
            style={styles.mic}
            onPress={() => {
              inputRef.current?.blur();
              setVoice(true);
            }}
            hitSlop={8}
            accessibilityLabel="Search by voice"
          >
            <Ionicons name="mic" size={17} color={colors.white} />
          </Pressable>
        </View>
      </View>
      <VoiceSearchSheet
        visible={voice}
        onClose={() => setVoice(false)}
        onResult={(text) => {
          setVoice(false);
          setQuery(text);
        }}
      />

      {state.status === 'idle' ? (
        <View style={styles.hint}>
          <Ionicons name="search-outline" size={48} color={colors.card.border} />
          <Text style={styles.hintText}>Search for products, brands and categories</Text>
        </View>
      ) : state.status === 'loading' ? (
        <View style={styles.flex}>
          {categoryStrip}
          <View style={styles.hint}>
            <ActivityIndicator size="large" color={colors.brand.DEFAULT} />
          </View>
        </View>
      ) : state.results.products.length === 0 ? (
        <View style={styles.flex}>
          {categoryStrip}
          <View style={styles.hint}>
            <Ionicons
              name={categories.length ? 'grid-outline' : 'sad-outline'}
              size={44}
              color={colors.card.border}
            />
            <Text style={styles.hintText}>
              {categories.length
                ? `No products for “${state.results.term}” yet - browse the categories above.`
                : `No products found for “${state.results.term}”.`}
            </Text>
          </View>
        </View>
      ) : (
        <FlatList
          data={state.results.products}
          keyExtractor={(p) => p.id}
          numColumns={2}
          columnWrapperStyle={styles.col}
          contentContainerStyle={styles.grid}
          keyboardShouldPersistTaps="handled"
          onEndReached={loadMore}
          onEndReachedThreshold={1.2}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={
            <>
              {categoryStrip}
              <Text style={styles.count}>Results for “{state.results.term}”</Text>
            </>
          }
          renderItem={({ item }) => <ProductCard product={item} />}
          ListFooterComponent={
            loadingMore ? (
              <ActivityIndicator color={colors.brand.DEFAULT} style={{ margin: space.lg }} />
            ) : null
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.page },
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingHorizontal: space.lg,
    paddingBottom: space.md,
  },
  field: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 2,
    borderColor: colors.brand.accent,
    borderRadius: radii.pill,
    paddingLeft: space.md,
    paddingRight: 4,
    height: 42,
    backgroundColor: colors.white,
  },
  input: { flex: 1, fontFamily: font.body, fontSize: 15, color: colors.text.input },
  hint: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: space.md },
  hintText: {
    fontFamily: font.body,
    fontSize: 14,
    color: colors.text.body,
    textAlign: 'center',
    paddingHorizontal: space.xl,
  },
  grid: { padding: space.lg, gap: space.md },
  col: { gap: space.md },
  count: {
    fontFamily: font.uiMedium,
    fontSize: 13,
    color: colors.text.body,
    marginBottom: space.sm,
  },
  flex: { flex: 1 },
  catBlock: { paddingTop: space.xs, paddingBottom: space.md, gap: space.sm },
  catTitle: {
    fontFamily: font.uiBold,
    fontSize: 15,
    color: colors.heading,
    paddingHorizontal: space.lg,
  },
  catRow: { paddingHorizontal: space.lg, gap: space.sm },
  catItem: { width: 104, gap: 4 },
  catCard: { flex: 0 },
  catTrail: {
    fontFamily: font.body,
    fontSize: 10.5,
    color: colors.text.muted,
    textAlign: 'center',
  },
  scan: { width: 30, height: 30, alignItems: 'center', justifyContent: 'center' },
  mic: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: colors.brand.DEFAULT,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
