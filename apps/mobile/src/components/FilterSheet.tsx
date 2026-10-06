import { useEffect, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  LISTING_RATING_OPTIONS,
  LISTING_SORT_OPTIONS,
  selectedValues,
  withFilter,
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

/** Native filter + sort bottom sheet (Modal slide-up). Attribute facets come from the category's
 * data-driven filter definition (W3) via shared-client — no hardcoded filters. */
export function FilterSheet({ visible, filters, query, onClose, onApply }: Props) {
  const [draft, setDraft] = useState<ListingQuery>(query);

  useEffect(() => {
    if (visible) setDraft(query);
  }, [visible, query]);

  const facets = (filters?.filters ?? []).filter((f) => f.values && f.values.length > 0);

  const toggleFacet = (key: string, value: string) => {
    const current = selectedValues(draft, key);
    const next = current.includes(value) ? current.filter((v) => v !== value) : [...current, value];
    setDraft({
      ...draft,
      filters: withFilter(draft.filters, key, next.join(',') || null),
      page: 1,
    });
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} />
      <View style={styles.sheet}>
        <View style={styles.handle} />
        <View style={styles.headerRow}>
          <Text style={styles.header}>Filter &amp; Sort</Text>
          <Pressable onPress={onClose} hitSlop={8}>
            <Ionicons name="close" size={22} color={colors.text.strong} />
          </Pressable>
        </View>

        <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollBody}>
          <Text style={styles.group}>Sort by</Text>
          <View style={styles.chips}>
            {LISTING_SORT_OPTIONS.map((opt) => (
              <Chip
                key={opt.value}
                label={opt.label}
                active={draft.sort === opt.value}
                onPress={() => setDraft({ ...draft, sort: opt.value, page: 1 })}
              />
            ))}
          </View>

          <Text style={styles.group}>Rating</Text>
          <View style={styles.chips}>
            {LISTING_RATING_OPTIONS.map((opt) => (
              <Chip
                key={opt.value}
                label={opt.label}
                active={draft.minRating === opt.value}
                onPress={() => setDraft({ ...draft, minRating: opt.value, page: 1 })}
              />
            ))}
          </View>

          {facets.map((facet) => (
            <View key={facet.key}>
              <Text style={styles.group}>{facet.label}</Text>
              <View style={styles.chips}>
                {facet.values!.map((v) => (
                  <Chip
                    key={v.value}
                    label={v.value}
                    active={selectedValues(draft, facet.key).includes(v.value)}
                    onPress={() => toggleFacet(facet.key, v.value)}
                  />
                ))}
              </View>
            </View>
          ))}
        </ScrollView>

        <View style={styles.footer}>
          <Pressable style={styles.clear} onPress={() => setDraft(emptyListingQuery())}>
            <Text style={styles.clearText}>Clear all</Text>
          </Pressable>
          <Pressable
            style={styles.apply}
            onPress={() => {
              onApply({ ...draft, page: 1 });
              onClose();
            }}
          >
            <Text style={styles.applyText}>Apply</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

function Chip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={[styles.chip, active && styles.chipActive]}>
      <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
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
    maxHeight: '82%',
    backgroundColor: colors.white,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    paddingBottom: space.xxl,
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
  },
  header: { fontFamily: font.uiBold, fontSize: 18, color: colors.heading },
  scroll: { paddingHorizontal: space.xl },
  scrollBody: { paddingBottom: space.lg },
  group: {
    fontFamily: font.uiSemibold,
    fontSize: 14,
    color: colors.text.strong,
    marginTop: space.lg,
    marginBottom: space.sm,
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  chip: {
    borderWidth: 1,
    borderColor: colors.card.border,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: colors.white,
  },
  chipActive: { backgroundColor: colors.brand.DEFAULT, borderColor: colors.brand.DEFAULT },
  chipText: { fontFamily: font.ui, fontSize: 13, color: colors.text.body },
  chipTextActive: { color: colors.white, fontFamily: font.uiSemibold },
  footer: {
    flexDirection: 'row',
    gap: space.md,
    paddingHorizontal: space.xl,
    paddingTop: space.md,
    borderTopWidth: 1,
    borderTopColor: colors.border.menu,
  },
  clear: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.button,
    borderWidth: 1,
    borderColor: colors.card.border,
    paddingVertical: 14,
  },
  clearText: { fontFamily: font.uiSemibold, fontSize: 15, color: colors.text.strong },
  apply: {
    flex: 2,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.button,
    backgroundColor: colors.brand.DEFAULT,
    paddingVertical: 14,
  },
  applyText: { fontFamily: font.uiSemibold, fontSize: 15, color: colors.white },
});
