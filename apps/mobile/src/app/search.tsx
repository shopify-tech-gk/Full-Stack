import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
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
          />
          {query.length > 0 ? (
            <Pressable onPress={() => setQuery('')} hitSlop={8}>
              <Ionicons name="close-circle" size={18} color={colors.text.placeholder} />
            </Pressable>
          ) : null}
        </View>
      </View>

      {state.status === 'idle' ? (
        <View style={styles.hint}>
          <Ionicons name="search-outline" size={48} color={colors.card.border} />
          <Text style={styles.hintText}>Search for products and brands</Text>
        </View>
      ) : state.status === 'loading' ? (
        <View style={styles.hint}>
          <ActivityIndicator size="large" color={colors.brand.DEFAULT} />
        </View>
      ) : state.results.products.length === 0 ? (
        <View style={styles.hint}>
          <Ionicons name="sad-outline" size={48} color={colors.card.border} />
          <Text style={styles.hintText}>No products found for “{state.results.term}”.</Text>
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
            <Text style={styles.count}>
              {state.results.total} result{state.results.total === 1 ? '' : 's'} for “
              {state.results.term}”
            </Text>
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
    paddingHorizontal: space.md,
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
});
