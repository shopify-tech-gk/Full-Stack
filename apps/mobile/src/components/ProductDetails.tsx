import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeIn, ReduceMotion } from 'react-native-reanimated';
import {
  discountPercent,
  formatMoney,
  type Money,
  type ProductDetailData,
} from '@youmart/shared-client';
import { Stars } from './ui';
import { VariantPicker } from './VariantPicker';
import { colors, font, space } from '@/theme';

// v1.17 Premium product details: brand tag, title + rating, a bold price block, the pack-size /
// option selector (it sets the price and what Add / Buy put in the cart), key-feature chips,
// "About this item" points, a clean Specifications list and the description - flowing sections
// with soft dividers instead of boxed cards.

const BRAND = colors.brand.DEFAULT;
const RM = ReduceMotion.Never;
const money = (m: Money) => formatMoney(m).replace(/\.00$/, '');

/** Spec label -> icon for the key-feature chips (anything else uses a generic tag). */
const CHIP_ICON: Record<string, keyof typeof Ionicons.glyphMap> = {
  'Product Type': 'leaf',
  'Item Form': 'water',
  Organic: 'shield-checkmark',
  Colour: 'color-palette',
  Color: 'color-palette',
  'Item weight': 'barbell',
  'Item dimensions': 'resize',
};
/** Specs shown as chips, in this order (when the product has them). */
const CHIP_KEYS = ['Product Type', 'Item Form', 'Organic', 'Colour', 'Color', 'Item weight'];
const SPECS_PREVIEW = 6;

/** `title`: the picked variant's own title, when it has one. */
export function ProductHeading({
  prod,
  title,
}: {
  prod: ProductDetailData;
  title?: string | null;
}) {
  const brand = prod.specifications.find((s) => s.label === 'Brand')?.value;
  return (
    <View style={styles.heading}>
      {brand ? (
        <View style={styles.brandTag}>
          <Ionicons name="ribbon" size={12} color={BRAND} />
          <Text style={styles.brandText}>{brand}</Text>
        </View>
      ) : null}
      <Text style={styles.title}>{title || prod.title}</Text>
      <View style={styles.ratingRow}>
        <Stars rating={prod.rating} size={17} bold />
        <Text style={styles.ratingText}>
          {prod.ratingCount > 0 ? `${prod.rating.toFixed(1)} · ${prod.ratingCount} reviews` : 'New'}
        </Text>
      </View>
    </View>
  );
}

/** Price block + the option selector. */
export function ProductPricing({
  prod,
  price,
  mrp,
  selectedSkuId,
  onSelect,
}: {
  prod: ProductDetailData;
  price: Money;
  mrp: Money;
  selectedSkuId: string | null;
  onSelect: (skuId: string) => void;
}) {
  const off = discountPercent(mrp, price);
  return (
    <View style={styles.pricing}>
      <View style={styles.priceRow}>
        {off > 0 ? (
          <View style={styles.offBadge}>
            <Ionicons name="arrow-down" size={13} color="#15803d" />
            <Text style={styles.offText}>{off}%</Text>
          </View>
        ) : null}
        <Text style={styles.price}>{money(price)}</Text>
        {off > 0 ? <Text style={styles.mrp}>{money(mrp)}</Text> : null}
      </View>
      <Text style={styles.taxNote}>
        Inclusive of all taxes
        {off > 0 ? ` · You save ${money((Number(mrp) - Number(price)).toFixed(2))}` : ''}
      </Text>

      {prod.variants.length > 0 ? (
        <VariantPicker prod={prod} selectedSkuId={selectedSkuId} onSelect={onSelect} />
      ) : null}
    </View>
  );
}

/** Key-feature chips, "About this item", Specifications and the description. */
export function ProductAbout({ prod }: { prod: ProductDetailData }) {
  const [allSpecs, setAllSpecs] = useState(false);
  const [fullDesc, setFullDesc] = useState(false);
  const chips = CHIP_KEYS.map((k) => prod.specifications.find((s) => s.label === k)).filter(
    (s): s is { label: string; value: string } => Boolean(s),
  );
  const specs = allSpecs ? prod.specifications : prod.specifications.slice(0, SPECS_PREVIEW);

  return (
    <View>
      {chips.length > 0 ? (
        <View style={styles.chips}>
          {chips.map((c) => (
            <View key={c.label} style={styles.chip}>
              <View style={styles.chipIcon}>
                <Ionicons name={CHIP_ICON[c.label] ?? 'pricetag'} size={15} color={BRAND} />
              </View>
              <View style={{ flexShrink: 1 }}>
                <Text style={styles.chipLabel}>{c.label}</Text>
                <Text style={styles.chipValue} numberOfLines={1}>
                  {c.value}
                </Text>
              </View>
            </View>
          ))}
        </View>
      ) : null}

      {prod.highlights.length > 0 ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>About this item</Text>
          {prod.highlights.map((h, i) => (
            <View key={i} style={styles.point}>
              <View style={styles.pointDot}>
                <Ionicons name="checkmark" size={11} color={colors.white} />
              </View>
              <Text style={styles.pointText}>{h}</Text>
            </View>
          ))}
        </View>
      ) : null}

      {prod.specifications.length > 0 ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Specifications</Text>
          <View style={styles.specList}>
            {specs.map((s, i) => (
              <Animated.View
                key={s.label}
                entering={i >= SPECS_PREVIEW ? FadeIn.duration(200).reduceMotion(RM) : undefined}
                style={[styles.specRow, i % 2 === 0 && styles.specRowTint]}
              >
                <Text style={styles.specLabel}>{s.label}</Text>
                <Text style={styles.specValue}>{s.value}</Text>
              </Animated.View>
            ))}
          </View>
          {prod.specifications.length > SPECS_PREVIEW ? (
            <Pressable onPress={() => setAllSpecs((v) => !v)} hitSlop={8} style={styles.more}>
              <Text style={styles.moreText}>
                {allSpecs ? 'Show less' : `Show all ${prod.specifications.length} specifications`}
              </Text>
              <Ionicons name={allSpecs ? 'chevron-up' : 'chevron-down'} size={15} color={BRAND} />
            </Pressable>
          ) : null}
        </View>
      ) : null}

      {prod.description ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Product description</Text>
          <Text style={styles.desc} numberOfLines={fullDesc ? undefined : 5}>
            {prod.description}
          </Text>
          {prod.description.length > 260 ? (
            <Pressable onPress={() => setFullDesc((v) => !v)} hitSlop={8} style={styles.more}>
              <Text style={styles.moreText}>{fullDesc ? 'Read less' : 'Read more'}</Text>
              <Ionicons name={fullDesc ? 'chevron-up' : 'chevron-down'} size={15} color={BRAND} />
            </Pressable>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  heading: { paddingHorizontal: space.lg, paddingTop: space.lg, gap: 7 },
  brandTag: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#eaf1ff',
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  brandText: { fontFamily: font.uiBold, fontSize: 12, color: BRAND, letterSpacing: 0.3 },
  title: { fontFamily: font.uiSemibold, fontSize: 18, lineHeight: 25, color: colors.heading },
  ratingRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  ratingText: { fontFamily: font.uiMedium, fontSize: 12.5, color: colors.text.muted },
  pricing: { paddingHorizontal: space.lg, paddingTop: space.md, gap: 4 },
  priceRow: { flexDirection: 'row', alignItems: 'center', gap: 10, flexWrap: 'wrap' },
  offBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    backgroundColor: '#dcfce7',
    borderRadius: 8,
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  offText: { fontFamily: font.uiBold, fontSize: 14, color: '#15803d' },
  price: { fontFamily: font.uiBold, fontSize: 28, color: colors.heading, letterSpacing: -0.3 },
  mrp: {
    fontFamily: font.body,
    fontSize: 15,
    color: colors.text.muted,
    textDecorationLine: 'line-through',
  },
  taxNote: { fontFamily: font.uiMedium, fontSize: 12, color: colors.text.muted },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    paddingHorizontal: space.lg,
    paddingTop: space.lg,
  },
  chip: {
    width: '48%',
    flexGrow: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#f6f9ff',
    borderRadius: 14,
    paddingHorizontal: 10,
    paddingVertical: 9,
  },
  chipIcon: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipLabel: { fontFamily: font.uiMedium, fontSize: 11, color: colors.text.muted },
  chipValue: { fontFamily: font.uiBold, fontSize: 13, color: colors.heading },
  section: {
    marginTop: space.xl,
    paddingTop: space.lg,
    paddingHorizontal: space.lg,
    borderTopWidth: 6,
    borderTopColor: '#f2f5fa',
    gap: 10,
  },
  sectionTitle: { fontFamily: font.uiBold, fontSize: 17, color: colors.heading },
  point: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  pointDot: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: BRAND,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  pointText: {
    flex: 1,
    fontFamily: font.body,
    fontSize: 14,
    lineHeight: 21,
    color: colors.text.body,
  },
  specList: { borderRadius: 14, overflow: 'hidden' },
  specRow: { flexDirection: 'row', paddingHorizontal: 12, paddingVertical: 11, gap: 12 },
  specRowTint: { backgroundColor: '#f6f9ff' },
  specLabel: { width: '40%', fontFamily: font.uiMedium, fontSize: 13, color: colors.text.muted },
  specValue: { flex: 1, fontFamily: font.uiSemibold, fontSize: 13.5, color: colors.heading },
  more: { flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start' },
  moreText: { fontFamily: font.uiBold, fontSize: 13.5, color: BRAND },
  desc: { fontFamily: font.body, fontSize: 14, lineHeight: 22, color: colors.text.body },
});
