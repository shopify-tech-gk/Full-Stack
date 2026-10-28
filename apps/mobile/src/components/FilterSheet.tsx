import { useEffect, useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import {
  LISTING_RATING_OPTIONS,
  LISTING_SORT_OPTIONS,
  selectedValues,
  withFilter,
  type CategoryFilter,
  type CategoryFilters,
  type ListingQuery,
} from '@youmart/shared-client';
import { colors, font, radii, space } from '@/theme';
import { emptyListingQuery } from '@/lib/catalog';

interface Props {
  visible: boolean;
  filters: CategoryFilters | null;
  query: ListingQuery;
  onClose: () => void;
  onApply: (next: ListingQuery) => void;
}

// v1.17 Flipkart / Amazon-style filters: filter names down the left, a tick-box checklist on the
// right. Attribute facets still come from each category's data-driven
// filter definition (W3) - every category gets this sheet with its own filters.

const BRAND = colors.brand.DEFAULT;
const SEARCH_FROM = 8; // a facet with more values than this gets a search box (Brand)
const PRICE_STEPS = [100, 200, 500, 1000, 2000, 5000, 10000, 20000, 50000];

type PriceBand = { label: string; min: number | null; max: number | null };
type Section =
  | { key: 'sort'; label: string }
  | { key: 'price'; label: string }
  | { key: 'rating'; label: string }
  | { key: string; label: string; facet: CategoryFilter };

const rupees = (n: number) => `₹${n.toLocaleString('en-IN')}`;

/** Price bands spanning the category's price range: "Under ₹200", "₹200 - ₹500", ... "Over ₹2,000". */
function priceBands(range: { min: number; max: number } | null): PriceBand[] {
  if (!range) return [];
  const steps = PRICE_STEPS.filter((s) => s > range.min && s < range.max);
  if (steps.length === 0) return [];
  const bands: PriceBand[] = [{ label: `Under ${rupees(steps[0]!)}`, min: null, max: steps[0]! }];
  for (let i = 1; i < steps.length; i++) {
    bands.push({
      label: `${rupees(steps[i - 1]!)} - ${rupees(steps[i]!)}`,
      min: steps[i - 1]!,
      max: steps[i]!,
    });
  }
  const last = steps[steps.length - 1]!;
  bands.push({ label: `Over ${rupees(last)}`, min: last, max: null });
  return bands;
}

/** "Up to 1 kg" < "1 - 5 kg" < ... and "10% off" < "25% off": bands read best in numeric order. */
function orderValues(facet: CategoryFilter) {
  const values = [...(facet.values ?? [])];
  if (!facet.key.endsWith('_band')) return values;
  const lead = (v: string) =>
    /^(up to|under)/i.test(v) ? -1 : parseFloat(v.replace(/[^\d.]/g, ' ').trim()) || 0;
  return values.sort((a, b) => lead(a.value) - lead(b.value));
}

const valueLabel = (facet: CategoryFilter, v: string) =>
  facet.type === 'boolean' ? (v === 'true' ? 'Yes' : v === 'false' ? 'No' : v) : v;

export function FilterSheet({ visible, filters, query, onClose, onApply }: Props) {
  const [draft, setDraft] = useState<ListingQuery>(query);
  const [active, setActive] = useState('sort');
  const [search, setSearch] = useState('');

  useEffect(() => {
    if (visible) setDraft(query);
  }, [visible, query]);

  const bands = useMemo(() => priceBands(filters?.price ?? null), [filters]);
  const sections = useMemo<Section[]>(() => {
    const facets = (filters?.filters ?? []).filter((f) => f.values && f.values.length > 0);
    const out: Section[] = [{ key: 'sort', label: 'Sort by' }];
    // Brand first (Amazon / Flipkart put it at the top), then price, rating, the rest.
    const brand = facets.find((f) => f.key === 'brand');
    if (brand) out.push({ key: brand.key, label: brand.label, facet: brand });
    if (bands.length > 0) out.push({ key: 'price', label: 'Price' });
    out.push({ key: 'rating', label: 'Customer Ratings' });
    for (const f of facets)
      if (f.key !== 'brand') out.push({ key: f.key, label: f.label, facet: f });
    return out;
  }, [filters, bands]);

  useEffect(() => setSearch(''), [active]);
  const current = sections.find((s) => s.key === active) ?? sections[0]!;

  const update = (next: Partial<ListingQuery>) => {
    void Haptics.selectionAsync().catch(() => undefined);
    setDraft((d) => ({ ...d, ...next, page: 1 }));
  };
  const toggleFacet = (key: string, value: string) => {
    const cur = selectedValues(draft, key);
    const next = cur.includes(value) ? cur.filter((v) => v !== value) : [...cur, value];
    update({ filters: withFilter(draft.filters, key, next.join(',') || null) });
  };

  /** How many picks a section has (the number badge on the left). */
  const picked = (s: Section): number => {
    if (s.key === 'sort') return draft.sort !== 'default' ? 1 : 0;
    if (s.key === 'price') return draft.minPrice != null || draft.maxPrice != null ? 1 : 0;
    if (s.key === 'rating') return draft.minRating ? 1 : 0;
    return selectedValues(draft, s.key).length;
  };
  const totalPicked = sections.filter((s) => s.key !== 'sort').reduce((n, s) => n + picked(s), 0);

  const renderRight = () => {
    if (current.key === 'sort') {
      return LISTING_SORT_OPTIONS.map((o) => (
        <CheckRow
          key={o.value}
          round
          label={o.label}
          on={draft.sort === o.value}
          onPress={() => update({ sort: o.value })}
        />
      ));
    }
    if (current.key === 'price') {
      return bands.map((b) => {
        const on = draft.minPrice === b.min && draft.maxPrice === b.max;
        return (
          <CheckRow
            key={b.label}
            label={b.label}
            on={on}
            onPress={() =>
              update(on ? { minPrice: null, maxPrice: null } : { minPrice: b.min, maxPrice: b.max })
            }
          />
        );
      });
    }
    if (current.key === 'rating') {
      return LISTING_RATING_OPTIONS.filter((o) => o.value > 0).map((o) => {
        const on = draft.minRating === o.value;
        return (
          <CheckRow
            key={o.value}
            label={o.label}
            star
            on={on}
            onPress={() => update({ minRating: on ? 0 : o.value })}
          />
        );
      });
    }
    if (!('facet' in current)) return null;
    const facet = current.facet;
    const values = orderValues(facet);
    const q = search.trim().toLowerCase();
    const shown = q ? values.filter((v) => v.value.toLowerCase().includes(q)) : values;
    const sel = selectedValues(draft, facet.key);
    return (
      <>
        {values.length > SEARCH_FROM ? (
          <View style={styles.search}>
            <Ionicons name="search" size={16} color={colors.text.muted} />
            <TextInput
              value={search}
              onChangeText={setSearch}
              placeholder={`Search ${facet.label.toLowerCase()}`}
              placeholderTextColor={colors.text.muted}
              style={styles.searchInput}
              autoCorrect={false}
            />
            {search ? (
              <Pressable onPress={() => setSearch('')} hitSlop={8}>
                <Ionicons name="close-circle" size={16} color={colors.text.muted} />
              </Pressable>
            ) : null}
          </View>
        ) : null}
        {shown.map((v) => (
          <CheckRow
            key={v.value}
            label={valueLabel(facet, v.value)}
            on={sel.includes(v.value)}
            onPress={() => toggleFacet(facet.key, v.value)}
          />
        ))}
        {shown.length === 0 ? <Text style={styles.none}>No matches</Text> : null}
      </>
    );
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} />
      <View style={styles.sheet}>
        <View style={styles.handle} />
        <View style={styles.headerRow}>
          <Text style={styles.header}>Filters</Text>
          <Pressable
            onPress={() => setDraft(emptyListingQuery())}
            hitSlop={8}
            disabled={totalPicked === 0 && draft.sort === 'default'}
          >
            <Text
              style={[
                styles.clearAll,
                totalPicked === 0 && draft.sort === 'default' && { opacity: 0.4 },
              ]}
            >
              CLEAR ALL
            </Text>
          </Pressable>
        </View>

        <View style={styles.body}>
          <ScrollView style={styles.left} showsVerticalScrollIndicator={false}>
            {sections.map((s) => {
              const on = s.key === current.key;
              const n = picked(s);
              return (
                <Pressable
                  key={s.key}
                  onPress={() => setActive(s.key)}
                  style={[styles.tab, on && styles.tabOn]}
                >
                  {on ? <View style={styles.tabBar} /> : null}
                  <Text style={[styles.tabText, on && styles.tabTextOn]} numberOfLines={2}>
                    {s.label}
                  </Text>
                  {n > 0 && s.key !== 'sort' ? (
                    <View style={styles.badge}>
                      <Text style={styles.badgeText}>{n}</Text>
                    </View>
                  ) : n > 0 ? (
                    <View style={styles.dot} />
                  ) : null}
                </Pressable>
              );
            })}
          </ScrollView>
          <ScrollView
            style={styles.right}
            contentContainerStyle={styles.rightBody}
            keyboardShouldPersistTaps="handled"
          >
            <Text style={styles.rightTitle}>{current.label}</Text>
            {renderRight()}
          </ScrollView>
        </View>

        <View style={styles.footer}>
          <Pressable style={styles.close} onPress={onClose}>
            <Text style={styles.closeText}>Close</Text>
          </Pressable>
          <Pressable
            style={styles.apply}
            onPress={() => {
              // Close first, apply once the sheet has slid away: reloading the listing while the
              // native modal is still animating out could leave an invisible layer over the
              // screen on iOS that swallowed every tap (Add to cart did nothing).
              const next = { ...draft, page: 1 };
              onClose();
              setTimeout(() => onApply(next), 320);
            }}
          >
            <Text style={styles.applyText}>Apply{totalPicked > 0 ? ` (${totalPicked})` : ''}</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

function CheckRow({
  label,
  on,
  onPress,
  round,
  star,
}: {
  label: string;
  on: boolean;
  onPress: () => void;
  round?: boolean;
  star?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed && { backgroundColor: '#f4f7fc' }]}
      accessibilityRole={round ? 'radio' : 'checkbox'}
      accessibilityState={{ checked: on }}
    >
      <View
        style={[round ? styles.radio : styles.box, on && (round ? styles.radioOn : styles.boxOn)]}
      >
        {on ? (
          round ? (
            <View style={styles.radioDot} />
          ) : (
            <Ionicons name="checkmark" size={14} color={colors.white} />
          )
        ) : null}
      </View>
      <Text style={[styles.rowText, on && styles.rowTextOn]} numberOfLines={2}>
        {star ? label.replace(/★.*$/, '') : label}
        {star ? <Text style={styles.star}>{'★'}</Text> : null}
        {star ? ' & above' : null}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: colors.overlay },
  sheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: '86%',
    backgroundColor: colors.white,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    paddingBottom: space.xxl,
    overflow: 'hidden',
  },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.card.border,
    marginTop: space.md,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: space.xl,
    paddingVertical: space.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.menu,
  },
  header: { fontFamily: font.uiBold, fontSize: 18, color: colors.heading },
  clearAll: { fontFamily: font.uiBold, fontSize: 13, letterSpacing: 0.5, color: BRAND },
  body: { flex: 1, flexDirection: 'row' },
  left: { width: '36%', flexGrow: 0, backgroundColor: '#f3f6fb' },
  tab: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingLeft: space.lg,
    paddingRight: space.sm,
    paddingVertical: 15,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e3e8f1',
  },
  tabOn: { backgroundColor: colors.white },
  tabBar: {
    position: 'absolute',
    left: 0,
    top: 8,
    bottom: 8,
    width: 3.5,
    borderTopRightRadius: 3,
    borderBottomRightRadius: 3,
    backgroundColor: BRAND,
  },
  tabText: { flex: 1, fontFamily: font.uiMedium, fontSize: 13.5, color: colors.text.body },
  tabTextOn: { fontFamily: font.uiBold, color: colors.heading },
  badge: {
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    paddingHorizontal: 5,
    backgroundColor: BRAND,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: { fontFamily: font.uiBold, fontSize: 10.5, color: colors.white },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: BRAND },
  right: { flex: 1 },
  rightBody: { paddingHorizontal: space.md, paddingBottom: space.lg },
  rightTitle: {
    fontFamily: font.uiBold,
    fontSize: 12,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    color: colors.text.muted,
    paddingHorizontal: space.sm,
    paddingTop: space.lg,
    paddingBottom: space.sm,
  },
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: space.sm,
    marginBottom: space.sm,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#dbe4f3',
    backgroundColor: '#fafcff',
  },
  searchInput: {
    flex: 1,
    paddingVertical: 9,
    fontFamily: font.ui,
    fontSize: 14,
    color: colors.text.strong,
  },
  none: {
    fontFamily: font.body,
    fontSize: 13,
    color: colors.text.muted,
    padding: space.md,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: space.sm,
    paddingVertical: 12,
    borderRadius: 10,
  },
  box: {
    width: 20,
    height: 20,
    borderRadius: 5,
    borderWidth: 1.6,
    borderColor: '#9aa8bf',
    alignItems: 'center',
    justifyContent: 'center',
  },
  boxOn: { backgroundColor: BRAND, borderColor: BRAND },
  radio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1.6,
    borderColor: '#9aa8bf',
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioOn: { borderColor: BRAND },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: BRAND },
  rowText: { flex: 1, fontFamily: font.ui, fontSize: 14, color: colors.text.strong },
  rowTextOn: { fontFamily: font.uiSemibold, color: colors.heading },
  star: { color: '#f5a524' },
  footer: {
    flexDirection: 'row',
    gap: space.md,
    paddingHorizontal: space.xl,
    paddingTop: space.md,
    borderTopWidth: 1,
    borderTopColor: colors.border.menu,
  },
  close: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.button,
    borderWidth: 1,
    borderColor: colors.card.border,
    paddingVertical: 14,
  },
  closeText: { fontFamily: font.uiSemibold, fontSize: 15, color: colors.text.strong },
  apply: {
    flex: 2,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.button,
    backgroundColor: BRAND,
    paddingVertical: 14,
  },
  applyText: { fontFamily: font.uiSemibold, fontSize: 15, color: colors.white },
});
