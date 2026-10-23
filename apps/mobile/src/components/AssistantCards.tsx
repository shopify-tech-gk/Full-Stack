import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import Animated, { FadeIn, FadeInRight, ReduceMotion } from 'react-native-reanimated';
import {
  ApiError,
  discountPercent,
  formatMoney,
  type AssistantCategory,
  type AssistantProduct,
} from '@youmart/shared-client';
import { api } from '@/lib/api';
import { lookupCategoryImage } from '@/lib/category-images';
import { catalogSlugOf, taxNode } from '@/lib/home-categories';
import { ProductImage } from './ui';
import { colors, font } from '@/theme';

// v1.17 YouMart AI reply cards: the store categories and real products the AI picked (tap to
// open), and a "Request restock" card when what they asked for isn't in stock.

const BRAND = colors.brand.DEFAULT;
const shortMoney = (m: string) => formatMoney(m).replace(/\.00$/, '');

function SectionLabel({ icon, text }: { icon: keyof typeof Ionicons.glyphMap; text: string }) {
  return (
    <View style={styles.label}>
      <Ionicons name={icon} size={13} color={BRAND} />
      <Text style={styles.labelText}>{text}</Text>
    </View>
  );
}

/** Category cards (bundled artwork) - each opens that category screen, like the home grid. */
export function AssistantCategoryCards({ categories }: { categories: AssistantCategory[] }) {
  const router = useRouter();
  const nodes = categories
    .map((c) => ({ c, node: taxNode(c.taxo.split('~')) }))
    .filter((x): x is { c: AssistantCategory; node: NonNullable<ReturnType<typeof taxNode>> } =>
      Boolean(x.node),
    );
  if (nodes.length === 0) return null;
  return (
    <View>
      <SectionLabel icon="grid" text="Shop these categories" />
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.row}
      >
        {nodes.map(({ c, node }, i) => {
          const image = lookupCategoryImage(node.imageKey);
          return (
            <Animated.View
              key={c.taxo}
              entering={FadeInRight.delay(i * 60)
                .duration(260)
                .reduceMotion(ReduceMotion.Never)}
            >
              <Pressable
                style={({ pressed }) => [styles.catCard, pressed && styles.pressed]}
                onPress={() => {
                  void Haptics.selectionAsync().catch(() => undefined);
                  const slug = catalogSlugOf(node.href) || node.slug;
                  router.push(`/category/${slug}?taxo=${node.path.join('~')}`);
                }}
                accessibilityLabel={`Open ${node.name}`}
              >
                <View style={styles.catImageWrap}>
                  {image ? (
                    <Image source={image} style={styles.catImage} contentFit="cover" />
                  ) : (
                    <Ionicons name="pricetags-outline" size={26} color={BRAND} />
                  )}
                </View>
                <Text style={styles.catName} numberOfLines={2}>
                  {node.name}
                </Text>
              </Pressable>
            </Animated.View>
          );
        })}
      </ScrollView>
    </View>
  );
}

/** Product cards - each opens the product page. */
export function AssistantProductCards({ products }: { products: AssistantProduct[] }) {
  const router = useRouter();
  if (products.length === 0) return null;
  return (
    <View>
      <SectionLabel icon="bag-handle" text="Picked for you" />
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.row}
      >
        {products.map((p, i) => {
          const off = discountPercent(p.mrp, p.price);
          return (
            <Animated.View
              key={p.slug}
              entering={FadeInRight.delay(i * 60)
                .duration(260)
                .reduceMotion(ReduceMotion.Never)}
            >
              <Pressable
                style={({ pressed }) => [styles.prodCard, pressed && styles.pressed]}
                onPress={() => {
                  void Haptics.selectionAsync().catch(() => undefined);
                  router.push(`/product/${p.slug}`);
                }}
                accessibilityLabel={`Open ${p.title}`}
              >
                <View style={styles.prodImageWrap}>
                  <ProductImage src={p.imageUrl ?? undefined} style={styles.prodImage} icon={24} />
                  {off > 0 ? (
                    <View style={styles.off}>
                      <Text style={styles.offText}>{off}% OFF</Text>
                    </View>
                  ) : null}
                </View>
                <Text style={styles.prodTitle} numberOfLines={2}>
                  {p.title}
                </Text>
                <View style={styles.priceRow}>
                  <Text style={styles.price}>{shortMoney(p.price)}</Text>
                  {off > 0 ? <Text style={styles.mrp}>{shortMoney(p.mrp)}</Text> : null}
                </View>
              </Pressable>
            </Animated.View>
          );
        })}
      </ScrollView>
    </View>
  );
}

/** "Not in stock right now - request a restock?" -> the team sees it in Admin. */
export function RestockCard({
  item,
  transcript,
  sent,
  onSent,
}: {
  item: string;
  transcript: () => string;
  /** Already sent (a saved chat reopened) - shows the confirmation, never sends twice. */
  sent?: boolean;
  onSent?: () => void;
}) {
  const [state, setState] = useState<'idle' | 'sending' | 'sent'>(sent ? 'sent' : 'idle');
  const [error, setError] = useState<string | null>(null);

  const send = async () => {
    setState('sending');
    setError(null);
    try {
      await api.support.requestRestock({ item, transcript: transcript() });
      setState('sent');
      onSent?.();
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(
        () => undefined,
      );
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not send. Please try again.');
      setState('idle');
    }
  };

  if (state === 'sent') {
    return (
      <Animated.View
        entering={FadeIn.duration(250).reduceMotion(ReduceMotion.Never)}
        style={[styles.restock, styles.restockDone]}
      >
        <View style={styles.doneIcon}>
          <Ionicons name="checkmark" size={16} color={colors.white} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.restockTitle}>Request sent</Text>
          <Text style={styles.restockText}>Thanks! Our team will look at stocking {item}.</Text>
        </View>
      </Animated.View>
    );
  }

  return (
    <View style={styles.restock}>
      <View style={styles.restockHead}>
        <View style={styles.restockIcon}>
          <Ionicons name="cube-outline" size={17} color="#b45309" />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.restockTitle}>Not in stock right now</Text>
          <Text style={styles.restockText} numberOfLines={2}>
            {item}
          </Text>
        </View>
      </View>
      <Text style={styles.restockAsk}>Do you want us to restock it?</Text>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <Pressable
        onPress={() => void send()}
        disabled={state === 'sending'}
        style={({ pressed }) => [styles.restockBtn, pressed && { opacity: 0.88 }]}
      >
        {state === 'sending' ? (
          <ActivityIndicator size="small" color={colors.white} />
        ) : (
          <>
            <Ionicons name="refresh-circle" size={17} color={colors.white} />
            <Text style={styles.restockBtnText}>Yes, request restock</Text>
          </>
        )}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  label: { flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 7, marginTop: 2 },
  labelText: { fontFamily: font.uiBold, fontSize: 12, color: BRAND, letterSpacing: 0.2 },
  row: { gap: 10, paddingRight: 8 },
  pressed: { opacity: 0.88, transform: [{ scale: 0.97 }] },
  catCard: {
    width: 96,
    backgroundColor: colors.white,
    borderRadius: 16,
    padding: 5,
    paddingBottom: 8,
    gap: 6,
    borderWidth: 1,
    borderColor: '#e2e9f6',
  },
  catImageWrap: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#eaf1ff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  catImage: { width: '100%', height: '100%' },
  catName: {
    fontFamily: font.uiSemibold,
    fontSize: 11.5,
    lineHeight: 14,
    color: colors.heading,
    textAlign: 'center',
    paddingHorizontal: 2,
  },
  prodCard: {
    width: 136,
    backgroundColor: colors.white,
    borderRadius: 16,
    padding: 6,
    paddingBottom: 9,
    gap: 4,
    borderWidth: 1,
    borderColor: '#e2e9f6',
  },
  prodImageWrap: { borderRadius: 12, overflow: 'hidden', backgroundColor: '#f4f7fd' },
  prodImage: { width: '100%', aspectRatio: 1 },
  off: {
    position: 'absolute',
    left: 6,
    top: 6,
    backgroundColor: '#e11d48',
    borderRadius: 7,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  offText: { fontFamily: font.uiBold, fontSize: 9.5, color: colors.white },
  prodTitle: {
    fontFamily: font.uiMedium,
    fontSize: 12,
    lineHeight: 15,
    color: colors.text.strong,
    paddingHorizontal: 2,
  },
  priceRow: { flexDirection: 'row', alignItems: 'baseline', gap: 5, paddingHorizontal: 2 },
  price: { fontFamily: font.uiBold, fontSize: 13.5, color: colors.heading },
  mrp: {
    fontFamily: font.body,
    fontSize: 10.5,
    color: colors.text.muted,
    textDecorationLine: 'line-through',
  },
  restock: {
    backgroundColor: '#fffbeb',
    borderRadius: 16,
    padding: 13,
    gap: 9,
    borderWidth: 1.5,
    borderColor: '#fcd34d',
  },
  restockDone: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f0fdf4',
    borderColor: '#86efac',
    gap: 11,
  },
  doneIcon: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#16a34a',
    alignItems: 'center',
    justifyContent: 'center',
  },
  restockHead: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  restockIcon: {
    width: 34,
    height: 34,
    borderRadius: 12,
    backgroundColor: '#fef3c7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  restockTitle: { fontFamily: font.uiBold, fontSize: 14, color: colors.heading },
  restockText: { fontFamily: font.body, fontSize: 12.5, color: colors.text.body, marginTop: 1 },
  restockAsk: { fontFamily: font.uiSemibold, fontSize: 13, color: '#92400e' },
  error: { fontFamily: font.uiMedium, fontSize: 12, color: '#c62828' },
  restockBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    borderRadius: 12,
    paddingVertical: 11,
    experimental_backgroundImage: 'linear-gradient(135deg, #0142aa 0%, #2f6ae8 100%)',
  },
  restockBtnText: { fontFamily: font.uiBold, fontSize: 14, color: colors.white },
});
