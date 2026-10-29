import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextInputInstance,
} from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import {
  SEARCH_PLACEHOLDER,
  formatMoney,
  type ProductCardData,
  type SearchFilterGroup,
  type SearchSort,
  type SearchSuggestions,
} from '@youmart/shared-client';
import { api } from '@/lib/api';
import {
  countSearchFilters,
  emptySearchFilters,
  searchFiltered,
  type SearchFilters,
} from '@/lib/catalog';
import { SearchFilterSheet } from '@/components/SearchFilterSheet';
import { getJSON, setJSON } from '@/lib/storage';
import { ProductCard } from '@/components/ProductCard';
import { VoiceSearchSheet } from '@/components/VoiceSearchSheet';
import { CategoryCard } from '@/components/CategoryCard';
import { BrandLogo } from '@/components/BrandLogo';
import { searchCategories, type CategoryMatch } from '@/lib/home-categories';
import { colors, font, radii, space } from '@/theme';

// v1.17 Search, Amazon / Flipkart style. Empty box: recent + popular searches. While typing: a
// suggestion panel - matching categories, word completions ("vermi" -> vermicompost), brands (logo
// + product count) and the best products - from /search/suggest. Submitting (keyboard, a
// completion, "See all") shows the results grid with sort chips and an optional brand filter.
// Matching is whole-word + semantic on the server, so "car" never brings up carpets.

const PER_PAGE = 40;
const RECENT_KEY = 'ym_recent_searches';
const MAX_RECENT = 8;
const BRAND = colors.brand.DEFAULT;
const POPULAR = [
  'Vermicompost',
  'iPhone',
  'Potting mix',
  'Diapers',
  'Earbuds',
  'Cow dung manure',
  'Chargers',
  'Neem cake',
];
const SORTS: { key: SearchSort; label: string }[] = [
  { key: 'relevance', label: 'Relevance' },
  { key: 'price_asc', label: 'Price: Low to High' },
  { key: 'price_desc', label: 'Price: High to Low' },
  { key: 'newest', label: 'Newest' },
];

type Results = { products: ProductCardData[]; total: number; page: number };
type Submitted = { term: string; sort: SearchSort; filters: SearchFilters };
type Offered = { groups: SearchFilterGroup[]; price: { min: number; max: number } | null };

export default function SearchScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { q } = useLocalSearchParams<{ q?: string }>();
  const [query, setQuery] = useState(String(q ?? ''));
  const [submitted, setSubmitted] = useState<Submitted | null>(null);
  const [results, setResults] = useState<Results | null>(null);
  // The filters the results offer (kept from the last page-1 response) + the sheet's visibility.
  const [offered, setOffered] = useState<Offered>({ groups: [], price: null });
  const [sheet, setSheet] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [suggest, setSuggest] = useState<SearchSuggestions | null>(null);
  const [recent, setRecent] = useState<string[]>([]);
  const [voice, setVoice] = useState(false);
  const inputRef = useRef<TextInputInstance>(null);
  const reqId = useRef(0);
  const sugId = useRef(0);

  useEffect(() => {
    void getJSON<string[]>(RECENT_KEY).then((r) => setRecent(r ?? []));
    if (q) submit(String(q));
    else {
      const t = setTimeout(() => inputRef.current?.focus(), 300);
      return () => clearTimeout(t);
    }
    // Only on open: `q` is the initial query from the link.
  }, []);

  const term = query.trim();
  // Showing results only while the box still says what was searched; editing it goes back to
  // suggestions.
  const showResults = submitted !== null && submitted.term.toLowerCase() === term.toLowerCase();

  // Suggestions as the user types.
  useEffect(() => {
    if (showResults || term.length < 2) {
      setSuggest(null);
      return;
    }
    const id = (sugId.current += 1);
    const t = setTimeout(() => {
      api.search
        .suggest(term, 5)
        .then((s) => sugId.current === id && setSuggest(s))
        .catch(() => sugId.current === id && setSuggest(null));
    }, 180);
    return () => clearTimeout(t);
  }, [term, showResults]);

  // Results for the submitted search (and whenever its sort / brand changes).
  useEffect(() => {
    if (!submitted) return;
    const id = (reqId.current += 1);
    setLoading(true);
    searchFiltered(submitted.term, 1, PER_PAGE, submitted.sort, submitted.filters)
      .then((res) => {
        if (reqId.current !== id) return;
        setResults({ products: res.products, total: res.total, page: 1 });
        setOffered({ groups: res.filters, price: res.price });
      })
      .catch(() => reqId.current === id && setResults({ products: [], total: 0, page: 1 }))
      .finally(() => reqId.current === id && setLoading(false));
  }, [submitted]);

  const remember = (text: string) => {
    const next = [text, ...recent.filter((r) => r.toLowerCase() !== text.toLowerCase())].slice(
      0,
      MAX_RECENT,
    );
    setRecent(next);
    void setJSON(RECENT_KEY, next);
  };

  function submit(text: string, brand: string | null = null) {
    const t = text.trim();
    if (!t) return;
    setQuery(t);
    setResults(null);
    setOffered({ groups: [], price: null });
    setSubmitted({
      term: t,
      sort: 'relevance',
      filters: { ...emptySearchFilters(), brands: brand ? [brand] : [] },
    });
    remember(t);
    inputRef.current?.blur();
  }

  const loadMore = useCallback(async () => {
    if (!submitted || !results || loadingMore || results.products.length >= results.total) return;
    setLoadingMore(true);
    const id = reqId.current;
    try {
      const res = await searchFiltered(
        submitted.term,
        results.page + 1,
        PER_PAGE,
        submitted.sort,
        submitted.filters,
      );
      if (reqId.current !== id) return;
      setResults((prev) =>
        prev
          ? { products: [...prev.products, ...res.products], total: res.total, page: prev.page + 1 }
          : prev,
      );
    } catch {
      /* keep what we have */
    } finally {
      setLoadingMore(false);
    }
  }, [submitted, results, loadingMore]);

  const categories = useMemo(() => searchCategories(term, 8), [term]);
  const openCategory = useCallback(
    (c: CategoryMatch) =>
      router.push(`/category/${c.path[c.path.length - 1]}?taxo=${c.path.join('~')}`),
    [router],
  );
  const tap = () => void Haptics.selectionAsync().catch(() => undefined);

  const categoryStrip =
    categories.length > 0 ? (
      <View style={styles.catBlock}>
        <Text style={styles.blockTitle}>Categories</Text>
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

  /** Recent + popular, shown with an empty box. */
  const start = (
    <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.panel}>
      {recent.length > 0 ? (
        <View style={styles.block}>
          <View style={styles.blockHead}>
            <Text style={styles.blockTitle}>Recent searches</Text>
            <Pressable
              hitSlop={8}
              onPress={() => {
                setRecent([]);
                void setJSON(RECENT_KEY, []);
              }}
            >
              <Text style={styles.clear}>Clear</Text>
            </Pressable>
          </View>
          {recent.map((r) => (
            <Pressable key={r} style={styles.row} onPress={() => submit(r)}>
              <Ionicons name="time-outline" size={18} color={colors.text.muted} />
              <Text style={styles.rowText} numberOfLines={1}>
                {r}
              </Text>
              <Pressable
                hitSlop={10}
                onPress={() => {
                  const next = recent.filter((x) => x !== r);
                  setRecent(next);
                  void setJSON(RECENT_KEY, next);
                }}
              >
                <Ionicons name="close" size={17} color={colors.text.muted} />
              </Pressable>
            </Pressable>
          ))}
        </View>
      ) : null}
      <View style={styles.block}>
        <Text style={styles.blockTitle}>Popular on YouMart</Text>
        <View style={styles.chips}>
          {POPULAR.map((p) => (
            <Pressable key={p} style={styles.chip} onPress={() => submit(p)}>
              <Ionicons name="trending-up" size={14} color={BRAND} />
              <Text style={styles.chipText}>{p}</Text>
            </Pressable>
          ))}
        </View>
      </View>
    </ScrollView>
  );

  /** The live suggestion panel while typing. */
  const suggestions = (
    <ScrollView
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
      contentContainerStyle={styles.panel}
    >
      {categoryStrip}
      {suggest?.completions.length ? (
        <View style={styles.block}>
          {suggest.completions.map((c) => (
            <Pressable key={c} style={styles.row} onPress={() => submit(c)}>
              <Ionicons name="search" size={17} color={colors.text.muted} />
              <Text style={styles.rowText} numberOfLines={1}>
                <Text style={styles.rowTyped}>{c.slice(0, term.length)}</Text>
                {c.slice(term.length)}
              </Text>
              <Pressable
                hitSlop={10}
                onPress={() => setQuery(`${c} `)}
                accessibilityLabel={`Fill in ${c}`}
              >
                <Ionicons
                  name="arrow-up-outline"
                  size={17}
                  color={colors.text.muted}
                  style={styles.fill}
                />
              </Pressable>
            </Pressable>
          ))}
        </View>
      ) : null}
      {suggest?.brands.length ? (
        <View style={styles.block}>
          <Text style={styles.blockTitle}>Brands</Text>
          {suggest.brands.map((b) => (
            <Pressable
              key={b.value}
              style={styles.row}
              onPress={() => {
                tap();
                submit(b.value, b.value);
              }}
            >
              <View style={styles.brandLogo}>
                <BrandLogo name={b.value} width={40} height={28} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.rowText} numberOfLines={1}>
                  {b.value}
                </Text>
                <Text style={styles.rowSub}>
                  Brand · {b.count} product{b.count === 1 ? '' : 's'}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color={colors.text.muted} />
            </Pressable>
          ))}
        </View>
      ) : null}
      {suggest?.items.length ? (
        <View style={styles.block}>
          <Text style={styles.blockTitle}>Products</Text>
          {suggest.items.map((p) => (
            <Pressable
              key={p.id}
              style={styles.row}
              onPress={() => router.push(`/product/${p.slug}`)}
            >
              <View style={styles.thumb}>
                {p.primaryImageUrl ? (
                  <Image
                    source={{ uri: p.primaryImageUrl }}
                    style={styles.thumbImg}
                    contentFit="contain"
                  />
                ) : (
                  <Ionicons name="image-outline" size={20} color={colors.card.border} />
                )}
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.rowText} numberOfLines={2}>
                  {p.title}
                </Text>
                <Text style={styles.rowPrice}>{formatMoney(p.price)}</Text>
              </View>
            </Pressable>
          ))}
        </View>
      ) : null}
      {term.length >= 2 ? (
        <Pressable style={styles.seeAll} onPress={() => submit(term)}>
          <Ionicons name="search" size={17} color={BRAND} />
          <Text style={styles.seeAllText} numberOfLines={1}>
            See all results for “{term}”
          </Text>
          <Ionicons name="arrow-forward" size={16} color={BRAND} />
        </Pressable>
      ) : null}
      {suggest && !suggest.items.length && !suggest.brands.length && !categories.length ? (
        <Text style={styles.noSuggest}>No matches for “{term}” yet - try another word.</Text>
      ) : null}
    </ScrollView>
  );

  const activeFilters = submitted ? countSearchFilters(submitted.filters) : 0;
  const resultsHeader = submitted ? (
    <View>
      {categoryStrip}
      <View style={styles.resultsHead}>
        <Text style={styles.count}>
          {results ? `${results.total} result${results.total === 1 ? '' : 's'}` : 'Searching'} for “
          {submitted.term}”
        </Text>
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.sortRow}
      >
        <Pressable
          style={[styles.sortChip, styles.filterChip, activeFilters > 0 && styles.filterChipOn]}
          onPress={() => {
            tap();
            setSheet(true);
          }}
          accessibilityLabel="More filters"
        >
          <Ionicons
            name="options-outline"
            size={15}
            color={activeFilters > 0 ? colors.white : BRAND}
          />
          <Text style={[styles.filterText, activeFilters > 0 && styles.sortTextOn]}>Filters</Text>
          {activeFilters > 0 ? (
            <View style={styles.filterBadge}>
              <Text style={styles.filterBadgeText}>{activeFilters}</Text>
            </View>
          ) : null}
        </Pressable>
        {SORTS.map((s) => {
          const on = submitted.sort === s.key;
          return (
            <Pressable
              key={s.key}
              style={[styles.sortChip, on && styles.sortChipOn]}
              onPress={() => {
                tap();
                setSubmitted({ ...submitted, sort: s.key });
              }}
            >
              <Text style={[styles.sortText, on && styles.sortTextOn]}>{s.label}</Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  ) : null;

  let body: ReactNode;
  if (!showResults) body = term.length < 2 ? start : suggestions;
  else if (loading && !results)
    body = (
      <View style={styles.flex}>
        {resultsHeader}
        <View style={styles.hint}>
          <ActivityIndicator size="large" color={BRAND} />
        </View>
      </View>
    );
  else if (!results || results.products.length === 0)
    body = (
      <View style={styles.flex}>
        {resultsHeader}
        <View style={styles.hint}>
          <Ionicons
            name={categories.length ? 'grid-outline' : 'search-outline'}
            size={44}
            color={colors.card.border}
          />
          <Text style={styles.hintText}>
            {categories.length
              ? `No products for “${submitted!.term}”${activeFilters ? ' with these filters' : ' yet - browse the categories above'}.`
              : `No products found for “${submitted!.term}”. Try a different or more general word.`}
          </Text>
          {activeFilters > 0 ? (
            <Pressable
              style={styles.clearFilters}
              onPress={() => {
                setResults(null);
                setSubmitted((cur) => (cur ? { ...cur, filters: emptySearchFilters() } : cur));
              }}
            >
              <Text style={styles.clearFiltersText}>Clear filters</Text>
            </Pressable>
          ) : null}
        </View>
      </View>
    );
  else
    body = (
      <FlatList
        data={results.products}
        keyExtractor={(p) => p.id}
        numColumns={2}
        columnWrapperStyle={styles.col}
        contentContainerStyle={styles.grid}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        onEndReached={loadMore}
        onEndReachedThreshold={1.2}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={resultsHeader ?? undefined}
        renderItem={({ item }) => <ProductCard product={item} />}
        ListFooterComponent={
          loadingMore ? <ActivityIndicator color={BRAND} style={{ margin: space.lg }} /> : undefined
        }
      />
    );

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
            onSubmitEditing={() => submit(query)}
          />
          {query.length > 0 ? (
            <Pressable
              onPress={() => {
                setQuery('');
                setSubmitted(null);
                inputRef.current?.focus();
              }}
              hitSlop={8}
            >
              <Ionicons name="close-circle" size={18} color={colors.text.placeholder} />
            </Pressable>
          ) : null}
          <Pressable
            style={styles.scan}
            onPress={() => router.push('/lens')}
            hitSlop={8}
            accessibilityLabel="Search with a photo"
          >
            <Ionicons name="camera-outline" size={20} color={BRAND} />
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
      {submitted ? (
        <SearchFilterSheet
          visible={sheet}
          groups={offered.groups}
          price={offered.price}
          value={submitted.filters}
          onClose={() => setSheet(false)}
          onApply={(filters) => {
            setResults(null);
            setSubmitted((cur) => (cur ? { ...cur, filters } : cur));
          }}
        />
      ) : null}
      <VoiceSearchSheet
        visible={voice}
        onClose={() => setVoice(false)}
        onResult={(text) => {
          setVoice(false);
          submit(text);
        }}
      />
      {body}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.page },
  flex: { flex: 1 },
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
    borderRadius: radii.tile,
    paddingLeft: space.md,
    paddingRight: 4,
    height: 42,
    backgroundColor: colors.white,
  },
  input: { flex: 1, fontFamily: font.body, fontSize: 15, color: colors.text.input },
  scan: { width: 30, height: 30, alignItems: 'center', justifyContent: 'center' },
  mic: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: BRAND,
    alignItems: 'center',
    justifyContent: 'center',
  },
  panel: { paddingBottom: space.xxl },
  block: { paddingTop: space.md, gap: 2 },
  blockHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingRight: space.lg,
  },
  blockTitle: {
    fontFamily: font.uiBold,
    fontSize: 13,
    letterSpacing: 0.4,
    color: colors.text.muted,
    textTransform: 'uppercase',
    paddingHorizontal: space.lg,
    paddingBottom: 6,
  },
  clear: { fontFamily: font.uiBold, fontSize: 13, color: BRAND },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: space.lg,
    paddingVertical: 10,
  },
  rowText: { flex: 1, fontFamily: font.uiMedium, fontSize: 14.5, color: colors.text.strong },
  rowTyped: { fontFamily: font.uiBold, color: colors.heading },
  rowSub: { fontFamily: font.uiMedium, fontSize: 11.5, color: colors.text.muted, marginTop: 1 },
  rowPrice: { fontFamily: font.uiBold, fontSize: 13, color: colors.heading, marginTop: 2 },
  fill: { transform: [{ rotate: '-45deg' }] },
  brandLogo: {
    width: 48,
    height: 36,
    borderRadius: 10,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: '#e3e8f1',
    alignItems: 'center',
    justifyContent: 'center',
  },
  thumb: {
    width: 48,
    height: 48,
    borderRadius: 10,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  thumbImg: { width: '90%', height: '90%' },
  seeAll: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginHorizontal: space.lg,
    marginTop: space.md,
    paddingHorizontal: space.md,
    paddingVertical: 12,
    borderRadius: 14,
    backgroundColor: '#eaf1ff',
  },
  seeAllText: { flex: 1, fontFamily: font.uiBold, fontSize: 14, color: BRAND },
  noSuggest: {
    fontFamily: font.body,
    fontSize: 13.5,
    color: colors.text.body,
    paddingHorizontal: space.lg,
    paddingTop: space.lg,
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingHorizontal: space.lg },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#dbe4f3',
    backgroundColor: colors.white,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  chipText: { fontFamily: font.uiSemibold, fontSize: 13, color: colors.text.strong },
  hint: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: space.md },
  hintText: {
    fontFamily: font.body,
    fontSize: 14,
    color: colors.text.body,
    textAlign: 'center',
    paddingHorizontal: space.xl,
  },
  grid: { paddingBottom: space.lg, gap: space.md },
  col: { gap: space.md, paddingHorizontal: space.lg },
  resultsHead: { paddingHorizontal: space.lg },
  count: { fontFamily: font.uiMedium, fontSize: 13, color: colors.text.body },
  sortRow: { gap: 8, paddingHorizontal: space.lg, paddingVertical: space.md },
  sortChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#dbe4f3',
    backgroundColor: colors.white,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  sortChipOn: { backgroundColor: BRAND, borderColor: BRAND },
  sortText: { fontFamily: font.uiSemibold, fontSize: 12.5, color: colors.text.strong },
  sortTextOn: { color: colors.white },
  filterChip: { borderColor: BRAND, borderWidth: 1.5 },
  filterChipOn: { backgroundColor: BRAND },
  filterText: { fontFamily: font.uiBold, fontSize: 12.5, color: BRAND },
  filterBadge: {
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    paddingHorizontal: 5,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterBadgeText: { fontFamily: font.uiBold, fontSize: 10.5, color: BRAND },
  clearFilters: {
    backgroundColor: BRAND,
    borderRadius: radii.tile,
    paddingHorizontal: 22,
    paddingVertical: 10,
  },
  clearFiltersText: { fontFamily: font.uiBold, fontSize: 14, color: colors.white },
  catBlock: { paddingTop: space.xs, paddingBottom: space.md, gap: space.sm },
  catRow: { paddingHorizontal: space.lg, gap: space.sm },
  catItem: { width: 104, gap: 4 },
  catCard: { flex: 0 },
  catTrail: {
    fontFamily: font.body,
    fontSize: 10.5,
    color: colors.text.muted,
    textAlign: 'center',
  },
});
