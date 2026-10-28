import { useEffect, useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import type { SearchFilterGroup } from '@youmart/shared-client';
import { countSearchFilters, emptySearchFilters, type SearchFilters } from '@/lib/catalog';
import { colors, font, radii, space } from '@/theme';

// v1.17 "Filters" for search results, Amazon style: filter names on the left, tick boxes on the
// right; pick several, then Apply. The groups come from the results themselves
// (category, brand, product attributes like RAM / pack weight / organic), plus price bands from the
// results' price range, customer rating and discount.

const BRAND = colors.brand.DEFAULT;
const SEARCH_FROM = 8;
const PRICE_STEPS = [100, 200, 500, 1000, 2000, 5000, 10000, 20000, 50000, 100000];
const RATINGS = [4, 3, 2];
const DISCOUNTS = [10, 25, 40, 50, 70];

type Section =
  | { key: 'price' | 'rating' | 'discount'; label: string }
  | { key: string; label: string; group: SearchFilterGroup };

const rupees = (n: number) => `₹${n.toLocaleString('en-IN')}`;

function priceBands(range: { min: number; max: number } | null) {
  if (!range) return [];
  const steps = PRICE_STEPS.filter((s) => s > range.min && s < range.max);
  if (!steps.length) return [];
  const bands = [
    {
      label: `Under ${rupees(steps[0]!)}`,
      min: null as number | null,
      max: steps[0]! as number | null,
    },
  ];
  for (let i = 1; i < steps.length; i++) {
    bands.push({
      label: `${rupees(steps[i - 1]!)} - ${rupees(steps[i]!)}`,
      min: steps[i - 1]!,
      max: steps[i]!,
    });
  }
  bands.push({
    label: `Over ${rupees(steps[steps.length - 1]!)}`,
    min: steps[steps.length - 1]!,
    max: null,
  });
  return bands;
}

/** "8" + unit GB -> "8 GB"; booleans -> "Yes"; band-like values in size order. */
const valueLabel = (g: SearchFilterGroup, v: string) =>
  g.type === 'boolean' ? 'Yes' : g.unit && /^\d+(\.\d+)?$/.test(v) ? `${v} ${g.unit}` : v;
function ordered(g: SearchFilterGroup) {
  const vs = [...g.values];
  if (g.unit || g.key.endsWith('_band')) {
    const n = (v: string) =>
      /^(up to|under)/i.test(v) ? -1 : parseFloat(v.replace(/[^\d.]/g, ' ').trim()) || 0;
    vs.sort((a, b) => n(a.value) - n(b.value));
  }
  return vs;
}

export function SearchFilterSheet({
  visible,
  groups,
  price,
  value,
  onClose,
  onApply,
}: {
  visible: boolean;
  groups: SearchFilterGroup[];
  price: { min: number; max: number } | null;
  value: SearchFilters;
  onClose: () => void;
  onApply: (next: SearchFilters) => void;
}) {
  const [draft, setDraft] = useState<SearchFilters>(value);
  const [active, setActive] = useState('');
  const [search, setSearch] = useState('');

  useEffect(() => {
    if (visible) setDraft(value);
  }, [visible, value]);

  const bands = useMemo(() => priceBands(price), [price]);
  const sections = useMemo<Section[]>(() => {
    const byKey = (k: string) => groups.find((g) => g.key === k);
    const out: Section[] = [];
    for (const k of ['category', 'brand']) {
      const g = byKey(k);
      if (g) out.push({ key: g.key, label: g.label, group: g });
    }
    if (bands.length) out.push({ key: 'price', label: 'Price' });
    out.push({ key: 'rating', label: 'Customer Ratings' });
    out.push({ key: 'discount', label: 'Discount' });
    for (const g of groups) {
      if (g.key !== 'category' && g.key !== 'brand')
        out.push({ key: g.key, label: g.label, group: g });
    }
    return out;
  }, [groups, bands]);

  useEffect(() => setSearch(''), [active]);
  const current = sections.find((s) => s.key === active) ?? sections[0];
  const tap = () => void Haptics.selectionAsync().catch(() => undefined);

  const selected = (s: Section): string[] => {
    if (!('group' in s)) return [];
    if (s.key === 'brand') return draft.brands;
    if (s.key === 'category') return draft.categories;
    return draft.attributes[s.key] ?? [];
  };
  const toggle = (s: Section, v: string) => {
    tap();
    const cur = selected(s);
    const next = cur.includes(v) ? cur.filter((x) => x !== v) : [...cur, v];
    if (s.key === 'brand') setDraft((d) => ({ ...d, brands: next }));
    else if (s.key === 'category') setDraft((d) => ({ ...d, categories: next }));
    else setDraft((d) => ({ ...d, attributes: { ...d.attributes, [s.key]: next } }));
  };
  const picked = (s: Section): number => {
    if (s.key === 'price') return draft.minPrice != null || draft.maxPrice != null ? 1 : 0;
    if (s.key === 'rating') return draft.minRating ? 1 : 0;
    if (s.key === 'discount') return draft.minDiscount ? 1 : 0;
    return selected(s).length;
  };
  const total = countSearchFilters(draft);

  const renderRight = () => {
    if (!current) return null;
    if (current.key === 'price') {
      return bands.map((b) => {
        const on = draft.minPrice === b.min && draft.maxPrice === b.max;
        return (
          <Check
            key={b.label}
            label={b.label}
            on={on}
            round
            onPress={() => {
              tap();
              setDraft((d) => ({ ...d, minPrice: on ? null : b.min, maxPrice: on ? null : b.max }));
            }}
          />
        );
      });
    }
    if (current.key === 'rating') {
      return RATINGS.map((r) => (
        <Check
          key={r}
          label={`${r}★ & above`}
          on={draft.minRating === r}
          round
          onPress={() => {
            tap();
            setDraft((d) => ({ ...d, minRating: d.minRating === r ? 0 : r }));
          }}
        />
      ));
    }
    if (current.key === 'discount') {
      return DISCOUNTS.map((p) => (
        <Check
          key={p}
          label={`${p}% off or more`}
          on={draft.minDiscount === p}
          round
          onPress={() => {
            tap();
            setDraft((d) => ({ ...d, minDiscount: d.minDiscount === p ? 0 : p }));
          }}
        />
      ));
    }
    if (!('group' in current)) return null;
    const g = current.group;
    const values = ordered(g);
    const q = search.trim().toLowerCase();
    const shown = q ? values.filter((v) => v.value.toLowerCase().includes(q)) : values;
    const sel = selected(current);
    return (
      <>
        {values.length > SEARCH_FROM ? (
          <View style={styles.search}>
            <Ionicons name="search" size={16} color={colors.text.muted} />
            <TextInput
              value={search}
              onChangeText={setSearch}
              placeholder={`Search ${g.label.toLowerCase()}`}
              placeholderTextColor={colors.text.muted}
              style={styles.searchInput}
              autoCorrect={false}
            />
          </View>
        ) : null}
        {shown.map((v) => (
          <Check
            key={v.value}
            label={valueLabel(g, v.value)}
            on={sel.includes(v.value)}
            onPress={() => toggle(current, v.value)}
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
            onPress={() => setDraft(emptySearchFilters())}
            hitSlop={8}
            disabled={total === 0}
          >
            <Text style={[styles.clearAll, total === 0 && { opacity: 0.4 }]}>CLEAR ALL</Text>
          </Pressable>
        </View>
        <View style={styles.body}>
          <ScrollView style={styles.left} showsVerticalScrollIndicator={false}>
            {sections.map((s) => {
              const on = s.key === current?.key;
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
                  {n > 0 ? (
                    <View style={styles.badge}>
                      <Text style={styles.badgeText}>{n}</Text>
                    </View>
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
            <Text style={styles.rightTitle}>{current?.label}</Text>
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
              // Close first, apply once the sheet has slid away (a native modal still animating out
              // can leave an invisible layer that swallows taps on iOS).
              const next = draft;
              onClose();
              setTimeout(() => onApply(next), 320);
            }}
          >
            <Text style={styles.applyText}>Apply{total > 0 ? ` (${total})` : ''}</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

function Check({
  label,
  on,
  onPress,
  round,
}: {
  label: string;
  on: boolean;
  onPress: () => void;
  round?: boolean;
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
        {label}
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
  left: { width: '38%', flexGrow: 0, backgroundColor: '#f3f6fb' },
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
  none: { fontFamily: font.body, fontSize: 13, color: colors.text.muted, padding: space.md },
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
