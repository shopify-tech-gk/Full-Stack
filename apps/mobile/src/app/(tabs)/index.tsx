import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { FEATURE_CARDS, type ApiCategory, type FeatureCard } from '@youmart/shared-client';
import { AppHeader } from '@/components/AppHeader';
import { PromoCarousel } from '@/components/PromoCarousel';
import { ProductRail } from '@/components/ProductRail';
import { ProductRailTabs } from '@/components/ProductRailTabs';
import { BrandStrip } from '@/components/BrandStrip';
import { BestCategories } from '@/components/BestCategories';
import { ProductShowcase } from '@/components/ProductShowcase';
import { Footer } from '@/components/Footer';
import { getHome, type HomeData } from '@/lib/catalog';
import { useRailLayout, type RailLayout } from '@/stores/prefs';
import { colors, font, radii, space } from '@/theme';

const FEATURE_ICON: Record<FeatureCard['id'], keyof typeof Ionicons.glyphMap> = {
  expertise: 'bulb-outline',
  quality: 'diamond-outline',
  guarantee: 'shield-checkmark-outline',
};

// Live's feature-card colours; Expertise keeps dark ink (white-on-yellow is unreadable).
const FEATURE_TONE: Record<FeatureCard['id'], { bg: string; ink: string }> = {
  expertise: { bg: colors.feature.expertise, ink: colors.heading },
  quality: { bg: colors.feature.quality, ink: colors.white },
  guarantee: { bg: colors.feature.guarantee, ink: colors.white },
};

type State = { status: 'loading' } | { status: 'error' } | { status: 'ready'; data: HomeData };

export default function HomeScreen() {
  const router = useRouter();
  const [state, setState] = useState<State>({ status: 'loading' });
  const [refreshing, setRefreshing] = useState(false);
  const [railLayout, setRailLayout] = useRailLayout();

  const load = useCallback(async (refresh = false) => {
    if (refresh) setRefreshing(true);
    try {
      const data = await getHome();
      setState({ status: 'ready', data });
    } catch {
      setState({ status: 'error' });
    } finally {
      if (refresh) setRefreshing(false);
    }
  }, []);

  // Re-fetch on focus so recently-viewed rails reflect products viewed since last visit.
  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  return (
    <View style={styles.screen}>
      <AppHeader />
      {state.status === 'loading' ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.brand.DEFAULT} />
        </View>
      ) : state.status === 'error' ? (
        <View style={styles.center}>
          <Text style={styles.errorTitle}>Could not reach the store</Text>
          <Pressable style={styles.retry} onPress={() => load()}>
            <Text style={styles.retryText}>Retry</Text>
          </Pressable>
        </View>
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.body}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => load(true)}
              tintColor={colors.brand.DEFAULT}
            />
          }
        >
          <PromoCarousel />
          <CategoryStrip
            categories={state.data.categories}
            onPress={(slug) => router.push(`/category/${slug}`)}
          />

          <RailsHeader layout={railLayout} onChange={setRailLayout} />
          {railLayout === 'tabbed' ? (
            <ProductRailTabs rails={state.data.rails} />
          ) : (
            state.data.rails.map((rail) => <ProductRail key={rail.key} rail={rail} />)
          )}

          <BrandStrip />
          <ProductShowcase showcase={state.data.showcase} />
          <BestCategories />
          <FeatureStrip />
          <Footer />
        </ScrollView>
      )}
    </View>
  );
}

function CategoryStrip({
  categories,
  onPress,
}: {
  categories: ApiCategory[];
  onPress: (slug: string) => void;
}) {
  const roots = categories.filter((c) => !c.parentId);
  const list = roots.length > 0 ? roots : categories;
  if (list.length === 0) return null;
  // Web mobile: a 4-column grid of category circles with the label below each.
  return (
    <View style={styles.catWrap}>
      <Text style={styles.catTitle}>Shop by category</Text>
      <View style={styles.catGrid}>
        {list.map((c) => (
          <Pressable key={c.id} style={styles.catChip} onPress={() => onPress(c.slug)}>
            <View style={styles.catIcon}>
              <Ionicons name="pricetag" size={22} color={colors.brand.DEFAULT} />
            </View>
            <Text numberOfLines={2} style={styles.catLabel}>
              {c.name}
            </Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

function RailsHeader({
  layout,
  onChange,
}: {
  layout: RailLayout;
  onChange: (l: RailLayout) => void;
}) {
  return (
    <View style={styles.railsHead}>
      <View style={styles.railsTitleRow}>
        <View style={styles.railsAccent} />
        <Text style={styles.railsTitle}>Handpicked for you</Text>
      </View>
      <View style={styles.toggle}>
        <Pressable
          style={[styles.segment, layout === 'stacked' && styles.segmentActive]}
          onPress={() => onChange('stacked')}
          accessibilityLabel="Stacked rails view"
        >
          <Ionicons
            name="reorder-three-outline"
            size={16}
            color={layout === 'stacked' ? colors.white : colors.brand.DEFAULT}
          />
        </Pressable>
        <Pressable
          style={[styles.segment, layout === 'tabbed' && styles.segmentActive]}
          onPress={() => onChange('tabbed')}
          accessibilityLabel="Tabbed slider view"
        >
          <Ionicons
            name="albums-outline"
            size={15}
            color={layout === 'tabbed' ? colors.white : colors.brand.DEFAULT}
          />
        </Pressable>
      </View>
    </View>
  );
}

function FeatureStrip() {
  // Web mobile: three full-width stacked cards — Expertise (yellow), Quality (blue),
  // Guarantee (green) — centered icon + title + text. (Expertise uses dark text: live's
  // white-on-yellow is ~1.2:1 / unreadable — the previously-approved accessibility fix.)
  return (
    <View style={styles.features}>
      {FEATURE_CARDS.map((card) => {
        const tone = FEATURE_TONE[card.id];
        return (
          <View key={card.id} style={[styles.feature, { backgroundColor: tone.bg }]}>
            <Ionicons name={FEATURE_ICON[card.id] ?? 'star-outline'} size={30} color={tone.ink} />
            <Text style={[styles.featureTitle, { color: tone.ink }]}>{card.title}</Text>
            <Text style={[styles.featureText, { color: tone.ink }]}>{card.text}</Text>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.page },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: space.lg },
  errorTitle: { fontFamily: font.uiSemibold, fontSize: 16, color: colors.text.strong },
  retry: {
    backgroundColor: colors.brand.DEFAULT,
    borderRadius: radii.button,
    paddingHorizontal: 24,
    paddingVertical: 10,
  },
  retryText: { fontFamily: font.uiSemibold, color: colors.white, fontSize: 14 },
  body: { paddingTop: space.md },
  railsHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: space.lg,
    marginTop: space.xl,
  },
  railsTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 10, flexShrink: 1 },
  railsAccent: { width: 4, height: 18, borderRadius: 2, backgroundColor: colors.brand.DEFAULT },
  railsTitle: { fontFamily: font.uiBold, fontSize: 17, color: colors.heading },
  toggle: {
    flexDirection: 'row',
    backgroundColor: colors.brandPopup.bg,
    borderRadius: radii.pill,
    padding: 3,
    gap: 2,
  },
  segment: {
    width: 36,
    height: 30,
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  segmentActive: { backgroundColor: colors.brand.DEFAULT },
  catWrap: { marginTop: space.xl },
  catTitle: {
    fontFamily: font.uiBold,
    fontSize: 17,
    color: colors.heading,
    paddingHorizontal: space.lg,
    marginBottom: space.md,
  },
  catList: { paddingHorizontal: space.lg, gap: space.md },
  catGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: space.md,
    rowGap: space.lg,
  },
  catChip: { width: '25%', alignItems: 'center', gap: 6, paddingHorizontal: 2 },
  catIcon: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.card.border,
  },
  catLabel: {
    fontFamily: font.uiSemibold,
    fontSize: 11,
    color: colors.text.body,
    textAlign: 'center',
  },
  features: {
    marginTop: space.xxl,
    paddingHorizontal: space.lg,
    gap: space.sm,
  },
  feature: {
    borderRadius: radii.featureCard,
    paddingVertical: space.xl,
    paddingHorizontal: space.lg,
    alignItems: 'center',
    gap: 6,
  },
  featureTitle: {
    fontFamily: font.uiBold,
    fontSize: 20,
    marginTop: 4,
  },
  featureText: { fontFamily: font.body, fontSize: 13.5, lineHeight: 20, textAlign: 'center' },
});
