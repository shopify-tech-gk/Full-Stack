import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import {
  discountPercent,
  formatMoney,
  type Money,
  type ProductDetailData,
  type ProductVariant,
} from '@youmart/shared-client';
import { colors, font } from '@/theme';

// v1.17 Option picker for a product with variants. One group per option kind the variants differ
// by (Style, then Weight...): a style group is a swipeable row of picture cards (each variant's
// own photo + "from" price), a weight / size group is a grid of price tiles. A later group only
// lists what exists for the earlier picks; combinations without a price show greyed out.

const BRAND = colors.brand.DEFAULT;
const money = (m: Money) => formatMoney(m).replace(/\.00$/, '');
const norm = (s: string | undefined) => (s ?? '').toLowerCase().replace(/\s+/g, '');
const same = (a: string | undefined, b: string | undefined) => norm(a) === norm(b);

/** "900 g" -> 0.9, "5 kg" -> 5, "2 L" -> 2: weight tiles in size order. */
function amount(v: string): number {
  const m = /(\d+(?:\.\d+)?)\s*(kg|kilo|g|gm|gram|l|lit|ml)?/i.exec(v);
  if (!m) return Number.MAX_VALUE;
  const n = Number(m[1]);
  return /^(g|gm|gram|ml)/i.test(m[2] ?? '') ? n / 1000 : n;
}

interface Choice {
  value: string;
  /** Sellable variants with this value (given the earlier picks), cheapest first. */
  variants: ProductVariant[];
  on: boolean;
}

export function VariantPicker({
  prod,
  selectedSkuId,
  onSelect,
}: {
  prod: ProductDetailData;
  selectedSkuId: string | null;
  onSelect: (skuId: string) => void;
}) {
  const sel = prod.variants.find((v) => v.skuId === selectedSkuId) ?? prod.variants[0];
  if (!sel) return null;
  const dims = prod.variantDims.length ? prod.variantDims : [{ key: '', name: 'Option' }]; // options without a kind: one group by label

  const valueOf = (options: Readonly<Record<string, string>>, label: string, key: string) =>
    key ? options[key] : label;

  const pick = (choice: Choice, d: number) => {
    if (choice.variants.length === 0) return;
    void Haptics.selectionAsync().catch(() => undefined);
    // Keep the shopper's later picks when that combination exists (Style changes, Weight stays).
    const later = dims.slice(d + 1);
    const keep = choice.variants.find((v) =>
      later.every((l) => same(v.options[l.key], sel.options[l.key])),
    );
    onSelect((keep ?? choice.variants[0]!).skuId);
  };

  return (
    <View style={styles.wrap}>
      {dims.map((dim, d) => {
        const earlier = dims.slice(0, d);
        const fits = (options: Readonly<Record<string, string>>) =>
          earlier.every((e) => same(options[e.key], sel.options[e.key]));
        const choices: Choice[] = [];
        const add = (value: string | undefined, variant: ProductVariant | null) => {
          if (!value) return;
          let c = choices.find((x) => same(x.value, value));
          if (!c) {
            c = { value, variants: [], on: same(value, valueOf(sel.options, sel.label, dim.key)) };
            choices.push(c);
          }
          if (variant) c.variants.push(variant);
        };
        for (const v of prod.variants) {
          if (fits(v.options)) add(valueOf(v.options, v.label, dim.key), v);
        }
        for (const u of prod.unavailableVariants) {
          if (fits(u.options)) add(valueOf(u.options, u.label, dim.key), null);
        }
        if (dim.key === 'weight') choices.sort((a, b) => amount(a.value) - amount(b.value));
        const current = choices.find((c) => c.on)?.value ?? '';
        const visual = dim.key !== 'weight' && choices.some((c) => c.variants[0]?.image);

        return (
          <View key={dim.key || 'option'} style={styles.group}>
            <View style={styles.groupHead}>
              <Text style={styles.groupName}>{dim.name}</Text>
              <Text style={styles.groupValue} numberOfLines={1}>
                {current}
              </Text>
              <Text style={styles.groupCount}>{choices.length} options</Text>
            </View>
            {visual ? (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.cardRow}
              >
                {choices.map((c) => (
                  <StyleCard key={c.value} choice={c} onPress={() => pick(c, d)} />
                ))}
              </ScrollView>
            ) : (
              <View style={styles.tiles}>
                {choices.map((c) => (
                  <Tile key={c.value} choice={c} onPress={() => pick(c, d)} />
                ))}
              </View>
            )}
          </View>
        );
      })}
    </View>
  );
}

/** "from ₹189" when the value has several prices, else its price. */
function priceText(c: Choice) {
  const first = c.variants[0];
  if (!first) return null;
  const several = c.variants.some((v) => v.sellingPrice !== first.sellingPrice);
  return `${several ? 'from ' : ''}${money(first.sellingPrice)}`;
}

function StyleCard({ choice: c, onPress }: { choice: Choice; onPress: () => void }) {
  const na = c.variants.length === 0;
  const image = c.variants.find((v) => v.image)?.image;
  return (
    <Pressable
      onPress={onPress}
      disabled={na}
      style={({ pressed }) => [
        styles.card,
        c.on && styles.cardOn,
        na && styles.na,
        pressed && { transform: [{ scale: 0.97 }] },
      ]}
      accessibilityState={{ selected: c.on, disabled: na }}
    >
      <View style={styles.cardImg}>
        {image ? (
          <Image
            source={{ uri: image }}
            style={[styles.fill, na && { opacity: 0.4 }]}
            contentFit="contain"
          />
        ) : (
          <Ionicons name="cube-outline" size={26} color={colors.card.border} />
        )}
        {c.on ? (
          <View style={styles.tick}>
            <Ionicons name="checkmark" size={11} color={colors.white} />
          </View>
        ) : null}
      </View>
      <Text style={[styles.cardName, c.on && styles.textOn, na && styles.textNa]} numberOfLines={2}>
        {c.value}
      </Text>
      <Text style={na ? styles.naText : styles.cardPrice}>{na ? 'Unavailable' : priceText(c)}</Text>
    </Pressable>
  );
}

function Tile({ choice: c, onPress }: { choice: Choice; onPress: () => void }) {
  const na = c.variants.length === 0;
  const only = c.variants.length === 1 ? c.variants[0]! : null;
  const off = only ? discountPercent(only.mrp, only.sellingPrice) : 0;
  return (
    <Pressable
      onPress={onPress}
      disabled={na}
      style={({ pressed }) => [
        styles.tile,
        c.on && styles.tileOn,
        na && styles.na,
        pressed && { opacity: 0.85 },
      ]}
      accessibilityState={{ selected: c.on, disabled: na }}
    >
      <Text style={[styles.tileName, c.on && styles.textOn, na && styles.textNa]} numberOfLines={2}>
        {c.value}
      </Text>
      {na ? (
        <Text style={styles.naText}>Unavailable</Text>
      ) : (
        <View style={styles.tilePriceRow}>
          <Text style={styles.tilePrice}>{priceText(c)}</Text>
          {off > 0 ? <Text style={styles.tileOff}>{off}% off</Text> : null}
        </View>
      )}
      {c.on ? <View style={styles.tileBar} /> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: { marginTop: 14, gap: 16 },
  group: { gap: 10 },
  groupHead: { flexDirection: 'row', alignItems: 'baseline', gap: 6 },
  groupName: {
    fontFamily: font.uiBold,
    fontSize: 11.5,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    color: colors.text.muted,
  },
  groupValue: { flex: 1, fontFamily: font.uiBold, fontSize: 14, color: colors.heading },
  groupCount: { fontFamily: font.uiMedium, fontSize: 11.5, color: colors.text.muted },
  cardRow: { gap: 10, paddingRight: 8, paddingVertical: 2 },
  card: {
    width: 112,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: '#e3e8f1',
    backgroundColor: colors.white,
    padding: 6,
    gap: 4,
  },
  cardOn: { borderColor: BRAND, backgroundColor: '#f2f7ff' },
  cardImg: {
    height: 84,
    borderRadius: 11,
    backgroundColor: '#f6f8fb',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  fill: { width: '100%', height: '100%' },
  tick: {
    position: 'absolute',
    top: 5,
    right: 5,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: BRAND,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardName: {
    fontFamily: font.uiSemibold,
    fontSize: 12,
    lineHeight: 15,
    minHeight: 30,
    color: colors.text.strong,
    paddingHorizontal: 2,
  },
  cardPrice: { fontFamily: font.uiBold, fontSize: 13, color: colors.heading, paddingHorizontal: 2 },
  tiles: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tile: {
    minWidth: 92,
    flexGrow: 1,
    flexBasis: '30%',
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#e3e8f1',
    backgroundColor: colors.white,
    paddingHorizontal: 10,
    paddingTop: 9,
    paddingBottom: 10,
    gap: 3,
    overflow: 'hidden',
  },
  tileOn: { borderColor: BRAND, backgroundColor: '#f2f7ff' },
  tileBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 3,
    backgroundColor: BRAND,
  },
  tileName: { fontFamily: font.uiSemibold, fontSize: 13, color: colors.text.strong },
  tilePriceRow: { flexDirection: 'row', alignItems: 'baseline', gap: 5, flexWrap: 'wrap' },
  tilePrice: { fontFamily: font.uiBold, fontSize: 13.5, color: colors.heading },
  tileOff: { fontFamily: font.uiSemibold, fontSize: 11, color: '#15803d' },
  textOn: { color: BRAND },
  na: { borderStyle: 'dashed', borderColor: '#d5dbe5', backgroundColor: '#f7f8fa' },
  textNa: { color: colors.text.muted, textDecorationLine: 'line-through' },
  naText: { fontFamily: font.uiMedium, fontSize: 11, color: colors.text.muted },
});
