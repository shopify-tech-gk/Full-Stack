import { useCallback, useMemo, useState } from 'react';
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
import { FEATURE_CARDS, type FeatureCard } from '@youmart/shared-client';
import { AppHeader } from '@/components/AppHeader';
import { PromoCarousel } from '@/components/PromoCarousel';
import { ProductRail } from '@/components/ProductRail';
import { ProductRailTabs } from '@/components/ProductRailTabs';
import { BrandStrip } from '@/components/BrandStrip';
import { BestCategories } from '@/components/BestCategories';
import { ProductShowcase } from '@/components/ProductShowcase';
import { Footer } from '@/components/Footer';
import { SwipeTabs, HScrollZone } from '@/components/SwipeTabs';
import { DraggableCategoryGrid } from '@/components/DraggableCategoryGrid';
import { getHome, type HomeData } from '@/lib/catalog';
import { mainCategories, catalogSlugOf, type CatNode } from '@/lib/home-categories';
import { useCategoryOrder } from '@/stores/category-order';
import { useRailLayout, type RailLayout } from '@/stores/prefs';
import { colors, font, radii, space } from '@/theme';

const FEATURE_ICON: Record<FeatureCard['id'], keyof typeof Ionicons.glyphMap> = {
  expertise: 'bulb-outline',
  quality: 'diamond-outline',
  guarantee: 'shield-checkmark-outline',
};

// Live's feature-card colours; Expertise keeps dark ink (white-on-yellow is unreadable).
const FEATURE_TONE: Record<FeatureCard['id'], { bg: string; ink: string; chip: string }> = {
  expertise: { bg: colors.feature.expertise, ink: colors.heading, chip: 'rgba(0,0,0,0.08)' },
  quality: { bg: colors.feature.quality, ink: colors.white, chip: 'rgba(255,255,255,0.2)' },
  guarantee: { bg: colors.feature.guarantee, ink: colors.white, chip: 'rgba(255,255,255,0.2)' },
};

// Short mobile taglines (the full web copy is too long for the compact row).
const FEATURE_SHORT: Record<FeatureCard['id'], string> = {
  expertise: 'Expert help for every order',
  quality: 'Top-quality products',
  guarantee: 'Satisfaction guaranteed',
};

type State = { status: 'loading' } | { status: 'error' } | { status: 'ready'; data: HomeData };

export default function HomeScreen() {
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
    <SwipeTabs index={0} style={styles.screen}>
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
          <HScrollZone>
            <PromoCarousel />
          </HScrollZone>
          <HScrollZone>
            <CategoryPager />
          </HScrollZone>

          <RailsHeader layout={railLayout} onChange={setRailLayout} />
          {railLayout === 'tabbed' ? (
            <HScrollZone>
              <ProductRailTabs rails={state.data.rails} />
            </HScrollZone>
          ) : (
            state.data.rails.map((rail) => (
              <HScrollZone key={rail.key}>
                <ProductRail rail={rail} />
              </HScrollZone>
            ))
          )}

          <HScrollZone>
            <BrandStrip />
          </HScrollZone>
          <HScrollZone>
            <ProductShowcase showcase={state.data.showcase} />
          </HScrollZone>
          <HScrollZone>
            <BestCategories />
          </HScrollZone>
          <FeatureStrip />
          <Footer />
        </ScrollView>
      )}
    </SwipeTabs>
  );
}

function CategoryPager() {
  const router = useRouter();
  const cats = useMemo(() => mainCategories(), []);
  const { ordered, move } = useCategoryOrder(cats);

  const open = (c: CatNode) => {
    if (c.href.startsWith('/search')) {
      router.push({ pathname: '/search', params: { q: c.name } });
    } else {
      const cslug = catalogSlugOf(c.href) || c.slug;
      router.push(`/category/${cslug}?taxo=${c.slug}`);
    }
  };

  return <DraggableCategoryGrid cats={ordered} onOpen={open} onMove={move} />;
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
  // Compact mobile trust badges: three side-by-side cards (icon chip + title + short tagline).
  return (
    <View style={styles.features}>
      {FEATURE_CARDS.map((card) => {
        const tone = FEATURE_TONE[card.id];
        return (
          <View key={card.id} style={[styles.feature, { backgroundColor: tone.bg }]}>
            <View style={[styles.featureIcon, { backgroundColor: tone.chip }]}>
              <Ionicons name={FEATURE_ICON[card.id] ?? 'star-outline'} size={18} color={tone.ink} />
            </View>
            <Text style={[styles.featureTitle, { color: tone.ink }]}>{card.title}</Text>
            <Text numberOfLines={2} style={[styles.featureText, { color: tone.ink }]}>
              {FEATURE_SHORT[card.id] ?? card.text}
            </Text>
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
  features: {
    flexDirection: 'row',
    gap: space.sm,
    marginTop: space.xl,
    paddingHorizontal: space.lg,
  },
  feature: {
    flex: 1,
    borderRadius: radii.featureCard,
    paddingVertical: space.md,
    paddingHorizontal: 8,
    alignItems: 'center',
    gap: 6,
  },
  featureIcon: {
    width: 36,
    height: 36,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  featureTitle: {
    fontFamily: font.uiBold,
    fontSize: 13,
    textAlign: 'center',
  },
  featureText: { fontFamily: font.body, fontSize: 10.5, lineHeight: 13.5, textAlign: 'center' },
});
